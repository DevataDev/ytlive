package handlers

import (
	"bytes"
	"encoding/hex"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"golang.org/x/crypto/ssh"

	crand "crypto/rand"

	"github.com/gin-gonic/gin"
	"github.com/oklog/ulid/v2"
	"gorm.io/gorm"

	"github.com/devatadev/ytlive/ops/backend/models"
)

// AgentDeployHandler exposes endpoints for downloading an agent binary and
// triggering automated installation on a server.  The automatic installation
// will be implemented incrementally – for now it simply responds OK so the
// front-end UI can be wired up without errors.
//
//   GET  /downloads/agent/:arch               → download static binary
//   POST /servers/:id/agent/deploy            → (future) SSH deploy on server
//
// The binaries are produced by `make release-agent` and stored under
//   ops/backend/agent_bins/ops-agent-linux-<arch>
// As we only build linux/amd64 and linux/arm64 right now, `arch` must be one of
// "amd64" or "arm64".

// per-process in-memory broadcaster for simple Server-Sent Events.
var agentListeners = make(map[string][]chan string)

func addAgentListener(id string) chan string {
	ch := make(chan string, 32)
	agentListeners[id] = append(agentListeners[id], ch)
	return ch
}

func broadcastAgent(id, line string) {
	for _, ch := range agentListeners[id] {
		select {
		case ch <- line:
		default:
		}
	}
}

type AgentDeployHandler struct {
	DB          *gorm.DB
	EncKey      string
	BackendURL  string
	projectRoot string
}

// NewAgentDeployHandler constructs handler with root directory for locating
// artefacts.
func NewAgentDeployHandler(root string) *AgentDeployHandler {
	// caller will set DB/EncKey manually after construction when needed
	return &AgentDeployHandler{projectRoot: root}
}

// Download serves the requested binary as an attachment.
func (h *AgentDeployHandler) Download(c *gin.Context) {
	arch := c.Param("arch")
	if arch != "amd64" && arch != "arm64" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported arch"})
		return
	}
	abs := filepath.Join(h.projectRoot, "agent_bins", fmt.Sprintf("ops-agent-linux-%s", arch))
	if _, err := os.Stat(abs); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent binary not found; run make release-agent first"})
		return
	}
	c.FileAttachment(abs, filepath.Base(abs))
}

// Deploy will remotely upload the agent to a server and start it.  At this
// stage we only acknowledge the request so that the front-end integration can
// proceed without 404/server errors.
// Deploy kicks off an installation job (stub). It immediately returns a job ID
// and starts a goroutine that streams a few fake log lines so the front-end can
// be wired up without hitting unimplemented errors.
func (h *AgentDeployHandler) Deploy(c *gin.Context) {
	srvID := c.Param("id")
	if srvID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing server id"})
		return
	}

	// create deterministic entropy for ulid
	entropy := rand.New(rand.NewSource(time.Now().UnixNano()))
	jobID := ulid.MustNew(ulid.Timestamp(time.Now()), entropy).String()

	// start background goroutine
	go h.runAgentDeploy(jobID, srvID)

	c.JSON(http.StatusAccepted, gin.H{"id": jobID})
}

// runAgentDeploy executes the real SSH installation steps.
func (h *AgentDeployHandler) runAgentDeploy(jobID, srvID string) {
	log := func(s string) { broadcastAgent(jobID, s) }

	// fetch server credentials
	var srv models.Server
	if err := h.DB.First(&srv, "id = ?", srvID).Error; err != nil {
		log("server not found: " + err.Error())
		log("DONE")
		return
	}

	// ensure agent key present
	if srv.AgentKey == "" {
		rb := make([]byte, 16)
		_, _ = crand.Read(rb)
		srv.AgentKey = hex.EncodeToString(rb)
		_ = h.DB.Model(&srv).Update("agent_key", srv.AgentKey).Error
	}

	pwd, _ := srv.GetPassword(h.EncKey)

	// Config auth
	auths := []ssh.AuthMethod{}
	if pwd != "" {
		auths = append(auths, ssh.Password(pwd))
	}
	if srv.SSHKeyPath != "" {
		key, err := os.ReadFile(srv.SSHKeyPath)
		if err == nil {
			signer, err := ssh.ParsePrivateKey(key)
			if err == nil {
				auths = append(auths, ssh.PublicKeys(signer))
			}
		}
	}

	config := &ssh.ClientConfig{
		User:            srv.SSHUser,
		Timeout:         30 * time.Second,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Auth:            auths,
	}
	addr := fmt.Sprintf("%s:%d", srv.Address, srv.SSHPort)
	log("Connecting to " + addr)
	client, err := ssh.Dial("tcp", addr, config)
	if err != nil {
		log("SSH dial error: " + err.Error())
		log("DONE")
		return
	}
	defer client.Close()

	// Detect arch
	sessArch, _ := client.NewSession()
	archOut, _ := sessArch.Output("uname -m")
	sessArch.Close()
	arch := "amd64"
	if bytes.Contains(archOut, []byte("aarch64")) || bytes.Contains(archOut, []byte("arm64")) {
		arch = "arm64"
	}
	log("Remote arch: " + arch)

	// Write env file
	envContent := fmt.Sprintf("OPS_BACKEND_URL=%s\nAGENT_KEY=%s\n", h.BackendURL, srv.AgentKey)
	sessEnv, _ := client.NewSession()
	wenv, _ := sessEnv.StdinPipe()
	_ = sessEnv.Start("sudo tee /etc/ops-agent.env >/dev/null")
	_, _ = io.Copy(wenv, bytes.NewReader([]byte(envContent)))
	wenv.Close()
	_ = sessEnv.Wait()
	sessEnv.Close()

	// Read binary
	binPath := filepath.Join(h.projectRoot, "agent_bins", fmt.Sprintf("ops-agent-linux-%s", arch))
	binBytes, err := os.ReadFile(binPath)
	if err != nil {
		log("read binary error: " + err.Error())
		log("DONE")
		return
	}

	// remove old binary
	sessRemove, _ := client.NewSession()
	_ = sessRemove.Run("sudo rm -rf /usr/local/bin/ops-agent")
	sessRemove.Close()

	log("Uploading binary…")
	sessUpload, _ := client.NewSession()
	w, _ := sessUpload.StdinPipe()
	_ = sessUpload.Start("sudo tee /usr/local/bin/ops-agent >/dev/null")
	_, _ = io.Copy(w, bytes.NewReader(binBytes))
	w.Close()
	_ = sessUpload.Wait()
	sessUpload.Close()

	// chmod
	sessChmod, _ := client.NewSession()
	_ = sessChmod.Run("sudo chmod +x /usr/local/bin/ops-agent")
	sessChmod.Close()

	log("Writing systemd service…")
	serviceContent := `[Unit]
Description=Ops Agent
After=network.target

[Service]
EnvironmentFile=/etc/ops-agent.env
ExecStart=/usr/local/bin/ops-agent
Restart=always
User=root

[Install]
WantedBy=multi-user.target`
	sessSvc, _ := client.NewSession()
	w2, _ := sessSvc.StdinPipe()
	_ = sessSvc.Start("sudo tee /etc/systemd/system/ops-agent.service >/dev/null")
	_, _ = io.Copy(w2, bytes.NewReader([]byte(serviceContent)))
	w2.Close()
	_ = sessSvc.Wait()
	sessSvc.Close()

	log("Enabling & starting service…")
	sessEnable, _ := client.NewSession()
	_ = sessEnable.Run("sudo systemctl enable --now ops-agent")
	sessEnable.Close()

	// restart service
	sessRestart, _ := client.NewSession()
	_ = sessRestart.Run("sudo systemctl restart ops-agent")
	sessRestart.Close()

	log("DONE")
}

// Stream Server-Sent Events for a running job.
func (h *AgentDeployHandler) Stream(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.Status(http.StatusBadRequest)
		return
	}

	ch := addAgentListener(id)
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Flush()

	for line := range ch {
		fmt.Fprintf(c.Writer, "data: %s\n\n", line)
		c.Writer.Flush()
	}
}
