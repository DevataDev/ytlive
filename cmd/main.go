package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"windsorf-youtube-live/internal/auth"
	"windsorf-youtube-live/internal/handlers"
	"windsorf-youtube-live/internal/models"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"

	"github.com/gin-gonic/gin"
	"github.com/oklog/ulid/v2"
	"gopkg.in/yaml.v3"

	"golang.org/x/net/html"
	"google.golang.org/api/drive/v2"
	"google.golang.org/api/option"
)

// Extracts the file ID from a Google Drive share link
func extractDriveFileID(link string) string {
	parts := strings.Split(link, "/")
	for i, p := range parts {
		if p == "d" && i+1 < len(parts) {
			return parts[i+1]
		}
	}
	return ""
}

// Downloads a public Google Drive file using its file ID
func downloadDriveFile(client *http.Client, url string, destPath string) error {
	fmt.Println("Downloading from:", url)
	resp, err := client.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("error : Google Drive file not accessible (status %d)", resp.StatusCode)
	}

	// if file is html, return error
	if resp.Header.Get("Content-Type") == "text/html" {
		return fmt.Errorf("error : Google Drive file not accessible (status %d)", resp.StatusCode)
	}

	out, err := os.Create(destPath)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, resp.Body)
	return err
}

func generateDownloadUrl(client *http.Client, file *drive.File) (string, error) {
	fileSize := file.FileSize
	fileId := file.Id
	// check if file size is larger than 100MB
	if fileSize < 100*(1<<20) {
		// simple download
		// https://drive.google.com/uc?export=download&id=file-id
		downloadUrl := fmt.Sprintf("https://drive.google.com/uc?export=download&id=%s", fileId)
		return downloadUrl, nil
	}

	// large file download, more complicated download
	// Example: https://drive.google.com/u/0/uc?id=XXXXXXXXBKPx3G5_UZWA79g79ncqEfQ&export=download
	scanFailedUrl := fmt.Sprintf("https://drive.google.com/uc?export=download&id=%s", fileId)
	res, err := client.Get(scanFailedUrl)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return "", fmt.Errorf("failed to open download url: %s", scanFailedUrl)
	}

	// check content type, must be html
	contentType := res.Header.Get("Content-Type")
	if contentType != "text/html; charset=utf-8" {
		return "", fmt.Errorf("download page content type is not html: %s", contentType)
	}

	downloadPage, err := html.Parse(res.Body)
	if err != nil {
		return "", err
	}

	// TODO: Check if the page is "Google Drive Quota Exceeded or Limit Reached"
	formElem := getElementByID(downloadPage, "download-form")
	if formElem == nil {
		return "", fmt.Errorf("form element was not found in the download page")
	}

	formAction := getAttribute(formElem, "action")
	if formAction == "" {
		return "", fmt.Errorf("form action was not found in the download page")
	}

	// get the form input type hidden
	if formElem != nil {
		id := ""
		export := ""
		authuser := "0"
		confirm := "t"
		uuid := ""
		at := ""

		// get the hidden input
		for child := range formElem.ChildNodes() {
			fmt.Println("Child element:", child)
			if child.Type == html.ElementNode && child.Data == "input" {
				fmt.Println("Input element found:", child)
				if attr := getAttribute(child, "name"); attr == "id" {
					id = getAttribute(child, "value")
				}
				if attr := getAttribute(child, "name"); attr == "export" {
					export = getAttribute(child, "value")
				}
				if attr := getAttribute(child, "name"); attr == "authuser" {
					authuser = getAttribute(child, "value")
				}
				if attr := getAttribute(child, "name"); attr == "confirm" {
					confirm = getAttribute(child, "value")
				}
				if attr := getAttribute(child, "name"); attr == "uuid" {
					uuid = getAttribute(child, "value")
				}
				if attr := getAttribute(child, "name"); attr == "at" {
					at = getAttribute(child, "value")
				}
			}
		}

		fmt.Println("id:", id)
		fmt.Println("export:", export)
		fmt.Println("authuser:", authuser)
		fmt.Println("confirm:", confirm)
		fmt.Println("uuid:", uuid)
		fmt.Println("at:", at)

		if id != "" && export != "" && authuser != "" && confirm != "" && uuid != "" {
			return fmt.Sprintf("https://drive.usercontent.google.com/download?id=%s&export=%s&authuser=%s&confirm=%s&uuid=%s", id, export, authuser, confirm, uuid), nil
		} else {
			return "", fmt.Errorf("download page content type is not html: %s", contentType)
		}
	} else {
		return "", fmt.Errorf("download page content type is not html: %s", contentType)
	}
}

func getElementByID(n *html.Node, id string) *html.Node {
	if n.Type == html.ElementNode {
		if attr := getAttribute(n, "id"); attr == id {
			return n
		}
	}
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		if n := getElementByID(c, id); n != nil {
			return n
		}
	}
	return nil
}

func getAttribute(n *html.Node, key string) string {
	for _, attr := range n.Attr {
		if attr.Key == key {
			return attr.Val
		}
	}
	return ""
}

var (
	ctx = context.Background()
)

// Config struct for MySQL and default
type Config struct {
	App struct {
		Port int    `yaml:"port"`
		Host string `yaml:"host"`
	} `yaml:"app"`
	MySQL struct {
		User     string `yaml:"user"`
		Password string `yaml:"password"`
		Host     string `yaml:"host"`
		Port     int    `yaml:"port"`
		DBName   string `yaml:"dbname"`
		Params   string `yaml:"params"`
	} `yaml:"mysql"`
	Default struct {
		Password string `yaml:"password"`
	} `yaml:"default"`

	Google struct {
		ApiKey string `yaml:"apiKey"`
	} `yaml:"google"`
}

func loadConfig(path string) (*Config, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	var cfg Config
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
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?%s", cfg.MySQL.User, cfg.MySQL.Password, cfg.MySQL.Host, cfg.MySQL.Port, cfg.MySQL.DBName, cfg.MySQL.Params)
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
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

	// Create default user if not exists
	var defaultUser models.User
	if err := db.Where("email = ?", "default@yuklive.id").First(&defaultUser).Error; err == gorm.ErrRecordNotFound {
		hashed, _ := auth.HashPassword(cfg.Default.Password)
		defaultUser = models.User{
			Username: "default",
			Email:    "default@yuklive.id",
			Password: hashed,
			IsActive: true,
		}
		db.Create(&defaultUser)
	}

	r := gin.Default()

	r.Static("/static", "./web/static")

	// Auth handler
	authHandler := &handlers.AuthHandler{DB: db}
	r.POST("/api/login", authHandler.Login)
	r.POST("/api/logout", authHandler.Logout)

	// Stream handler
	streamHandler := &handlers.StreamHandler{DB: db}
	// Set max bitrate endpoint
	r.PUT("/api/streams/:id/maxbitrate", handlers.JWTMiddleware(), streamHandler.SetMaxBitrate)

	// List streams with pagination and live/scheduled counts
	r.GET("/api/streams", handlers.JWTMiddleware(), func(c *gin.Context) {
		var streams []models.Stream
		page := 1
		perPage := 10
		if p := c.Query("page"); p != "" {
			fmt.Sscanf(p, "%d", &page)
		}
		if pp := c.Query("per_page"); pp != "" {
			fmt.Sscanf(pp, "%d", &perPage)
		}
		offset := (page - 1) * perPage
		var total int64
		db.Model(&models.Stream{}).Count(&total)
		db.Order("created_at desc").Offset(offset).Limit(perPage).Find(&streams)
		// Count live and scheduled
		var liveCount, scheduledCount int64
		db.Model(&models.Stream{}).Where("status = ?", "live").Count(&liveCount)
		db.Model(&models.Stream{}).Where("status = ?", "scheduled").Count(&scheduledCount)
		c.JSON(200, gin.H{
			"streams":        streams,
			"total":          total,
			"page":           page,
			"per_page":       perPage,
			"countLive":      liveCount,
			"countScheduled": scheduledCount,
		})
	})
	r.GET("/stream", func(c *gin.Context) {
		c.File("./web/static/stream-list.html")
	})

	// Dashboard endpoints (JWT protected)
	r.GET("/dashboard", func(c *gin.Context) {
		c.File("./web/static/dashboard.html")
	})
	r.GET("/api/dashboard/streams", handlers.JWTMiddleware(), func(c *gin.Context) {
		var started, scheduled int64
		db.Model(&models.Stream{}).Where("status = ?", "live").Count(&started)
		db.Model(&models.Stream{}).Where("status = ?", "scheduled").Count(&scheduled)
		c.JSON(200, gin.H{"started": started, "scheduled": scheduled})
	})
	r.GET("/api/dashboard/metrics", handlers.JWTMiddleware(), func(c *gin.Context) {
		// TODO: Replace with real metrics
		c.JSON(200, gin.H{"cpu": 11.5, "memory": 42.3, "upload": 120.5, "download": 340.8})
	})

	// Serve the upload page at /upload
	r.GET("/upload", func(c *gin.Context) {
		c.File("./web/static/upload.html")
	})

	// Handle video upload (file or Google Drive link)
	r.POST("/api/streams/upload", handlers.JWTMiddleware(), func(c *gin.Context) {
		file, fileHeaderErr := c.FormFile("videoFile")
		driveLink := c.PostForm("driveLink")
		if fileHeaderErr != nil && driveLink == "" {
			c.JSON(400, gin.H{"error": "No file or Google Drive link provided."})
			return
		}
		var fileName string
		var googleDriveLink *string
		var filePath *string
		if driveLink != "" {
			googleDriveLink = &driveLink
			fileID := extractDriveFileID(driveLink)
			fmt.Println("File ID:", fileID)
			if fileID != "" {
				srv, err := drive.NewService(ctx, option.WithAPIKey(cfg.Google.ApiKey))
				if err != nil {
					c.JSON(500, gin.H{"error": "error : Google Drive file not accessible"})
					return
				}

				file, err := srv.Files.Get(fileID).Do()
				if err != nil {
					c.JSON(500, gin.H{"error": "error : Google Drive file not accessible"})
					return
				}

				client := http.DefaultClient
				downloadUrl, err := generateDownloadUrl(client, file)
				if err != nil {
					c.JSON(500, gin.H{"error": "error : Google Drive file not accessible, failed to generate download URL"})
					return
				}
				downloadName := file.OriginalFilename
				destPath := "./uploads/" + downloadName
				if err := downloadDriveFile(client, downloadUrl, destPath); err != nil {
					c.JSON(500, gin.H{"error": err.Error()})
					return
				}
				fileName = downloadName
				filePath = &destPath
			} else {
				c.JSON(400, gin.H{"error": "Google Drive link format not recognized. Please use a valid Google Drive share link."})
				return
			}
		}
		if fileHeaderErr == nil {
			// Save file to disk (uploads folder)
			fileName = file.Filename
			uploadPath := "./uploads/" + fileName
			if err := c.SaveUploadedFile(file, uploadPath); err != nil {
				c.JSON(500, gin.H{"error": "Failed to save file."})
				return
			}
			filePath = &uploadPath
		}

		entropy := rand.New(rand.NewSource(time.Now().UnixNano()))
		ms := ulid.Timestamp(time.Now())
		id, err := ulid.New(ms, entropy)
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to generate ID."})
			return
		}
		// Create new Stream DB entry
		stream := models.Stream{
			ID:              id.String(),
			FileName:        fileName,
			FilePath:        filePath,
			GoogleDriveLink: googleDriveLink,
			Status:          "scheduled",
			CreatedAt:       time.Now(),
			UpdatedAt:       time.Now(),
		}
		if err := db.Create(&stream).Error; err != nil {
			c.JSON(500, gin.H{"error": "Failed to save stream info."})
			return
		}
		c.JSON(200, gin.H{"message": "Upload successful!"})
	})

	// Download uploaded video by stream ID
	r.GET("/api/streams/:id/download", handlers.JWTMiddleware(), func(c *gin.Context) {
		id := c.Param("id")
		var stream models.Stream
		if err := db.First(&stream, "id = ?", id).Error; err != nil {
			c.JSON(404, gin.H{"error": "Stream not found"})
			return
		}
		if stream.FileName == "" {
			c.JSON(400, gin.H{"error": "No file uploaded for this stream."})
			return
		}
		if stream.FilePath != nil {
			c.FileAttachment(*stream.FilePath, stream.FileName)
		} else {
			c.JSON(400, gin.H{"error": "No file path for this stream."})
		}
	})

	// Set or update StreamKey for a stream
	r.PUT("/api/streams/:id/streamkey", handlers.JWTMiddleware(), func(c *gin.Context) {
		id := c.Param("id")
		var req struct {
			StreamKey string `json:"stream_key"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "Invalid request."})
			return
		}
		var stream models.Stream
		if err := db.First(&stream, "id = ?", id).Error; err != nil {
			c.JSON(404, gin.H{"error": "Stream not found."})
			return
		}
		stream.StreamKey = req.StreamKey
		if err := db.Save(&stream).Error; err != nil {
			c.JSON(500, gin.H{"error": "Failed to update stream key."})
			return
		}
		c.JSON(200, gin.H{"success": true})
	})

	// Start live stream (FFmpeg goroutine) handler
	r.POST("/api/streams/:id/start", handlers.JWTMiddleware(), func(c *gin.Context) {
		id := c.Param("id")
		var stream models.Stream
		if err := db.First(&stream, "id = ?", id).Error; err != nil {
			c.JSON(404, gin.H{"error": "Stream not found."})
			return
		}
		if stream.Status == "live" {
			c.JSON(400, gin.H{"error": "Stream is already live."})
			return
		}
		// Check for required fields
		if stream.StreamKey == "" || stream.FilePath == nil {
			c.JSON(400, gin.H{"error": "StreamKey or FilePath missing."})
			return
		}
		// Before starting, check if ffmpeg pid exists and is running, kill if so (prevent double stream)
		if stream.FfmpegPID != nil && *stream.FfmpegPID > 0 {
			proc, err := os.FindProcess(*stream.FfmpegPID)
			if err == nil && proc != nil {
				// Try to send signal 0 to check if running
				err = proc.Signal(syscall.Signal(0))
				if err == nil {
					// Process is running, try to kill
					_ = proc.Signal(syscall.SIGTERM)
					done := make(chan struct{}, 1)
					go func() { proc.Wait(); done <- struct{}{} }()
					select {
					case <-done:
						// exited gracefully
					case <-time.After(5 * time.Second):
						_ = proc.Kill()
						<-done
					}
				}
			}
		}
		// Start FFmpeg goroutine (using models.AddWorker)
		go func(streamID, filePath, streamKey string, maxBitrate *int) {
			_, pid, err := models.StartStreamWorker(streamID, filePath, streamKey, maxBitrate)
			if err == nil {
				db.Model(&models.Stream{}).Where("id = ?", streamID).Updates(map[string]interface{}{
					"ffmpeg_p_id": pid,
					"status":      "live",
					"started_at":  time.Now(),
				})
				// Broadcast to all ws clients
				go func() {
					handlers.BroadcastStreamListUpdate()
					handlers.BroadcastDashboardStreams(db)
				}()
			}
		}(stream.ID, *stream.FilePath, stream.StreamKey, stream.MaxBitrate)
		c.JSON(200, gin.H{"success": true})
	})

	// Stop live stream (FFmpeg goroutine) handler
	r.POST("/api/streams/:id/stop", handlers.JWTMiddleware(), func(c *gin.Context) {
		id := c.Param("id")
		var stream models.Stream
		if err := db.First(&stream, "id = ?", id).Error; err != nil {
			c.JSON(404, gin.H{"error": "Stream not found."})
			return
		}
		if stream.Status != "live" {
			c.JSON(400, gin.H{"error": "Stream is not live."})
			return
		}
		err := models.StopStreamWorker(stream.ID)
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to stop stream."})
			return
		}
		db.Model(&models.Stream{}).Where("id = ?", stream.ID).Updates(map[string]interface{}{
			"status":      "stopped",
			"stopped_at":  time.Now(),
			"ffmpeg_p_id": nil,
		})
		// Broadcast to all ws clients
		go func() {
			handlers.BroadcastStreamListUpdate()
			handlers.BroadcastDashboardStreams(db)
		}()
		c.JSON(200, gin.H{"success": true})
	})

	// DELETE /api/streams/:id endpoint
	r.DELETE("/api/streams/:id", handlers.JWTMiddleware(), func(c *gin.Context) {
		id := c.Param("id")
		var stream models.Stream
		if err := db.First(&stream, "id = ?", id).Error; err != nil {
			c.JSON(404, gin.H{"error": "Stream not found."})
			return
		}
		// Optionally: stop the stream if it's live
		if stream.Status == "live" {
			_ = models.StopStreamWorker(stream.ID)
		}
		// Remove video file if exists
		if stream.FilePath != nil && *stream.FilePath != "" {
			_ = os.Remove(*stream.FilePath)
		}
		if err := db.Delete(&stream).Error; err != nil {
			c.JSON(500, gin.H{"error": "Failed to delete stream."})
			return
		}
		go func() {
			handlers.BroadcastStreamListUpdate()
			handlers.BroadcastDashboardStreams(db)
		}()
		c.JSON(200, gin.H{"success": true})
	})

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
	r.GET("/", func(c *gin.Context) {
		c.File("./web/static/index.html")
	})

	// Periodically broadcast server metrics to all websocket clients
	go func() {
		for {
			handlers.BroadcastDashboardMetrics()
			time.Sleep(2 * time.Second)
		}
	}()

	// Start background goroutine for broadcasting stream stats
	go handlers.BroadcastStreamStats()

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
	server.Shutdown(context.Background())
}
