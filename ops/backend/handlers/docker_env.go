package handlers

import (
    "github.com/gin-gonic/gin"
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
