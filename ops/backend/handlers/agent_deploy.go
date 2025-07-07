package handlers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
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
func (h *AgentDeployHandler) Deploy(c *gin.Context) {
	// TODO: Implement SSH upload & service management
	c.JSON(http.StatusAccepted, gin.H{"status": "deploy started (stub)"})
}
