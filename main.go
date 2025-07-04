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
	"runtime"
	"syscall"
	"time"

	"windsorf-youtube-live/internal/auth"
	"windsorf-youtube-live/internal/cache"
	config "windsorf-youtube-live/internal/configuration"
	"windsorf-youtube-live/internal/handlers"
	"windsorf-youtube-live/internal/job"
	// metrics package is used by handlers.NewMetricsHandler
	_ "windsorf-youtube-live/internal/metrics"
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
		if err := os.MkdirAll("logs", 0755); err != nil {
			log.Printf("Warning: Failed to create logs directory: %v", err)
		}
	} else if err != nil {
		log.Printf("Warning: Error checking logs directory: %v", err)
	}

	multiWriter := io.MultiWriter(os.Stdout, logger)
	log.SetOutput(multiWriter)

	// fix column typo for stream table
	// check if column `loop_count,default:-1` exists
	hasLoopCount := db.Migrator().HasColumn(&models.Stream{}, "loop_count,default:-1")
	if hasLoopCount {
		if err := db.Migrator().RenameColumn(&models.Stream{}, "loop_count,default:-1", "loop_count"); err != nil {
			log.Printf("Warning: Failed to rename loop_count column: %v", err)
		}
	}

	// check if column `loop_video,default:true` exists
	hasLoopVideo := db.Migrator().HasColumn(&models.Stream{}, "loop_video,default:true")
	hasNewLoopVideo := db.Migrator().HasColumn(&models.Stream{}, "loop_video")
	if hasLoopVideo && !hasNewLoopVideo {
		if err := db.Migrator().RenameColumn(&models.Stream{}, "loop_video,default:true", "loop_video"); err != nil {
			log.Printf("Warning: Failed to rename loop_video column: %v", err)
		}
	}

	if dbErr != nil {
		log.Fatalf("Failed to connect to database: %v", dbErr)
	}

	// Verify database connection
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("Failed to get database instance: %v", err)
	}

	// Set connection pool settings
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)

	// Test the connection
	if err := sqlDB.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}

	// Migration functions with error handling
	migrations := []struct {
		name string
		run  func() error
	}{
		{"user table", func() error { return db.AutoMigrate(&models.User{}) }},
		{"stream table", func() error { return models.MigrateStreams(db) }},
		{"mirror table", func() error { return db.AutoMigrate(&models.Mirror{}) }},
		{"monitor table", func() error { return db.AutoMigrate(&models.Monitor{}) }},
		{"channels table", func() error { return db.AutoMigrate(&models.Channels{}) }},
		{"media files table", func() error { return db.AutoMigrate(&models.MediaFile{}) }},
		{"activities table", func() error { return db.AutoMigrate(&models.Activity{}) }},
		{"stream media files table", func() error { return db.AutoMigrate(&models.StreamMediaFile{}) }},
	}

	// Run migrations
	for _, m := range migrations {
		if err := m.run(); err != nil {
			log.Printf("Warning: Failed to migrate %s: %v", m.name, err)
			if m.name == "user table" || m.name == "stream table" {
				log.Fatalf("Fatal: Critical migration failed: %s", m.name)
			}
		} else {
			log.Printf("Successfully migrated %s", m.name)
		}
	}

	// For SQLite, dropping columns with foreign keys requires special handling
	if cfg.App.Sql == "sqlite3" {
		if db.Migrator().HasColumn(&models.MediaFile{}, "stream_id") {
			// Get raw database connection
			sqlDB, err := db.DB()
			if err != nil {
				log.Printf("Warning: Failed to get database connection: %v", err)
			} else {
				// Disable foreign key checks temporarily
				if _, err := sqlDB.Exec("PRAGMA foreign_keys=off"); err != nil {
					log.Printf("Warning: Failed to disable foreign keys: %v", err)
					return // Can't proceed without this
				}

				// Ensure we re-enable foreign keys even if something fails
				defer func() {
					if _, err := sqlDB.Exec("PRAGMA foreign_keys=on"); err != nil {
						log.Printf("Warning: Failed to re-enable foreign keys: %v", err)
					}
				}()

				// Start a transaction for the schema change
				tx := db.Begin()
				if tx.Error != nil {
					log.Printf("Warning: Failed to begin transaction: %v", tx.Error)
					return
				}

				// Drop the column
				if err := tx.Migrator().DropColumn(&models.MediaFile{}, "stream_id"); err != nil {
					tx.Rollback()
					log.Printf("Warning: Could not drop stream_id column: %v", err)
					return
				}

				// Commit the transaction
				if err := tx.Commit().Error; err != nil {
					log.Printf("Warning: Failed to commit transaction: %v", err)
				}
			}
		}
	}
	// Init device presets
	tiktok.InitDevicePresets()

	activityLogger := utils.NewActivityLogger(db)

	// Create default admin user if not exists
	var defaultUser models.User
	if err := db.Where("email = ?", "admin@yuklive.id").First(&defaultUser).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			hashed, err := auth.HashPassword(cfg.Default.Password)
			if err != nil {
				log.Fatalf("Failed to hash default admin password: %v", err)
			}

			defaultUser = models.User{
				Username: "admin",
				Email:    "admin@yuklive.id",
				Password: hashed,
				IsActive: true,
				IsAdmin:  true,
			}

			if err := db.Create(&defaultUser).Error; err != nil {
				log.Fatalf("Failed to create default admin user: %v", err)
			}
			log.Println("Created default admin user")
		} else {
			log.Fatalf("Failed to check for default admin user: %v", err)
		}
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
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization, tus-resumable, x-requested-with, x-tus-resumable, x-tus-version, x-tus-max-size, x-tus-offset, x-tus-checksum-algorithm, x-tus-checksum, x-tus-checksum-complete, x-tus-checksum-complete-defer-length, upload-metadata, upload-length, Location, upload-offset")
		c.Header("Access-Control-Expose-Headers", "Location, tus-resumable, tus-version, tus-max-size, tus-extension, upload-offset, upload-length, upload-metadata, upload-offset")
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
	r.POST("/api/streams/:id/map", handlers.JWTMiddleware(), mediaFileHandler.MapMediaFile)
	r.DELETE("/api/streams/media/:id", handlers.JWTMiddleware(), mediaFileHandler.DeleteMediaFile)
	r.GET("/api/streams/:id/media/:mediaId/preview", mediaFileHandler.GetMediaPreview)
	r.PUT("/api/streams/:id/media/:mediaId/unmap", handlers.JWTMiddleware(), mediaFileHandler.UnMapMediaFile)
	r.GET("/api/media/user", handlers.JWTMiddleware(), mediaFileHandler.ListAllMediaFilesByUser)
	r.POST("/api/media/upload", handlers.JWTMiddleware(), mediaFileHandler.UploadMediaFileOnly)
	r.PUT("/api/media/:id/rename", handlers.JWTMiddleware(), mediaFileHandler.RenameMediaFile)
	r.DELETE("/api/media/:id", handlers.JWTMiddleware(), mediaFileHandler.DeleteMediaFileByID)

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

	// Initialize and register Prometheus metrics handler
	metricsHandler := handlers.NewMetricsHandler(db)
	// Expose metrics endpoint without authentication for Prometheus scraping
	// In production, consider securing this endpoint with IP allowlisting or basic auth
	r.GET("/metrics", metricsHandler.PrometheusHandler())

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
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM, syscall.SIGQUIT)
	defer stop()

	// Set up logging for unhandled panics
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Panic recovered: %v\n", r)
			// Get stack trace
			buf := make([]byte, 1<<16)
			stackSize := runtime.Stack(buf, false)
			log.Printf("Stack trace:\n%s\n", buf[:stackSize])
			// Try to log to file as well
			if logger != nil {
				logger.Write(buf[:stackSize])
			}
			// Let the application exit with non-zero status
			os.Exit(1)
		}
	}()

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

	// Add this to your route setup
	tusHandler := handlers.TusUploadHandler{DB: db, Config: cfg}
	tusHandler.SetupTusHandler(r)

	// Add the endpoint to create tus uploads
	r.POST("/api/uploads/create", handlers.JWTMiddleware(), mediaFileHandler.CreateTusUpload)

	log.Println("Starting YukLive...")
	log.Println("Version: " + version.Version)
	log.Println("Commit: " + version.Commit)
	log.Println("Date: " + version.Date)

	server := &http.Server{
		Addr:    fmt.Sprintf("%s:%d", cfg.App.Host, cfg.App.Port),
		Handler: r,
	}

	serverAddr := fmt.Sprintf("%s:%d", cfg.App.Host, cfg.App.Port)
	log.Printf("Starting server on http://%s\n", serverAddr)

	serverError := make(chan error, 1)
	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			serverError <- fmt.Errorf("server error: %w", err)
		}
	}()

	// Wait for interrupt or server error
	select {
	case err := <-serverError:
		log.Printf("Server error: %v\n", err)
	case <-ctx.Done():
		log.Println("Shutdown signal received, shutting down gracefully...")
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Attempt graceful shutdown
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("HTTP server shutdown error: %v\n", err)
	}

	// Kill all running stream workers (FFmpeg processes)
	log.Println("Stopping all running stream workers...")
	for id := range job.Workers {
		log.Println("Killing stream worker for stream", id)
		//kill the ffmpeg process
		if job.Workers[id].FfmpegPID != nil {
			job.KillFFmpegProcess(*job.Workers[id].FfmpegPID)
		}
	}

	server.Shutdown(context.Background())
}
