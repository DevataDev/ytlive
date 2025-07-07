package handlers

import (
    "net/http"
    "time"

    "github.com/gin-gonic/gin"
    "gorm.io/gorm"

    "github.com/devatadev/ytlive/ops/backend/models"
)

// SecretHandler provides CRUD operations for Secret objects.
// All endpoints are protected by RequireAuth middleware.
// Only users with role "superadmin" are allowed to mutate secret data.
// Listing secrets never returns the decrypted value for security reasons.
// Create / Update accept a raw plaintext `value`, which is encrypted before persisting.
// Delete permanently removes the secret.
//
// Route table (mounted under protected API group):
//   GET    /secrets          -> List()
//   POST   /secrets          -> Create()
//   PUT    /secrets/:id      -> Update()
//   DELETE /secrets/:id      -> Delete()
//
// JSON payloads:
//   Create -> { "key": "FOO", "value": "bar" }
//   Update -> { "key": "FOO"?, "value": "newBar" }
// Responses never include `value`.
//
// Errors follow conventional REST semantics.

// SecretHandler struct.
type SecretHandler struct {
    DB            *gorm.DB
    EncryptionKey string
}

// NewSecretHandler instantiates the handler.
func NewSecretHandler(db *gorm.DB, key string) *SecretHandler {
    return &SecretHandler{DB: db, EncryptionKey: key}
}

// -------- Helpers --------
func (h *SecretHandler) denyUnlessSuperadmin(c *gin.Context) bool {
    role, _ := c.Get("role")
    if role != "superadmin" {
        c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
        return true
    }
    return false
}

// -------- Handlers --------

// List returns id, key, created_at for all secrets.
func (h *SecretHandler) List(c *gin.Context) {
    var secrets []models.Secret
    if err := h.DB.Select("id", "key", "created_at").Find(&secrets).Error; err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    // Build safe response (omit Value).
    type resp struct {
        ID        string    `json:"id"`
        Key       string    `json:"key"`
        CreatedAt time.Time `json:"created_at"`
    }
    out := make([]resp, len(secrets))
    for i, s := range secrets {
        out[i] = resp{ID: s.ID, Key: s.Key, CreatedAt: s.CreatedAt}
    }
    c.JSON(http.StatusOK, out)
}

// Create a new secret.
func (h *SecretHandler) Create(c *gin.Context) {
    if h.denyUnlessSuperadmin(c) {
        return
    }
    var req struct {
        Key   string `json:"key" binding:"required"`
        Value string `json:"value" binding:"required"`
    }
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    // Ensure key uniqueness
    var count int64
    h.DB.Model(&models.Secret{}).Where("key = ?", req.Key).Count(&count)
    if count > 0 {
        c.JSON(http.StatusConflict, gin.H{"error": "key already exists"})
        return
    }

    sec := models.Secret{Key: req.Key}
    if err := sec.Set(req.Value, h.EncryptionKey); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "encryption failed"})
        return
    }
    if err := h.DB.Create(&sec).Error; err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    c.JSON(http.StatusCreated, gin.H{"id": sec.ID, "key": sec.Key, "created_at": sec.CreatedAt})
}

// Update an existing secret.
func (h *SecretHandler) Update(c *gin.Context) {
    if h.denyUnlessSuperadmin(c) {
        return
    }
    id := c.Param("id")
    if id == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "id is required"})
        return
    }

    var req struct {
        Key   *string `json:"key"`
        Value *string `json:"value"`
    }
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    var sec models.Secret
    if err := h.DB.First(&sec, "id = ?", id).Error; err != nil {
        if err == gorm.ErrRecordNotFound {
            c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
        } else {
            c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        }
        return
    }

    if req.Key != nil {
        sec.Key = *req.Key
    }
    if req.Value != nil {
        if err := sec.Set(*req.Value, h.EncryptionKey); err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "encryption failed"})
            return
        }
    }

    if err := h.DB.Save(&sec).Error; err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    c.JSON(http.StatusOK, gin.H{"id": sec.ID, "key": sec.Key})
}

// Delete removes a secret.
func (h *SecretHandler) Delete(c *gin.Context) {
    if h.denyUnlessSuperadmin(c) {
        return
    }
    id := c.Param("id")
    if id == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "id is required"})
        return
    }
    if err := h.DB.Delete(&models.Secret{}, "id = ?", id).Error; err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    c.Status(http.StatusNoContent)
}
