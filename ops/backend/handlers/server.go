package handlers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/devatadev/ytlive/ops/backend/models"
)

// ServerHandler groups server-related HTTP handlers.
// It depends on a Gorm DB instance and the symmetric
// encryption key used for protected fields (SSH password).
type ServerHandler struct {
	DB            *gorm.DB
	EncryptionKey string
}

// NewServerHandler returns a configured ServerHandler.
func NewServerHandler(db *gorm.DB, encKey string) *ServerHandler {
	return &ServerHandler{DB: db, EncryptionKey: encKey}
}

// createServerRequest represents the expected JSON payload for POST /servers.
type createServerRequest struct {
	Name        string `json:"name"        binding:"required,min=2,max=128"`
	Address     string `json:"address"     binding:"required,hostname|ipv4|ipv6"`
	SSHUser     string `json:"ssh_user"    binding:"required"`
	SSHPort     int    `json:"ssh_port"    binding:"omitempty,min=1,max=65535"`
	SSHPassword string `json:"ssh_password"` // optional, will be encrypted
	Domain      string `json:"domain" binding:"required,hostname"`
	SSHKeyPath  string `json:"ssh_key_path"` // optional alternative auth
}

// Create handles POST /servers. Only users with role=="admin" may call it.
func (h *ServerHandler) Create(c *gin.Context) {
	// Role is set by RequireAuth middleware.
	role, _ := c.Get("role")
	if role != "admin" && role != "superadmin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	var req createServerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.SSHPassword == "" && req.SSHKeyPath == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "either ssh_password or ssh_key_path is required"})
		return
	}

	srv := models.Server{
		Name:       req.Name,
		Address:    req.Address,
		Status:     "unknown", // will be updated by agent heartbeat
		SSHUser:    req.SSHUser,
		SSHPort:    req.SSHPort,
		Domain:     req.Domain,
		SSHKeyPath: req.SSHKeyPath,
	}

	if req.SSHPassword != "" {
		if err := srv.SetPassword(req.SSHPassword, h.EncryptionKey); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to encrypt password"})
			return
		}
	}

	if err := h.DB.Create(&srv).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, srv)
}

// Get handles GET /servers/:id and returns a single server
func (h *ServerHandler) Get(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id is required"})
		return
	}
	var srv models.Server
	if err := h.DB.First(&srv, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}
	c.JSON(http.StatusOK, srv)
}
