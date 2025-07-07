package handlers

import (
	"net/http"
    "math/rand"
    ulid "github.com/oklog/ulid/v2"
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
    OSName        string  `json:"os_name"`
    UptimeSec     uint64  `json:"uptime_sec"`
    Load1         float64 `json:"load_1"`
    Load5         float64 `json:"load_5"`
    Load15        float64 `json:"load_15"`
}

// Heartbeat ingests metrics from an agent and updates the server row.
// Header: X-Agent-Key => maps to models.Server.AgentKey
// ulidString returns a new ULID string.
func ulidString() string {
    return ulid.MustNew(ulid.Now(), rand.New(rand.NewSource(time.Now().UnixNano()))).String()
}

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
            "os_name":       req.OSName,
            "agent_version": c.GetHeader("X-Agent-Version"),
			"status":         "online",
		})

	if result.Error != nil || result.RowsAffected == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid agent key"})
		return
	}

	// store per-heartbeat stats row
	var sid string
	h.DB.Raw("SELECT id FROM servers WHERE agent_key = ? LIMIT 1", key).Scan(&sid)
	if sid != "" {
		h.DB.Create(&models.ServerStat{
			ID:        ulidString(),
			ServerID:  sid,
			UptimeSec: req.UptimeSec,
			Load1:     req.Load1,
			Load5:     req.Load5,
			Load15:    req.Load15,
		})
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
     h.DB.Model(&models.Task{}).Where("id = ? AND server_id = ?", req.TaskID, srv.ID).Updates(map[string]any{
         "status": req.Status,
         "output": req.Output,
     })
     c.JSON(http.StatusOK, gin.H{"ok": true})
 }

 // ReportDocker ingests docker container list from agent
func (h *AgentHandler) ReportDocker(c *gin.Context) {
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
    var containers []models.Container
    if err := c.ShouldBindJSON(&containers); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    // attach server id, reset IDs if empty
    for i := range containers {
        containers[i].ServerID = srv.ID
        if containers[i].ID == "" {
            containers[i].BeforeCreate(nil)
        }
    }
    // replace rows for this server
    h.DB.Where("server_id = ?", srv.ID).Delete(&models.Container{})
    if len(containers) > 0 {
        h.DB.Create(&containers)
    }
    c.JSON(http.StatusOK, gin.H{"ok": true})
}

// ReportEnv ingests env vars from agent
func (h *AgentHandler) ReportEnv(c *gin.Context) {
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
    var kv map[string]string
    if err := c.ShouldBindJSON(&kv); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    h.DB.Where("server_id = ?", srv.ID).Delete(&models.EnvVar{})
    envs := make([]models.EnvVar, 0, len(kv))
    for k, v := range kv {
        envs = append(envs, models.EnvVar{ServerID: srv.ID, Key: k, Value: v})
    }
    if len(envs) > 0 {
        h.DB.Create(&envs)
    }
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

	var tasks []models.Task
    h.DB.Where("server_id = ? AND status = ?", srv.ID, "pending").Find(&tasks)
    // mark as sent
    if len(tasks) > 0 {
        ids := make([]string, 0, len(tasks))
        for _, t := range tasks { ids = append(ids, t.ID) }
        h.DB.Model(&models.Task{}).Where("id IN ?", ids).Update("status", "sent")
    }
    c.JSON(http.StatusOK, gin.H{"tasks": tasks})
}
