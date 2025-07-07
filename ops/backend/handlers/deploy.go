package handlers

import (
    "fmt"
    "net/http"
    "time"

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
    DB *gorm.DB
    EncryptionKey string
}

func NewDeployHandler(db *gorm.DB, encKey string) *DeployHandler { return &DeployHandler{DB: db, EncryptionKey: encKey} }

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

// runDeployment currently mocks install; replace with real SSH steps.
func (h *DeployHandler) runDeployment(depID string, srv models.Server) {
    log := func(s string) { broadcast(depID, s); }

    steps := []string{
        "Connecting via SSH...",
        "Installing docker...",
        "Writing docker-compose.yml...",
        "Pulling containers...",
        "Starting stack...",
    }
    for _, s := range steps {
        log(s)
        time.Sleep(2 * time.Second)
    }

    // mark success
    h.DB.Model(&models.Deployment{}).Where("id = ?", depID).Updates(map[string]any{
        "finished_at": time.Now().UTC(),
        "status":      "success",
    })
    log("DONE")
}
