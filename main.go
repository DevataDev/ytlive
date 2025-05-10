package main

import (
	"context"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"windsorf-youtube-live/internal/auth"
	"windsorf-youtube-live/internal/cache"
	config "windsorf-youtube-live/internal/configuration"
	"windsorf-youtube-live/internal/handlers"
	"windsorf-youtube-live/internal/job"
	"windsorf-youtube-live/internal/models"
	"windsorf-youtube-live/internal/tiktok"
	"windsorf-youtube-live/internal/version"
	"windsorf-youtube-live/internal/workers"

	"gorm.io/driver/mysql"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"github.com/gin-gonic/gin"
	"gopkg.in/yaml.v3"

	"embed"

	"windsorf-youtube-live/internal/broadcast"
)

//go:embed web/static/* web/static
var StaticFiles embed.FS

var (
	ctx               = context.Background()
	database *gorm.DB = nil
)

func loadConfig(path string) (*config.Config, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	var cfg config.Config
	dec := yaml.NewDecoder(f)
	if err := dec.Decode(&cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}

func main() {
	cfg, err := loadConfig("config.yaml")
	if err != nil {
		panic(fmt.Sprintf("failed to read config.yaml: %v", err))
	}

	var db *gorm.DB
	var dbErr error

	cache := cache.NewInMemoryCache()

	if cfg.App.Sql == "mysql" {
		dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?%s", cfg.MySQL.User, cfg.MySQL.Password, cfg.MySQL.Host, cfg.MySQL.Port, cfg.MySQL.DBName, cfg.MySQL.Params)
		fmt.Println("Connecting to MySQL with DSN:", dsn)
		db, dbErr = gorm.Open(mysql.Open(dsn), &gorm.Config{})
	} else if cfg.App.Sql == "sqlite3" {
		// check if db file exists
		if _, err := os.Stat(cfg.Sqlite.Db); os.IsNotExist(err) {
			// create db file
			_, err := os.Create(cfg.Sqlite.Db)
			if err != nil {
				panic(fmt.Sprintf("failed to create database file: %v", err))
			}
		}
		db, dbErr = gorm.Open(sqlite.Open(cfg.Sqlite.Db), &gorm.Config{})
	} else {
		panic(fmt.Sprintf("Invalid SQL type: %s", cfg.App.Sql))
	}

	database = db

	// fix column typo for stream table
	// check if column `loop_count,default:-1` exists
	if db.Migrator().HasColumn(&models.Stream{}, "loop_count,default:-1") {
		db.Migrator().RenameColumn(&models.Stream{}, "loop_count,default:-1", "loop_count")
	}
	// check if column `loop_video,default:true` exists
	if db.Migrator().HasColumn(&models.Stream{}, "loop_video,default:true") && !db.Migrator().HasColumn(&models.Stream{}, "loop_video") {
		db.Migrator().RenameColumn(&models.Stream{}, "loop_video,default:true", "loop_video")
	}

	if dbErr != nil {
		log.Fatalf("failed to connect to DB: %v", err)
	}
	// Auto-migrate user table
	err = db.AutoMigrate(&models.User{})
	if err != nil {
		log.Fatalf("failed to migrate user table: %v", err)
	}

	// Auto-migrate stream table
	err = db.AutoMigrate(&models.Stream{})
	if err != nil {
		log.Fatalf("failed to migrate stream table: %v", err)
	}

	// Auto-migrate mirror table
	err = db.AutoMigrate(&models.Mirror{})
	if err != nil {
		log.Fatalf("failed to migrate mirror table: %v", err)
	}

	// Auto-migrate monitor table
	err = db.AutoMigrate(&models.Monitor{})
	if err != nil {
		log.Fatalf("failed to migrate monitor table: %v", err)
	}

	// Auto-migrate channels table
	err = db.AutoMigrate(&models.Channels{})
	if err != nil {
		log.Fatalf("failed to migrate channels table: %v", err)
	}

	// Init device presets
	tiktok.InitDevicePresets()

	// Create default user if not exists
	var defaultUser models.User
	if err := db.Where("email = ?", "admin@yuklive.id").First(&defaultUser).Error; err == gorm.ErrRecordNotFound {
		hashed, _ := auth.HashPassword(cfg.Default.Password)
		defaultUser = models.User{
			Username: "admin",
			Email:    "admin@yuklive.id",
			Password: hashed,
			IsActive: true,
			IsAdmin:  true,
		}
		db.Create(&defaultUser)
	}

	if cfg.App.Mode == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	broadcast.Bus.AddListener("default", broadcast.RefreshStream, func(e broadcast.Event) {
		handlers.BroadcastStreamListUpdate()
	})

	r := gin.Default()

	// Replace static file serving with embedded static files
	staticFS, _ := fs.Sub(StaticFiles, "web/static")
	r.StaticFS("/static", http.FS(staticFS))

	// serve uploads folder
	// server ./uploads
	// uploadsFS, _ := fs.Sub(StaticFiles, "uploads")
	r.StaticFS("/uploads", http.Dir("uploads"))

	r.GET("/stream", func(c *gin.Context) {
		// replace it with static embedded file stream-list.html
		staticFs, _ := fs.Sub(StaticFiles, "web/static")
		c.FileFromFS("/stream-list.html", http.FS(staticFs))
	})

	// Dashboard endpoints (JWT protected)
	r.GET("/dashboard", func(c *gin.Context) {
		staticFs, _ := fs.Sub(StaticFiles, "web/static")
		c.FileFromFS("/dashboard.html", http.FS(staticFs))
	})

	// Serve the upload page at /upload
	r.GET("/upload", func(c *gin.Context) {
		staticFs, _ := fs.Sub(StaticFiles, "web/static")
		c.FileFromFS("/upload.html", http.FS(staticFs))
	})

	r.GET("/users", func(c *gin.Context) {
		staticFs, _ := fs.Sub(StaticFiles, "web/static")
		c.FileFromFS("/user-management.html", http.FS(staticFs))
	})

	// Monitor Management Page
	r.GET("/monitor", func(c *gin.Context) {
		staticFS, _ := fs.Sub(StaticFiles, "web/static")
		c.FileFromFS("/monitor-management.html", http.FS(staticFS))
	})

	// Mirror page
	r.GET("/mirror", func(c *gin.Context) {
		staticFs, _ := fs.Sub(StaticFiles, "web/static")
		c.FileFromFS("/mirror-list.html", http.FS(staticFs))
	})

	// Live page
	r.GET("/live", func(c *gin.Context) {
		staticFs, _ := fs.Sub(StaticFiles, "web/static")
		c.FileFromFS("/live-list.html", http.FS(staticFs))
	})

	// Search page
	r.GET("/search", func(c *gin.Context) {
		staticFs, _ := fs.Sub(StaticFiles, "web/static")
		c.FileFromFS("/search-list.html", http.FS(staticFs))
	})

	// Channels page
	r.GET("/channels", func(c *gin.Context) {
		staticFs, _ := fs.Sub(StaticFiles, "web/static")
		c.FileFromFS("/channels-management.html", http.FS(staticFs))
	})

	// Privacy Policy page
	r.GET("/privacy", func(c *gin.Context) {
		staticFs, _ := fs.Sub(StaticFiles, "web/static")
		c.FileFromFS("/privacy.html", http.FS(staticFs))
	})

	// Terms & Conditions page
	r.GET("/terms", func(c *gin.Context) {
		staticFs, _ := fs.Sub(StaticFiles, "web/static")
		c.FileFromFS("/terms.html", http.FS(staticFs))
	})

	//callback
	r.GET("/youtube/callback", func(c *gin.Context) {
		staticFs, _ := fs.Sub(StaticFiles, "web/static")
		c.FileFromFS("/callback.html", http.FS(staticFs))
	})

	r.GET("/", func(c *gin.Context) {
		// check if user is logged in
		_, exists := c.Get("user_id")
		if exists {
			// redirect to dashboard
			c.Redirect(http.StatusSeeOther, "/dashboard")
		} else {
			// redirect to login
			c.Redirect(http.StatusSeeOther, "/login")
		}
	})

	r.GET("/login", func(c *gin.Context) {
		// check if user is logged in
		_, exists := c.Get("user_id")
		if exists {
			// redirect to dashboard
			c.Redirect(http.StatusSeeOther, "/dashboard")
		} else {
			staticFs, _ := fs.Sub(StaticFiles, "web/static")
			c.FileFromFS("/login.html", http.FS(staticFs))
		}
	})

	// Auth handler
	authHandler := &handlers.AuthHandler{DB: db}
	r.POST("/api/login", authHandler.Login)
	r.POST("/api/logout", authHandler.Logout)
	r.POST("/api/refresh-token", authHandler.RefreshToken)

	// Stream handler
	streamHandler := &handlers.StreamHandler{DB: db}
	fileUploadHandler := &handlers.FileUploadHandler{DB: db, Config: cfg}
	// Set max bitrate endpoint
	r.PUT("/api/streams/:id/maxbitrate", handlers.JWTMiddleware(), streamHandler.SetMaxBitrate)
	r.GET("/api/streams", handlers.JWTMiddleware(), streamHandler.ListStreams)
	r.POST("/api/streams", handlers.JWTMiddleware(), streamHandler.CreateStream)
	r.PUT("/api/streams/:id/schedule", handlers.JWTMiddleware(), streamHandler.SetSchedule)
	r.PUT("/api/streams/:id/rename", handlers.JWTMiddleware(), streamHandler.RenameFile)
	r.PUT("/api/streams/:id/duration", handlers.JWTMiddleware(), streamHandler.SetDuration)
	r.GET("/api/streams/preview/:id", streamHandler.ServeVideoPreviewByID)
	r.PUT("/api/streams/:id/loop", handlers.JWTMiddleware(), streamHandler.SetLoopVideo)
	r.PUT("/api/streams/:id/loopcount", handlers.JWTMiddleware(), streamHandler.SetLoopCount)
	r.PUT("/api/streams/:id/rtmpurl", handlers.JWTMiddleware(), streamHandler.SetRTMPUrl)
	r.POST("/api/streams/:id/clone", handlers.JWTMiddleware(), streamHandler.CloneStream)

	dashboardHandler := &handlers.DashboardHandler{DB: db}
	r.GET("/api/dashboard/streams", handlers.JWTMiddleware(), dashboardHandler.GetDashboardStreamMetrics)
	r.GET("/api/dashboard/metrics", handlers.JWTMiddleware(), dashboardHandler.GetDashboardSystemMetrics)

	// Handle video upload (file or Google Drive link)
	r.POST("/api/streams/upload", handlers.JWTMiddleware(), fileUploadHandler.UploadStream)

	r.GET("/api/streams/upload/progress", streamHandler.GetDriveUploadProgress)

	downloadHandler := &handlers.DownloadHandler{DB: db}
	// Download uploaded video by stream ID
	r.GET("/api/streams/:id/download", handlers.JWTMiddleware(), downloadHandler.DownloadStream)

	// Set or update StreamKey for a stream
	r.PUT("/api/streams/:id/streamkey", handlers.JWTMiddleware(), streamHandler.SaveStreamKey)

	// Start live stream (FFmpeg goroutine) handler
	r.POST("/api/streams/:id/start", handlers.JWTMiddleware(), streamHandler.StartStreamBackground)

	// Stop live stream (FFmpeg goroutine) handler
	r.POST("/api/streams/:id/stop", handlers.JWTMiddleware(), streamHandler.StopStreamBackground)

	// DELETE /api/streams/:id endpoint
	r.DELETE("/api/streams/:id", handlers.JWTMiddleware(), streamHandler.DeleteStream)

	r.PUT("/api/streams/:id/channel-id", handlers.JWTMiddleware(), streamHandler.UpdateStreamChannelId)

	// User management endpoints
	userHandler := &handlers.UserHandler{DB: db}
	r.GET("/api/users", handlers.JWTMiddleware(), userHandler.ListUsers)
	r.POST("/api/users", handlers.JWTMiddleware(), userHandler.CreateUser)
	r.PUT("/api/users/username/:username/password", handlers.JWTMiddleware(), userHandler.UpdateUserPassword)

	r.PUT("/api/users/:id/admin", handlers.JWTMiddleware(), userHandler.UpdateUserAdminStatus)

	r.PUT("/api/users/:id/active", handlers.JWTMiddleware(), userHandler.UpdateUserActiveStatus)

	r.DELETE("/api/users/:id", handlers.JWTMiddleware(), userHandler.DeleteUser)

	tiktokUserAgent := "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
	if cfg.TikTok.UserAgent != "" {
		tiktokUserAgent = cfg.TikTok.UserAgent
	}

	tiktokCookie := ""
	if cfg.TikTok.Cookie != "" {
		tiktokCookie = cfg.TikTok.Cookie
	}
	// Mirror API
	tiktokClient := tiktok.NewClient(*cfg)
	tiktokClient.WithRegion("id")
	tiktokClient.WithUserAgent(tiktokUserAgent)
	if tiktokCookie != "" {
		tiktokClient.WithCookie(tiktokCookie)
	}
	mirrorHandler := handlers.MirrorHandler{DB: db, TikTok: tiktokClient, Bus: broadcast.Bus}
	r.GET("/api/mirrors", handlers.JWTMiddleware(), mirrorHandler.ListMirrors)
	r.POST("/api/mirrors", handlers.JWTMiddleware(), mirrorHandler.AddMirror)
	r.POST("/api/mirrors/:id/start", handlers.JWTMiddleware(), mirrorHandler.StartMirror)
	r.POST("/api/mirrors/:id/stop", handlers.JWTMiddleware(), mirrorHandler.StopMirror)
	r.DELETE("/api/mirrors/:id", handlers.JWTMiddleware(), mirrorHandler.DeleteMirror)
	r.PUT("/api/mirrors/:id/rtmp-url", handlers.JWTMiddleware(), mirrorHandler.UpdateMirrorRTMPUrl)
	r.PUT("/api/mirrors/:id/stream-key", handlers.JWTMiddleware(), mirrorHandler.UpdateMirrorStreamKey)
	r.PUT("/api/mirrors/:id/channel-id", handlers.JWTMiddleware(), mirrorHandler.UpdateMirrorChannelId)

	broadcast.Bus.AddListener("default", broadcast.AddToMirror, func(e broadcast.Event) {
		fmt.Println("Adding to mirror", e.Data)
		data, ok := e.Data.(map[string]interface{})
		if !ok {
			fmt.Println("Failed to add to mirror, invalid data type")
			return
		}
		mirrorHandler.AddMirrorFromBroadcast(data["username"].(string), data["user_id"].(string), data["rtmp_url"].(string), data["stream_key"].(string))
	})

	broadcast.Bus.AddListener("default", broadcast.RefreshMonitor, func(e broadcast.Event) {
		data, ok := e.Data.(map[string]interface{})
		if !ok {
			fmt.Println("Failed to refresh monitor, invalid data type")
			return
		}
		handlers.BroadcastMonitorUpdate(data["id"].(string), data["unique_id"].(string), data["is_live"].(bool))
	})

	tiktokHandler := handlers.TiktokHandler{DB: db, TikTokClient: tiktokClient, Cache: cache}
	// -- Tiktok Start --
	r.GET("/api/tiktok/get-room-from-user", tiktokHandler.GetRoomFromUser)

	r.GET("/api/tiktok/room-info", tiktokHandler.GetRoomInfo)

	r.GET("/api/tiktok/check-room-is-alive", tiktokHandler.CheckRoomIsAlive)

	r.GET("/api/tiktok/get-live-url", tiktokHandler.GetLiveUrl)

	r.GET("/api/tiktok/live-feed", tiktokHandler.GetLiveFeed)

	r.POST("/api/tiktok/search", tiktokHandler.Search)

	r.GET("/api/tiktok/suggested-feed", tiktokHandler.GetSuggestedFeed)
	// -- Tiktok End --

	// -- Youtube start --
	youtubeHandler := handlers.NewYoutubeHandler(db, cfg)
	r.GET("/api/youtube/list-channels", handlers.JWTMiddleware(), youtubeHandler.ListChannels)
	r.GET("/api/youtube/authorize", handlers.JWTMiddleware(), youtubeHandler.StartYouTubeOAuth)
	r.GET("/api/youtube/callback", youtubeHandler.YouTubeOAuthCallback)
	r.POST("/api/youtube/create-live-broadcast", handlers.JWTMiddleware(), youtubeHandler.CreateYoutubeLiveBroadcast)
	r.DELETE("/api/youtube/channels/:id", handlers.JWTMiddleware(), youtubeHandler.DeleteChannel)
	r.GET("/api/youtube/channel/:id/streams", handlers.JWTMiddleware(), youtubeHandler.ListStreamsByChannel)
	// r.POST("/api/youtube/create-live-stream", handlers.JWTMiddleware(), youtubeHandler.CreateYoutubeLiveStream)

	monitorHandler := handlers.MonitorHandler{DB: db}
	r.POST("/api/monitors", handlers.JWTMiddleware(), monitorHandler.AddMonitor)
	r.GET("/api/monitors", handlers.JWTMiddleware(), monitorHandler.ListMonitors)
	r.DELETE("/api/monitors", handlers.JWTMiddleware(), monitorHandler.RemoveMonitor)
	r.PUT("/api/monitors/:id/rtmp-url", handlers.JWTMiddleware(), monitorHandler.UpdateMonitorRTMPUrl)
	r.PUT("/api/monitors/:id/stream-key", handlers.JWTMiddleware(), monitorHandler.UpdateMonitorStreamKey)
	r.PUT("/api/monitors/:id/channel-id", handlers.JWTMiddleware(), monitorHandler.UpdateMonitorChannelId)

	tiktokSignHandler := handlers.NewTiktokSignHandler(cfg)
	r.POST("/api/tiktok/sign", tiktokSignHandler.Sign)

	r.GET("/api/version", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"version": version.Version,
			"commit":  version.Commit,
			"date":    version.Date,
		})
	})

	liveWorker := workers.NewLiveWorker(tiktokClient, db, broadcast.Bus)
	liveWorker.StartUserMonitoring()

	tokenWorker := workers.NewRefresherTokenWorker(cfg, db)
	go tokenWorker.Run()

	// Periodically broadcast server metrics to all websocket clients
	go func() {
		for {
			handlers.BroadcastDashboardMetrics()
			time.Sleep(2 * time.Second)
		}
	}()

	// Start background goroutine for broadcasting stream stats
	go handlers.BroadcastStreamStats()

	streamWorker := workers.NewStreamWorker(db, cfg)

	// -- Stream Worker: Monitor stream status --
	go streamWorker.StartMonitorStream()

	go streamWorker.StartScheduledStream()

	// one time restarter
	go streamWorker.StartOneTimeRestarter()

	mirrorWorker := workers.NewMirrorWorker(db, tiktokClient)
	go mirrorWorker.StartMirrorRoomIsAliveChecker()
	go mirrorWorker.StartQueueChecker()

	// Create a context that is cancelled on SIGINT/SIGTERM
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	r.GET("/ws", func(c *gin.Context) {
		// WebSocket: check JWT token in query param
		token := c.Query("token")
		_, err := auth.ParseJWT(token)
		if err != nil {
			c.AbortWithStatusJSON(401, gin.H{"error": "unauthorized"})
			return
		}
		handlers.WebSocketHandlerWithContext(ctx, c)
	})

	fmt.Println("Starting YukLive...")
	fmt.Println("Version: " + version.Version)
	fmt.Println("Commit: " + version.Commit)
	fmt.Println("Date: " + version.Date)

	server := &http.Server{
		Addr:    fmt.Sprintf("%s:%d", cfg.App.Host, cfg.App.Port),
		Handler: r,
	}

	fmt.Println("Server started at http://" + cfg.App.Host + ":" + fmt.Sprintf("%d", cfg.App.Port))
	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %s\n", err)
		}
	}()

	// Wait for interrupt
	<-ctx.Done()
	log.Println("Shutting down server...")

	// Kill all running stream workers (FFmpeg processes)
	log.Println("Killing all running stream workers...")
	for id := range job.Workers {
		log.Println("Killing stream worker for stream", id)
		_ = job.StopStreamWorker(id)
	}

	server.Shutdown(context.Background())
}
