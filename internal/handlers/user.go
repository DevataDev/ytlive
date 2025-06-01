package handlers

import (
	"log"
	"net/http"
	"strconv"

	"windsorf-youtube-live/internal/auth"
	"windsorf-youtube-live/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type UserHandler struct {
	DB *gorm.DB
}

// POST /api/users - create a new user (admin only)
func (h *UserHandler) CreateUser(c *gin.Context) {
	var req struct {
		Username string `json:"username"`
		Email    string `json:"email"`
		Password string `json:"password"`
		IsAdmin  bool   `json:"is_admin"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	userID, _ := c.Get("user_id")
	var loggedInUser models.User
	if err := h.DB.First(&loggedInUser, "id = ?", userID).Error; err != nil || !loggedInUser.IsAdmin {
		c.JSON(403, gin.H{"error": "Forbidden"})
		return
	}
	if req.Username == "" || req.Email == "" || req.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "All fields are required"})
		return
	}
	var existing models.User
	if err := h.DB.Where("username = ? OR email = ?", req.Username, req.Email).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User already exists"})
		return
	}
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}
	user := models.User{
		Username: req.Username,
		Email:    req.Email,
		Password: hash,
		IsAdmin:  req.IsAdmin,
		IsActive: true,
	}
	if err := h.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "User created"})
}

// GET /api/users - list users (admin only)
func (h *UserHandler) ListUsers(c *gin.Context) {
	userID, _ := c.Get("user_id")
	var user models.User
	if err := h.DB.First(&user, "id = ?", userID).Error; err != nil || !user.IsAdmin {
		c.JSON(403, gin.H{"error": "Forbidden"})
		return
	}

	// Pagination params
	page := 1
	perPage := 10
	if p := c.Query("page"); p != "" {
		if n, err := strconv.Atoi(p); err == nil && n > 0 {
			page = n
		}
	}
	if pp := c.Query("per_page"); pp != "" {
		if n, err := strconv.Atoi(pp); err == nil && n > 0 {
			perPage = n
		}
	}
	offset := (page - 1) * perPage
	search := c.Query("search")

	var total int64
	h.DB.Model(&models.User{}).Count(&total)

	var users []models.User
	if search != "" {
		if err := h.DB.Where("username LIKE ? OR email LIKE ?", "%"+search+"%", "%"+search+"%").Limit(perPage).Offset(offset).Find(&users).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
			return
		}
	} else {
		if err := h.DB.Limit(perPage).Offset(offset).Find(&users).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
			return
		}
	}
	// Hide password hashes
	var result []map[string]interface{}
	for _, u := range users {
		result = append(result, map[string]interface{}{
			"id":        u.ID,
			"username":  u.Username,
			"email":     u.Email,
			"is_admin":  u.IsAdmin,
			"is_active": u.IsActive,
		})
	}
	c.JSON(http.StatusOK, gin.H{"users": result, "page": page, "per_page": perPage, "total": total})
}

// PUT /api/users/username/:username/password - update a user's password (admin only)
func (h *UserHandler) UpdateUserPassword(c *gin.Context) {
	username := c.Param("username")
	var req struct {
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	userID, ok := c.Get("user_id")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	var loggedInUser models.User
	log.Println(userID)
	if err := h.DB.First(&loggedInUser, "id = ?", userID).Error; err != nil || !loggedInUser.IsAdmin {
		c.JSON(403, gin.H{"error": "Forbidden"})
		return
	}
	var user models.User
	if err := h.DB.Where("username = ?", username).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}
	user.Password = hash
	if err := h.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update password"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Password updated"})
}

func (h *UserHandler) UpdateUserAdminStatus(c *gin.Context) {
	userID, _ := c.Get("user_id")
	var user models.User
	if err := h.DB.First(&user, "id = ?", userID).Error; err != nil || !user.IsAdmin {
		c.JSON(403, gin.H{"error": "Forbidden"})
		return
	}
	id := c.Param("id")
	var req struct {
		IsAdmin bool `json:"is_admin"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request"})
		return
	}
	if err := h.DB.Model(&models.User{}).Where("id = ?", id).Update("is_admin", req.IsAdmin).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to update admin status"})
		return
	}
	c.JSON(200, gin.H{"success": true})
}

func (h *UserHandler) UpdateUserActiveStatus(c *gin.Context) {
	userID, _ := c.Get("user_id")
	var user models.User
	if err := h.DB.First(&user, "id = ?", userID).Error; err != nil || !user.IsAdmin {
		c.JSON(403, gin.H{"error": "Forbidden"})
		return
	}
	id := c.Param("id")
	var req struct {
		IsActive bool `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request"})
		return
	}
	if err := h.DB.Model(&models.User{}).Where("id = ?", id).Update("is_active", req.IsActive).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to update active status"})
		return
	}
	c.JSON(200, gin.H{"success": true})
}

func (h *UserHandler) DeleteUser(c *gin.Context) {
	userID, _ := c.Get("user_id")
	var user models.User
	if err := h.DB.First(&user, "id = ?", userID).Error; err != nil || !user.IsAdmin {
		c.JSON(403, gin.H{"error": "Forbidden"})
		return
	}
	id := c.Param("id")
	if err := h.DB.Delete(&models.User{}, "id = ?", id).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to delete user"})
		return
	}
	c.JSON(200, gin.H{"success": true})
}
