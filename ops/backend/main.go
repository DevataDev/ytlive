package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type Server struct {
	ID      string `json:"id" gorm:"primaryKey"`
	Name    string `json:"name"`
	Address string `json:"address"`
	Status  string `json:"status"`
}

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
	_ = db.AutoMigrate(&Server{})

	r := gin.Default()

	r.GET("/servers", func(c *gin.Context) {
		var servers []Server
		db.Find(&servers)
		c.JSON(200, servers)
	})

	r.POST("/servers", func(c *gin.Context) {
		var s Server
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
