package handlers

import (
	"encoding/json"
	"math/rand"
	"time"

	"github.com/gin-gonic/gin"
	ulid "github.com/oklog/ulid/v2"
	"gorm.io/gorm"

	"github.com/devatadev/ytlive/ops/backend/models"
)

// DockerEnvHandler groups handlers for docker containers and env vars.
type DockerEnvHandler struct {
	DB *gorm.DB
}

func NewDockerEnvHandler(db *gorm.DB) *DockerEnvHandler {
	return &DockerEnvHandler{DB: db}
}

// UpdateContainer creates a docker_update task for the agent to pull image and restart container
func (h *DockerEnvHandler) UpdateContainer(c *gin.Context) {
	serverID := c.Param("id")
	var req struct {
		Image     string `json:"image" binding:"required"`
		Container string `json:"container" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	dataBytes, _ := json.Marshal(map[string]string{"image": req.Image, "container": req.Container})
	task := models.Task{
		ID:       ulid.MustNew(ulid.Now(), rand.New(rand.NewSource(time.Now().UnixNano()))).String(),
		ServerID: serverID,
		Type:     "docker_update",
		Data:     string(dataBytes),
		Status:   "pending",
	}
	if err := h.DB.Create(&task).Error; err != nil {
		c.JSON(500, gin.H{"error": "db error"})
		return
	}
	c.JSON(200, gin.H{"ok": true, "task_id": task.ID})
}

// ListContainers returns containers for a server
func (h *DockerEnvHandler) ListContainers(c *gin.Context) {
	serverID := c.Param("id")
	var containers []models.Container
	if err := h.DB.Where("server_id = ?", serverID).Find(&containers).Error; err != nil {
		c.JSON(500, gin.H{"error": "db error"})
		return
	}
	c.JSON(200, containers)
}

// ListEnv returns env vars/config for a server
func (h *DockerEnvHandler) ListEnv(c *gin.Context) {
	serverID := c.Param("id")
	var envs []models.EnvVar
	if err := h.DB.Where("server_id = ?", serverID).Find(&envs).Error; err != nil {
		c.JSON(500, gin.H{"error": "db error"})
		return
	}
	// transform to key-value map for easier frontend consumption
	m := make(map[string]string, len(envs))
	for _, e := range envs {
		m[e.Key] = e.Value
	}
	c.JSON(200, m)
}
