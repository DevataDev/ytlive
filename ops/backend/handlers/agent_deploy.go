package handlers

import (
    
    "fmt"
    "math/rand"
    "net/http"
    "os"
    "path/filepath"
    "time"

    "github.com/gin-gonic/gin"
    "github.com/oklog/ulid/v2"
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
    // projectRoot is absolute path to repository root, injected from main.go
    projectRoot string
}

// NewAgentDeployHandler constructs handler with root directory for locating
// artefacts.
func NewAgentDeployHandler(root string) *AgentDeployHandler {
    return &AgentDeployHandler{projectRoot: root}
}

// Download serves the requested binary as an attachment.
func (h *AgentDeployHandler) Download(c *gin.Context) {
	arch := c.Param("arch")
	if arch != "amd64" && arch != "arm64" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported arch"})
		return
	}
	rel := filepath.Join("ops", "backend", "agent_bins", fmt.Sprintf("ops-agent-linux-%s", arch))
	abs := filepath.Join(h.projectRoot, rel)
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
    go func(id string) {
        steps := []string{
            "Connecting via SSH…",
            "Uploading binary…",
            "Setting up systemd service…",
            "Starting agent…",
            "DONE",
        }
        for _, s := range steps {
            broadcastAgent(id, s)
            time.Sleep(1 * time.Second)
        }
    }(jobID)

    c.JSON(http.StatusAccepted, gin.H{"id": jobID})
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
