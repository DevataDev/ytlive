package handlers

import (
	"net/http"
    "log"
	"time"

	"github.com/devatadev/ytlive/ops/backend/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// AgentHandler exposes endpoints consumed by the edge agent (heartbeat & task polling).
// These endpoints are NOT protected by the JWT middleware; instead the agent
// authenticates using the unique X-Agent-Key request header.
type AgentHandler struct {
	DB *gorm.DB
}

func NewAgentHandler(db *gorm.DB) *AgentHandler {
	return &AgentHandler{DB: db}
}

// heartbeatRequest matches the JSON body the agent posts every interval.
// Keep fields optional so the agent can evolve without breaking older versions.
type heartbeatRequest struct {
	CPUPercent    float64 `json:"cpu_percent"`
	MemUsedMB     uint64  `json:"mem_used_mb"`
	DiskUsedMB    uint64  `json:"disk_used_mb"`
	NetMbps       float64 `json:"net_mbps"`
	StreamsTotal  int     `json:"streams_total"`
	StreamsActive int     `json:"streams_active"`
	StreamsSched  int     `json:"streams_scheduled"`
}

// Heartbeat ingests metrics from an agent and updates the server row.
// Header: X-Agent-Key => maps to models.Server.AgentKey
func (h *AgentHandler) Heartbeat(c *gin.Context) {
	key := c.GetHeader("X-Agent-Key")
	if key == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing agent key"})
		return
	}

	var req heartbeatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// update server
	result := h.DB.Model(&models.Server{}).
		Where("agent_key = ?", key).
		Updates(map[string]any{
			"last_seen":      time.Now().UTC(),
			"cpu_percent":    req.CPUPercent,
			"mem_used_mb":    req.MemUsedMB,
			"disk_used_mb":   req.DiskUsedMB,
			"net_mbps":       req.NetMbps,
			"streams_total":  req.StreamsTotal,
			"streams_active": req.StreamsActive,
			"streams_sched":  req.StreamsSched,
			"status":         "online",
		})

	if result.Error != nil || result.RowsAffected == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid agent key"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// Tasks returns pending tasks for the agent. For now this is a stub that returns
// an empty list. Future versions will query a tasks table.
type task struct {
	ID   string `json:"id"`
	Type string `json:"type"`
	Data any    `json:"data"`
}

// TaskResultRequest is payload sent by agent after executing a task
 type TaskResultRequest struct {
     TaskID string `json:"task_id" binding:"required"`
     Status string `json:"status" binding:"required"` // ok or error
     Output string `json:"output"`
 }

 // TaskResult stores execution result from agent
 func (h *AgentHandler) TaskResult(c *gin.Context) {
     key := c.GetHeader("X-Agent-Key")
     if key == "" {
         c.JSON(http.StatusUnauthorized, gin.H{"error": "missing agent key"})
         return
     }
     var srv models.Server
     if err := h.DB.First(&srv, "agent_key = ?", key).Error; err != nil {
         c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid agent key"})
         return
     }
     var req TaskResultRequest
     if err := c.ShouldBindJSON(&req); err != nil {
         c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
         return
     }
     // TODO: save result to DB table; for now just log
     log.Printf("task result server=%s task=%s status=%s", srv.ID, req.TaskID, req.Status)
     c.JSON(http.StatusOK, gin.H{"ok": true})
 }

 func (h *AgentHandler) Tasks(c *gin.Context) {
	key := c.GetHeader("X-Agent-Key")
	if key == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing agent key"})
		return
	}

	var srv models.Server
	if err := h.DB.First(&srv, "agent_key = ?", key).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid agent key"})
		return
	}

	// TODO: fetch real tasks. Empty list for now.
	c.JSON(http.StatusOK, gin.H{"tasks": []task{}})
}
