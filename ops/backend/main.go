package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/devatadev/ytlive/ops/backend/auth"
	"github.com/devatadev/ytlive/ops/backend/middleware"
	"github.com/devatadev/ytlive/ops/backend/models"
)

func main() {
	_ = godotenv.Load()
	dsn := os.Getenv("POSTGRES_DSN")
	if dsn == "" {
		log.Fatal("POSTGRES_DSN not set")
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("failed to connect database: ", err)
	}
	_ = db.AutoMigrate(&models.Server{}, &models.User{})

	r := gin.Default()

	// --- Auth routes ---
	authGroup := r.Group("/auth")
	authGroup.POST("/login", func(c *gin.Context) {
		var req struct {
			Email    string `json:"email"`
			Password string `json:"password"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "invalid payload"})
			return
		}
		var u models.User
		if err := db.Where("email = ?", req.Email).First(&u).Error; err != nil {
			c.JSON(401, gin.H{"error": "invalid credentials"})
			return
		}
		if !u.CheckPassword(req.Password) {
			c.JSON(401, gin.H{"error": "invalid credentials"})
			return
		}
		token, _ := auth.Generate(u.ID, u.Role)
		c.JSON(200, gin.H{"token": token})
	})

	// --- Protected routes ---
	api := r.Group("/")
	api.Use(middleware.RequireAuth())

	api.GET("/servers", func(c *gin.Context) {
		var servers []models.Server
		db.Find(&servers)
		c.JSON(200, servers)
	})

	api.POST("/servers", func(c *gin.Context) {
		var s models.Server
		if err := c.ShouldBindJSON(&s); err != nil {
			c.JSON(400, gin.H{"error": err.Error()})
			return
		}
		if s.ID == "" {
			c.JSON(400, gin.H{"error": "id is required"})
			return
		}
		db.Create(&s)
		c.JSON(201, s)
	})

	r.Run() // default :8080
}
