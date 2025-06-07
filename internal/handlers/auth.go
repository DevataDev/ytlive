package handlers

import (
	"net/http"
	"strings"

	"windsorf-youtube-live/internal/auth"
	"windsorf-youtube-live/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type AuthHandler struct {
	DB *gorm.DB
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	var user models.User
	if err := h.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
		return
	}
	if !auth.CheckPasswordHash(req.Password, user.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
		return
	}
	token, err := auth.GenerateJWT(user.ID, user.Email, user.IsAdmin)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not generate token"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": token})
}

// Logout endpoint (stateless, just for UI flow)
func (h *AuthHandler) Logout(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "logged out"})
}

// POST /api/refresh-token - refresh JWT token
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	token := c.GetHeader("Authorization")
	if token == "" {
		token = c.Query("token")
	}
	if strings.HasPrefix(token, "Bearer ") {
		token = strings.TrimPrefix(token, "Bearer ")
	}
	claims, err := auth.ParseJWTAllowExpired(token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
		return
	}
	// Optionally, you might want to check if user still exists/is active
	var user models.User
	if err := h.DB.First(&user, "id = ?", claims.UserID).Error; err != nil || !user.IsActive {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found or inactive"})
		return
	}
	// Issue new token
	tokenStr, err := auth.GenerateJWT(user.ID, user.Email, user.IsAdmin)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not generate token"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": tokenStr})
}

func JWTMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.GetHeader("Authorization")
		if token == "" {
			token = c.Query("token")
		}
		if strings.HasPrefix(token, "Bearer ") {
			token = strings.TrimPrefix(token, "Bearer ")
		}
		claims, err := auth.ParseJWT(token)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or missing token"})
			return
		}
		c.Set("user_id", claims.UserID)
		c.Set("email", claims.Email)
		c.Next()
	}
}
