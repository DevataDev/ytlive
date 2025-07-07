package main

import (
	"log"
	"os"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/devatadev/ytlive/ops/backend/auth"
	"github.com/devatadev/ytlive/ops/backend/handlers"
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
	_ = db.AutoMigrate(&models.Server{}, &models.User{}, &models.Deployment{}, &models.Secret{}, &models.Task{}, &models.ServerStat{}, &models.Container{}, &models.EnvVar{})

	root, _ := os.Getwd()

	r := gin.Default()

	// agent endpoints (no JWT)
	agentHandler := handlers.NewAgentHandler(db)
	agent := r.Group("/agent")
	agent.POST("/heartbeat", agentHandler.Heartbeat)
	agent.GET("/tasks", agentHandler.Tasks)
	agent.POST("/tasks/result", agentHandler.TaskResult)
	agent.POST("/report/docker", agentHandler.ReportDocker)
	agent.POST("/report/env", agentHandler.ReportEnv)

	// websocket bridge
	shellWS := handlers.ShellWSHandler{DB: db}
	r.GET("/ws/shell", shellWS.Client) // JWT middleware could wrap externally
	r.GET("/agent/ws/shell", shellWS.Agent)

	// --- CORS configuration ---
	corsOrigins := strings.Split(os.Getenv("CORS_ORIGINS"), ",")
	corsConfig := cors.Config{
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}
	if len(corsOrigins) == 1 && corsOrigins[0] == "" {
		corsConfig.AllowAllOrigins = true
	} else {
		corsConfig.AllowOrigins = corsOrigins
	}
	r.Use(cors.New(corsConfig))

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
		// 24h cookie
		c.SetCookie("ops_jwt", token, 86400, "/", "", false, true)
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

	// --- Server routes ---
	encKey := os.Getenv("ENCRYPTION_KEY")
	srvHandler := handlers.NewServerHandler(db, encKey)

	api.POST("/servers", srvHandler.Create)
	api.GET("/servers/:id", srvHandler.Get)

	// docker & env routes
	deHandler := handlers.NewDockerEnvHandler(db)
	api.GET("/servers/:id/docker", deHandler.ListContainers)
	api.GET("/servers/:id/env", deHandler.ListEnv)

	// deployment routes
	depHandler := handlers.NewDeployHandler(db, encKey)
	api.POST("/servers/:id/deploy", depHandler.Start)
	api.GET("/deployments/:id/stream", depHandler.Stream)

	// cloudflare routes
	cfHandler := handlers.NewCloudflareHandler(db, encKey)
	r.GET("/cloudflare/zones", cfHandler.ListZones)

	// Agent binary download & deploy
	adHandler := handlers.NewAgentDeployHandler(root)
	r.GET("/downloads/agent/:arch", adHandler.Download)
	r.POST("/servers/:id/agent/deploy", adHandler.Deploy)
    r.GET("/agent-deploys/:id/stream", adHandler.Stream)
	api.POST("/cloudflare/zones/:id/dns", cfHandler.CreateDNS)

	// secret routes
	secretHandler := handlers.NewSecretHandler(db, encKey)
	api.GET("/secrets", secretHandler.List)
	api.POST("/secrets", secretHandler.Create)
	api.PUT("/secrets/:id", secretHandler.Update)
	api.DELETE("/secrets/:id", secretHandler.Delete)

	r.Run() // default :8080
}
