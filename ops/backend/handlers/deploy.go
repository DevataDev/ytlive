package handlers

import (
	"bufio"
	"bytes"
	"fmt"
	"net/http"
	"os"
	"text/template"
	"time"

	"golang.org/x/crypto/ssh"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/devatadev/ytlive/ops/backend/models"
)

// per-process in-memory broadcaster for simple SSE. Map deploymentID to slice of chan string.
var listeners = make(map[string][]chan string)

func addListener(depID string) chan string {
	ch := make(chan string, 32)
	listeners[depID] = append(listeners[depID], ch)
	return ch
}

func broadcast(depID, line string) {
	for _, ch := range listeners[depID] {
		select {
		case ch <- line:
		default:
		}
	}
}

// DeployHandler manages installation jobs.
type DeployHandler struct {
	DB            *gorm.DB
	EncryptionKey string
}

func NewDeployHandler(db *gorm.DB, encKey string) *DeployHandler {
	return &DeployHandler{DB: db, EncryptionKey: encKey}
}

// Start kicks off a deployment and returns deployment metadata.
func (h *DeployHandler) Start(c *gin.Context) {
	role, _ := c.Get("role")
	if role != "admin" && role != "superadmin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	serverID := c.Param("id")
	if serverID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing server id"})
		return
	}

	// ensure server exists
	var srv models.Server
	if err := h.DB.First(&srv, "id = ?", serverID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "server not found"})
		return
	}

	dep := &models.Deployment{ServerID: serverID, Status: "running"}
	if err := h.DB.Create(dep).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// start background job
	go h.runDeployment(dep.ID, srv)

	c.JSON(http.StatusAccepted, dep)
}

// Stream sends logs via Server-Sent Events.
func (h *DeployHandler) Stream(c *gin.Context) {
	depID := c.Param("id")
	if depID == "" {
		c.Status(http.StatusBadRequest)
		return
	}

	ch := addListener(depID)
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Flush()

	for line := range ch {
		fmt.Fprintf(c.Writer, "data: %s\n\n", line)
		c.Writer.Flush()
	}
}

// runDeployment connects to the server via SSH and executes the installation script.
// It streams every line back to listeners.
// The install script performs:
// 1. Install Docker if missing
// 2. Add CA cert for private registry
// 3. docker login
// 4. Write docker-compose.yml + env + config.yaml
// 5. docker compose pull & up -d
//
// For simplicity we copy the local template files located under ops/backend/install.
// In production you may template them per server instead of raw copy.
func (h *DeployHandler) runDeployment(depID string, srv models.Server) {
	log := func(s string) {
		broadcast(depID, s)
		h.DB.Model(&models.Deployment{}).Where("id = ?", depID).UpdateColumn("logs", gorm.Expr("logs || ?", "\n"+s))
	}

	// decrypt ssh password (if present)
	pwd, _ := srv.GetPassword(h.EncryptionKey)

	// read template files
	caBytes, _ := os.ReadFile("ops/backend/install/ca.crt")
	composeBytes, _ := os.ReadFile("ops/backend/install/docker-compose.yml")
	envBytes, _ := os.ReadFile("ops/backend/install/.env.tmpl")
	cfgBytes, _ := os.ReadFile("ops/backend/install/config.yaml.tmpl")

	// fetch secrets from DB
	tmplData := make(map[string]string)
	var secrets []models.Secret
	h.DB.Find(&secrets)
	for _, sec := range secrets {
		if val, err := sec.Get(h.EncryptionKey); err == nil {
			tmplData[sec.Key] = val
		}
	}

	// render templates
	envRendered := bytes.Buffer{}
	envTpl, _ := template.New("env").Parse(string(envBytes))
	_ = envTpl.Execute(&envRendered, tmplData)

	cfgRendered := bytes.Buffer{}
	cfgTpl, _ := template.New("cfg").Parse(string(cfgBytes))
	_ = cfgTpl.Execute(&cfgRendered, tmplData)

	// build remote script
	script := fmt.Sprintf(`set -e
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
sudo mkdir -p /etc/docker/certs.d/registry.ppn.net.id
cat <<'CRT' | sudo tee /etc/docker/certs.d/registry.ppn.net.id/ca.crt
%s
CRT

docker login registry.ppn.net.id -u %s -p %s
sudo mkdir -p /opt/ytlive && cd /opt/ytlive
cat <<'YML' > docker-compose.yml
%s
YML
cat <<'ENV' > .env
%s
ENV

cat <<'CFG' > config.yaml
%s
CFG

docker compose pull
docker compose up -d
`, string(caBytes), tmplData["DOCKER_USERNAME"], tmplData["DOCKER_PASSWORD"], string(composeBytes), envRendered.String(), cfgRendered.String())

	// SSH config
	config := &ssh.ClientConfig{
		User:            srv.SSHUser,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         30 * time.Second,
	}
	if pwd != "" {
		config.Auth = []ssh.AuthMethod{ssh.Password(pwd)}
	}
	addr := fmt.Sprintf("%s:%d", srv.Address, srv.SSHPort)

	log("Connecting to " + addr)
	client, err := ssh.Dial("tcp", addr, config)
	if err != nil {
		log("SSH dial error: " + err.Error())
		h.DB.Model(&models.Deployment{}).Where("id = ?", depID).Updates(map[string]any{"status": "failed", "finished_at": time.Now().UTC(), "err_msg": err.Error()})
		return
	}
	defer client.Close()

	session, err := client.NewSession()
	if err != nil {
		log("SSH session error: " + err.Error())
		h.DB.Model(&models.Deployment{}).Where("id = ?", depID).Updates(map[string]any{"status": "failed", "finished_at": time.Now().UTC(), "err_msg": err.Error()})
		return
	}
	defer session.Close()

	// capture combined output
	pipe, _ := session.StdoutPipe()
	session.Stderr = session.Stdout

	// start command
	if err := session.Start(script); err != nil {
		log("start error: " + err.Error())
		return
	}

	// stream
	scanner := bufio.NewScanner(pipe)
	for scanner.Scan() {
		log(scanner.Text())
	}

	if err := session.Wait(); err != nil {
		log("script failed: " + err.Error())
		h.DB.Model(&models.Deployment{}).Where("id = ?", depID).Updates(map[string]any{"status": "failed", "finished_at": time.Now().UTC(), "err_msg": err.Error()})
		return
	}

	// success
	h.DB.Model(&models.Deployment{}).Where("id = ?", depID).Updates(map[string]any{
		"finished_at": time.Now().UTC(),
		"status":      "success",
	})
	log("DONE")
}
