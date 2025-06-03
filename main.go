package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"windsorf-youtube-live/internal/auth"
	"windsorf-youtube-live/internal/cache"
	config "windsorf-youtube-live/internal/configuration"
	"windsorf-youtube-live/internal/handlers"
	"windsorf-youtube-live/internal/job"
	"windsorf-youtube-live/internal/models"
	"windsorf-youtube-live/internal/redisutil"
	"windsorf-youtube-live/internal/tiktok"
	"windsorf-youtube-live/internal/utils"
	"windsorf-youtube-live/internal/version"
	"windsorf-youtube-live/internal/workers"

	"gorm.io/driver/mysql"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"github.com/gin-gonic/gin"
	"gopkg.in/natefinch/lumberjack.v2"
	"gopkg.in/yaml.v3"

	"windsorf-youtube-live/internal/broadcast"
)

var (
	ctx                         = context.Background()
	database *gorm.DB           = nil
	logger   *lumberjack.Logger = &lumberjack.Logger{
		Filename:   "logs/app.log",
		MaxSize:    15,
		MaxBackups: 2,
		MaxAge:     2,
	}
)

func loadConfig(path string) (*config.Config, error) {
	// If path is not absolute, search in standard locations
	if !filepath.IsAbs(path) {
		// Try paths in order of preference:
		// 1. Current directory (for backward compatibility)
		// 2. $XDG_CONFIG_HOME/windsorf/config.yaml
		// 3. /etc/windsorf/config.yaml
		// 4. $HOME/.config/windsorf/config.yaml

		xdgConfigHome := os.Getenv("XDG_CONFIG_HOME")
		if xdgConfigHome == "" {
			home, err := os.UserHomeDir()
			if err != nil {
				return nil, fmt.Errorf("failed to get user home directory: %w", err)
			}
			xdgConfigHome = filepath.Join(home, ".config")
		}

		possiblePaths := []string{
			path, // Original path (current directory)
			filepath.Join(xdgConfigHome, "ytlive", "config.yaml"),
			"/etc/ytlive/config.yaml",
			filepath.Join(xdgConfigHome, "ytlive", "config.yml"),
			"/etc/ytlive/config.yml",
			"/opt/ytlive/config.yaml",
			"/opt/ytlive/config.yml",
		}

		var configFile string
		for _, p := range possiblePaths {
			if _, err := os.Stat(p); err == nil {
				configFile = p
				log.Printf("Using config file: %s\n", configFile)
				break
			}
		}

		if configFile == "" {
			return nil, fmt.Errorf("config file not found in any of these locations: %v", possiblePaths)
		}
		path = configFile
	}

	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("failed to open config file %s: %w", path, err)
	}
	defer f.Close()

	var cfg config.Config
	dec := yaml.NewDecoder(f)
	if err := dec.Decode(&cfg); err != nil {
		return nil, fmt.Errorf("failed to decode config file %s: %w", path, err)
	}
	return &cfg, nil
}

// closeDB closes the database connection
func closeDB(db *gorm.DB, cfg *config.Config) {
	if db == nil {
		return
	}

	sqlDB, err := db.DB()
	if err != nil {
		log.Printf("Error getting database instance: %v", err)
		return
	}

	// Try to gracefully close the database
	err = sqlDB.Close()
	if err != nil {
		log.Printf("Error closing database: %v", err)
	}

	// Additional cleanup for SQLite WAL files
	if cfg != nil && cfg.App.Sql == "sqlite3" {
		// Remove WAL and SHM files if they exist
		walFile := cfg.Sqlite.Db + "-wal"
		shmFile := cfg.Sqlite.Db + "-shm"

		if _, err := os.Stat(walFile); err == nil {
			if err := os.Remove(walFile); err != nil {
				log.Printf("Error removing WAL file: %v", err)
			}
		}
		if _, err := os.Stat(shmFile); err == nil {
			if err := os.Remove(shmFile); err != nil {
				log.Printf("Error removing SHM file: %v", err)
			}
		}
	}
}

func main() {
	cfg, err := loadConfig("config.yaml")
	if err != nil {
		panic(fmt.Sprintf("failed to read config.yaml: %v", err))
	}

	// Ensure database connection is closed on exit
	defer func() {
		if database != nil {
			closeDB(database, cfg)
		}
	}()

	var db *gorm.DB
	var dbErr error

	cache := cache.NewInMemoryCache()

	if cfg.App.Sql == "mysql" {
		dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?%s", cfg.MySQL.User, cfg.MySQL.Password, cfg.MySQL.Host, cfg.MySQL.Port, cfg.MySQL.DBName, cfg.MySQL.Params)
		log.Println("Connecting to MySQL with DSN:", dsn)
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
		// Configure SQLite with WAL mode and busy timeout
		db, dbErr = gorm.Open(
			sqlite.Open(cfg.Sqlite.Db+"?_journal=WAL&_busy_timeout=5000&_synchronous=NORMAL&_foreign_keys=true"),
			&gorm.Config{},
		)

		if dbErr == nil {
			// Set connection pool settings
			sqlDB, err := db.DB()
			if err == nil {
				sqlDB.SetMaxIdleConns(10) // Increased from 1
				sqlDB.SetMaxOpenConns(10) // Increased from 1
				sqlDB.SetConnMaxLifetime(time.Hour)
			}

			// Set WAL mode and other PRAGMAs in a transaction
			tx := db.Exec(`
				PRAGMA journal_mode=WAL;
				PRAGMA busy_timeout=5000;
				PRAGMA synchronous=NORMAL;
				PRAGMA journal_size_limit=10000000;
				PRAGMA cache_size=-2000;
			`)
			if tx.Error != nil {
				log.Printf("Failed to set SQLite PRAGMAs: %v", tx.Error)
			}
		}
	} else {
		panic(fmt.Sprintf("Invalid SQL type: %s", cfg.App.Sql))
	}

	database = db

	// check if logs directory exists
	if _, err := os.Stat("logs"); os.IsNotExist(err) {
		os.Mkdir("logs", 0755)
	}

	multiWriter := io.MultiWriter(os.Stdout, logger)
	log.SetOutput(multiWriter)

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

	// Migrate stream table with custom migration
	err = models.MigrateStreams(db)
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

	// Auto-migrate media files table
	err = db.AutoMigrate(&models.MediaFile{})
	if err != nil {
		log.Fatalf("failed to migrate media files table: %v", err)
	}

	// Auto-migrate activities table
	err = db.AutoMigrate(&models.Activity{})
	if err != nil {
		log.Fatalf("failed to migrate activities table: %v", err)
	}

	// Init device presets
	tiktok.InitDevicePresets()

	activityLogger := utils.NewActivityLogger(db)

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
	redisPubSub := redisutil.RedisPubSub{Config: cfg}
	redisPubSub.InitRedis()

	// assign config and db to gin context
	r.Use(func(c *gin.Context) {
		c.Set("config", cfg)
		c.Set("db", db)
		c.Set("redis", &redisPubSub)
		// cors header
		clientReqOrigin := c.Request.Header.Get("Origin")
		c.Header("Access-Control-Allow-Origin", clientReqOrigin)
		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization")
		// return ok response for preflight request
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusOK)
			return
		}
		c.Next()
	})

	// serve uploads folder
	r.StaticFS("/uploads", http.Dir("uploads"))

	// Auth handler
	authHandler := &handlers.AuthHandler{DB: db}
	r.POST("/api/login", authHandler.Login)
	r.POST("/api/logout", authHandler.Logout)
	r.POST("/api/refresh-token", authHandler.RefreshToken)

	// Stream handler
	streamHandler := &handlers.StreamHandler{DB: db, Config: cfg, ActivityLogger: activityLogger, RedisPubSub: &redisPubSub}
	fileUploadHandler := &handlers.FileUploadHandler{DB: db, Config: cfg}
	r.PUT("/api/streams/:id/maxbitrate", handlers.JWTMiddleware(), streamHandler.SetMaxBitrate)
	r.GET("/api/streams", handlers.JWTMiddleware(), streamHandler.ListStreams)
	r.POST("/api/streams", handlers.JWTMiddleware(), streamHandler.CreateStream)
	r.POST("/api/streams/new", handlers.JWTMiddleware(), streamHandler.CreateStreamFromExisting)
	r.PUT("/api/streams/:id/schedule", handlers.JWTMiddleware(), streamHandler.SetSchedule)
	r.PUT("/api/streams/:id/duration", handlers.JWTMiddleware(), streamHandler.SetDuration)
	r.PUT("/api/streams/:id/rename", handlers.JWTMiddleware(), streamHandler.RenameFile)
	r.PUT("/api/streams/:id/loop", handlers.JWTMiddleware(), streamHandler.SetLoopVideo)
	r.PUT("/api/streams/:id/loopcount", handlers.JWTMiddleware(), streamHandler.SetLoopCount)
	r.PUT("/api/streams/:id/rtmpurl", handlers.JWTMiddleware(), streamHandler.SetRTMPUrl)
	r.POST("/api/streams/:id/clone", handlers.JWTMiddleware(), streamHandler.CloneStream)
	r.GET("/api/streams/:id/preview", streamHandler.ServeVideoPreviewByID)
	r.GET("/api/streams/:id/logs", handlers.JWTMiddleware(), streamHandler.GetStreamLogs)

	dashboardHandler := &handlers.DashboardHandler{DB: db}
	r.GET("/api/dashboard/streams", handlers.JWTMiddleware(), dashboardHandler.GetDashboardStreamMetrics)
	r.GET("/api/dashboard/metrics", handlers.JWTMiddleware(), dashboardHandler.GetDashboardSystemMetrics)
	r.GET("/api/dashboard/storage", handlers.JWTMiddleware(), dashboardHandler.GetStorageInfo)
	r.GET("/api/dashboard/activities/recent", handlers.JWTMiddleware(), dashboardHandler.GetRecentActivities)

	// Media file handler
	mediaFileHandler := &handlers.MediaFileHandler{DB: db}
	r.GET("/api/streams/:id/media", handlers.JWTMiddleware(), mediaFileHandler.ListMediaFiles)
	r.POST("/api/streams/:id/media", handlers.JWTMiddleware(), mediaFileHandler.UploadMediaFile)
	r.DELETE("/api/streams/media/:id", handlers.JWTMiddleware(), mediaFileHandler.DeleteMediaFile)
	r.GET("/api/streams/:id/media/:mediaId/preview", mediaFileHandler.GetMediaPreview)
	r.GET("/api/media/user", handlers.JWTMiddleware(), mediaFileHandler.ListAllMediaFilesByUser)

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

	r.PUT("/api/streams/:id", handlers.JWTMiddleware(), streamHandler.UpdateStream)

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
	// FFmpeg log HTTP endpoint for mirrors
	r.GET("/api/mirrors/:id/logs", handlers.JWTMiddleware(), mirrorHandler.GetMirrorLogs)

	broadcast.Bus.AddListener("default", broadcast.AddToMirror, func(e broadcast.Event) {
		log.Println("Adding to mirror", e.Data)
		data, ok := e.Data.(map[string]interface{})
		if !ok {
			log.Println("Failed to add to mirror, invalid data type")
			return
		}
		mirrorHandler.AddMirrorFromBroadcast(data["username"].(string), data["user_id"].(string), data["rtmp_url"].(string), data["stream_key"].(string), data["channel_id"].(string), &redisPubSub)
	})

	broadcast.Bus.AddListener("default", broadcast.RefreshMonitor, func(e broadcast.Event) {
		data, ok := e.Data.(map[string]interface{})
		if !ok {
			log.Println("Failed to refresh monitor, invalid data type")
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

	r.GET("/api/tiktok/search", tiktokHandler.GetSearch)

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
	r.PUT("/api/monitors/:id/pause", handlers.JWTMiddleware(), monitorHandler.PauseMonitor)
	r.PUT("/api/monitors/:id/resume", handlers.JWTMiddleware(), monitorHandler.ResumeMonitor)
	r.DELETE("/api/monitors/:id", handlers.JWTMiddleware(), monitorHandler.DeleteMonitorById)
	r.PUT("/api/monitors/:id", handlers.JWTMiddleware(), monitorHandler.UpdateMonitorStatus)

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

	streamWorker := workers.NewStreamWorker(database, cfg, &redisPubSub)

	// -- Stream Worker: Monitor stream status --
	go streamWorker.StartMonitorStream()

	go streamWorker.StartScheduledStream()

	// one time restarter
	go streamWorker.StartOneTimeRestarter()

	mirrorWorker := workers.NewMirrorWorker(database, tiktokClient, &redisPubSub)
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

	// FFmpeg log WebSocket endpoints for mirrors and streams
	r.GET("/ws/ffmpeg-logs/mirror/:mirror_id", handlers.JWTMiddleware(), handlers.FFmpegLogMirrorWebSocket)
	r.GET("/ws/ffmpeg-logs/stream/:stream_id", handlers.JWTMiddleware(), handlers.FFmpegLogStreamWebSocket)

	log.Println("Starting YukLive...")
	log.Println("Version: " + version.Version)
	log.Println("Commit: " + version.Commit)
	log.Println("Date: " + version.Date)

	server := &http.Server{
		Addr:    fmt.Sprintf("%s:%d", cfg.App.Host, cfg.App.Port),
		Handler: r,
	}

	log.Println("Server started at http://" + cfg.App.Host + ":" + fmt.Sprintf("%d", cfg.App.Port))
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
		//kill the ffmpeg process
		if job.Workers[id].FfmpegPID != nil {
			job.KillFFmpegProcess(*job.Workers[id].FfmpegPID)
		}
	}

	server.Shutdown(context.Background())
}
