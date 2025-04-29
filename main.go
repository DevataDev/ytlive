package main

import (
	"context"
	"fmt"
	"io"
	"io/fs"
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
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"github.com/gin-gonic/gin"
	"github.com/oklog/ulid/v2"
	"gopkg.in/yaml.v3"

	"golang.org/x/net/html"
	"google.golang.org/api/drive/v2"
	"google.golang.org/api/option"

	"embed"
)

//go:embed web/static/* web/static
var StaticFiles embed.FS

var (
	version = "devel"
	commit  = "unknown"
	date    = "unknown"
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

// Custom reader to track download progress
type ProgressReader struct {
	io.Reader
	TotalSize int64
	BytesRead int64
	url       string
}

// Read method to update progress
func (pr *ProgressReader) Read(p []byte) (int, error) {
	n, err := pr.Reader.Read(p)
	pr.BytesRead += int64(n)
	pr.printProgress()
	return n, err
}

// Print download progress
func (pr *ProgressReader) printProgress() {
	if pr.TotalSize > 0 {
		percentage := float64(pr.BytesRead) / float64(pr.TotalSize) * 100
		models.SetDriveProgress(pr.url, map[string]interface{}{"status": "Downloading...", "progress": percentage})
		if percentage >= 100 {
			// delay 2 seconds
			time.Sleep(2 * time.Second)
			models.SetDriveProgress(pr.url, map[string]interface{}{"status": "Done", "progress": 100})
			models.ClearDriveProgress(pr.url)
		}
		fmt.Printf("\rDownloading... %.2f%% (%d/%d bytes)", percentage, pr.BytesRead, pr.TotalSize)
	} else {
		fmt.Printf("\rDownloading... %d bytes", pr.BytesRead)
	}
}

// Downloads a public Google Drive file using its file ID
func downloadDriveFile(client *http.Client, url string, destPath string, driveLink string) error {
	models.SetDriveProgress(driveLink, map[string]interface{}{"status": "Download Starting...", "progress": 1})
	resp, err := client.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// Get content length
	totalSize := resp.ContentLength

	// Create progress reader
	progressReader := &ProgressReader{
		Reader:    resp.Body,
		TotalSize: totalSize,
		BytesRead: 0,
		url:       driveLink,
	}

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
	_, err = io.Copy(out, progressReader)
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

		// get the hidden input
		for child := range formElem.ChildNodes() {
			if child.Type == html.ElementNode && child.Data == "input" {
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
			}
		}

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
	ctx               = context.Background()
	database *gorm.DB = nil
)

// Config struct for MySQL and default
type Config struct {
	App struct {
		Port int    `yaml:"port"`
		Host string `yaml:"host"`
		Mode string `yaml:"mode"`
		Sql  string `yaml:"sql"`
	} `yaml:"app"`
	MySQL struct {
		User     string `yaml:"user"`
		Password string `yaml:"password"`
		Host     string `yaml:"host"`
		Port     int    `yaml:"port"`
		DBName   string `yaml:"dbname"`
		Params   string `yaml:"params"`
	} `yaml:"mysql"`
	Sqlite struct {
		Db string `yaml:"db"`
	} `yaml:"sqlite"`
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

func normalizeFileName(fileName string) string {
	// Remove special characters and convert to lowercase
	normalizeFileName := strings.ToLower(fileName)
	normalizeFileName = strings.ReplaceAll(normalizeFileName, ".", "-")
	// remove any symbol
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "!", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "@", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "#", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "$", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "%", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "^", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "&", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "*", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "(", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, ")", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "_", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "-", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "+", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "=", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "[", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "]", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "{", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "}", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "|", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "\\", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "/", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "?", "-")
	return normalizeFileName
}

func main() {
	cfg, err := loadConfig("config.yaml")
	if err != nil {
		panic(fmt.Sprintf("failed to read config.yaml: %v", err))
	}

	var db *gorm.DB
	var dbErr error

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

	r := gin.Default()

	// Replace static file serving with embedded static files
	staticFS, _ := fs.Sub(StaticFiles, "web/static")
	r.StaticFS("/static", http.FS(staticFS))

	// serve uploads folder
	// server ./uploads
	// uploadsFS, _ := fs.Sub(StaticFiles, "uploads")
	r.StaticFS("/uploads", http.Dir("uploads"))

	// Auth handler
	authHandler := &handlers.AuthHandler{DB: db}
	r.POST("/api/login", authHandler.Login)
	r.POST("/api/logout", authHandler.Logout)
	r.POST("/api/refresh-token", authHandler.RefreshToken)

	// Stream handler
	streamHandler := &handlers.StreamHandler{DB: db}
	// Set max bitrate endpoint
	r.PUT("/api/streams/:id/maxbitrate", handlers.JWTMiddleware(), streamHandler.SetMaxBitrate)
	r.GET("/api/streams", handlers.JWTMiddleware(), streamHandler.ListStreams)
	r.POST("/api/streams", handlers.JWTMiddleware(), streamHandler.CreateStream)
	r.PUT("/api/streams/:id/schedule", handlers.JWTMiddleware(), streamHandler.SetSchedule)
	r.PUT("/api/streams/:id/rename", handlers.JWTMiddleware(), streamHandler.RenameFile)
	r.PUT("/api/streams/:id/duration", handlers.JWTMiddleware(), streamHandler.SetDuration)
	r.GET("/api/streams/preview/:id", streamHandler.ServeVideoPreviewByID)

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
	r.GET("/api/dashboard/streams", handlers.JWTMiddleware(), func(c *gin.Context) {
		userID, _ := c.Get("user_id")
		var started, scheduled int64
		db.Model(&models.Stream{}).Where("status = ?", "live").Where("user_id = ?", userID).Count(&started)
		db.Model(&models.Stream{}).Where("status = ?", "scheduled").Where("user_id = ?", userID).Count(&scheduled)
		c.JSON(200, gin.H{"started": started, "scheduled": scheduled})
	})
	r.GET("/api/dashboard/metrics", handlers.JWTMiddleware(), func(c *gin.Context) {
		// TODO: Replace with real metrics
		c.JSON(200, gin.H{"cpu": 11.5, "memory": 42.3, "upload": 120.5, "download": 340.8})
	})

	// Serve the upload page at /upload
	r.GET("/upload", func(c *gin.Context) {
		staticFs, _ := fs.Sub(StaticFiles, "web/static")
		c.FileFromFS("/upload.html", http.FS(staticFs))
	})

	// Handle video upload (file or Google Drive link)
	r.POST("/api/streams/upload", handlers.JWTMiddleware(), func(c *gin.Context) {
		file, fileHeaderErr := c.FormFile("videoFile")
		driveLink := c.PostForm("driveLink")
		userID, ok := c.Get("user_id")
		if !ok {
			c.JSON(401, gin.H{"error": "Unauthorized"})
			return
		}
		if fileHeaderErr != nil && driveLink == "" {
			c.JSON(400, gin.H{"error": "No file or Google Drive link provided."})
			return
		}
		var fileName string
		var googleDriveLink *string
		var filePath *string
		if driveLink != "" {
			models.SetDriveProgress(driveLink, map[string]interface{}{"status": "Starting...", "progress": 0})
			// Offload Google Drive download to background goroutine
			go func(userID string, driveLink string) {
				fileID := extractDriveFileID(driveLink)
				if fileID == "" {
					models.SetDriveProgress(driveLink, map[string]interface{}{"error": "Invalid Google Drive link", "progress": 0})
					return
				}
				srv, err := drive.NewService(ctx, option.WithAPIKey(cfg.Google.ApiKey))
				if err != nil {
					models.SetDriveProgress(driveLink, map[string]interface{}{"error": "Google Drive API error", "progress": 0})
					return
				}
				file, err := srv.Files.Get(fileID).Do()
				if err != nil {
					models.SetDriveProgress(driveLink, map[string]interface{}{"error": "Google Drive file not accessible", "progress": 0})
					return
				}
				client := http.DefaultClient
				downloadUrl, err := generateDownloadUrl(client, file)
				if err != nil {
					models.SetDriveProgress(driveLink, map[string]interface{}{"error": "Failed to generate download URL", "progress": 0})
					return
				}
				fileNameWithoutExtension := strings.ReplaceAll(file.OriginalFilename, file.FileExtension, "")
				downloadName := fmt.Sprintf("file-%d-%s.mp4", time.Now().UnixMilli(), normalizeFileName(fileNameWithoutExtension))
				destPath := "./uploads/" + downloadName
				if err := downloadDriveFile(client, downloadUrl, destPath, driveLink); err != nil {
					models.SetDriveProgress(driveLink, map[string]interface{}{"error": "Download failed: " + err.Error(), "progress": 0})
					return
				}
				// Register the stream in the DB after download completes
				entropy := rand.New(rand.NewSource(time.Now().UnixNano()))
				ms := ulid.Timestamp(time.Now())
				id, err := ulid.New(ms, entropy)
				if err != nil {
					models.SetDriveProgress(driveLink, map[string]interface{}{"error": "Failed to generate ID", "progress": 100})
					return
				}
				stream := models.Stream{
					ID:              id.String(),
					FileName:        downloadName,
					FilePath:        &destPath,
					GoogleDriveLink: &driveLink,
					Status:          "stopped",
					UserId:          userID,
				}
				if err := db.Create(&stream).Error; err != nil {
					models.SetDriveProgress(driveLink, map[string]interface{}{"error": "Failed to register stream", "progress": 100})
					return
				}
				models.SetDriveProgress(driveLink, map[string]interface{}{"message": "Done", "progress": 100})
			}(userID.(string), driveLink)
			// Respond immediately so UI is not blocked
			c.JSON(http.StatusOK, gin.H{"message": "Google Drive download started"})
			return
		}
		if fileHeaderErr == nil {
			// Save file to disk (uploads folder)
			fileName = fmt.Sprintf("file-%d-%s.mp4", time.Now().UnixMilli(), normalizeFileName(file.Filename))
			uploadPath := "./uploads/" + fileName
			if err := c.SaveUploadedFile(file, uploadPath); err != nil {
				fmt.Println(err)
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
			Status:          "stopped",
			CreatedAt:       time.Now(),
			UpdatedAt:       time.Now(),
			UserId:          userID.(string),
		}
		if err := db.Create(&stream).Error; err != nil {
			fmt.Println(err)
			c.JSON(500, gin.H{"error": "Failed to save stream info."})
			return
		}
		c.JSON(200, gin.H{"message": "Upload successful!"})
	})

	r.GET("/api/streams/upload/progress", streamHandler.GetDriveUploadProgress)

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
		if stream.Status == "scheduled" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "This stream has been scheduled and cannot be started manually."})
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
						if proc.Pid > 0 {
							_ = proc.Kill()
						}
						<-done
					}
				}
			}
		}
		// Start FFmpeg goroutine (using models.AddWorker)
		go func(streamID, filePath, streamKey string, maxBitrate *int) {
			worker, pid, err := models.StartStreamWorkerWithDatabase(streamID, filePath, streamKey, maxBitrate, db)
			if err == nil {
				fmt.Println("FFmpeg started for stream", streamID, "with PID", pid)
				fmt.Println("FFmpeg PID stored in worker", worker.FfmpegPID)
				db.Model(&models.Stream{}).Where("id = ?", streamID).Updates(map[string]interface{}{
					"ffmpeg_p_id": worker.FfmpegPID,
					"status":      "live",
					"started_at":  time.Now(),
				})
				// Broadcast to all ws clients
				userID, _ := c.Get("user_id")
				go func() {
					handlers.BroadcastStreamListUpdate()
					handlers.BroadcastDashboardStreams(db, userID.(string))
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
		db.Model(&stream).Updates(map[string]interface{}{
			"status":      "stopped",
			"stopped_at":  time.Now(),
			"ffmpeg_p_id": nil,
		})
		// Broadcast to all ws clients
		userID, _ := c.Get("user_id")
		go func() {
			handlers.BroadcastStreamListUpdate()
			handlers.BroadcastDashboardStreams(db, userID.(string))
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
		userID, _ := c.Get("user_id")
		go func() {
			handlers.BroadcastStreamListUpdate()
			handlers.BroadcastDashboardStreams(db, userID.(string))
		}()
		c.JSON(200, gin.H{"success": true})
	})

	r.GET("/users", func(c *gin.Context) {
		staticFs, _ := fs.Sub(StaticFiles, "web/static")
		c.FileFromFS("/user-management.html", http.FS(staticFs))
	})

	// User management endpoints
	userHandler := &handlers.UserHandler{DB: db}
	r.GET("/api/users", handlers.JWTMiddleware(), userHandler.ListUsers)
	r.POST("/api/users", handlers.JWTMiddleware(), userHandler.CreateUser)
	r.PUT("/api/users/username/:username/password", handlers.JWTMiddleware(), userHandler.UpdateUserPassword)

	r.PUT("/api/users/:id/admin", handlers.JWTMiddleware(), func(c *gin.Context) {
		userID, _ := c.Get("user_id")
		var user models.User
		if err := db.First(&user, "id = ?", userID).Error; err != nil || !user.IsAdmin {
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
		if err := db.Model(&models.User{}).Where("id = ?", id).Update("is_admin", req.IsAdmin).Error; err != nil {
			c.JSON(500, gin.H{"error": "Failed to update admin status"})
			return
		}
		c.JSON(200, gin.H{"success": true})
	})

	r.PUT("/api/users/:id/active", handlers.JWTMiddleware(), func(c *gin.Context) {
		userID, _ := c.Get("user_id")
		var user models.User
		if err := db.First(&user, "id = ?", userID).Error; err != nil || !user.IsAdmin {
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
		if err := db.Model(&models.User{}).Where("id = ?", id).Update("is_active", req.IsActive).Error; err != nil {
			c.JSON(500, gin.H{"error": "Failed to update active status"})
			return
		}
		c.JSON(200, gin.H{"success": true})
	})

	r.DELETE("/api/users/:id", handlers.JWTMiddleware(), func(c *gin.Context) {
		userID, _ := c.Get("user_id")
		var user models.User
		if err := db.First(&user, "id = ?", userID).Error; err != nil || !user.IsAdmin {
			c.JSON(403, gin.H{"error": "Forbidden"})
			return
		}
		id := c.Param("id")
		if err := db.Delete(&models.User{}, "id = ?", id).Error; err != nil {
			c.JSON(500, gin.H{"error": "Failed to delete user"})
			return
		}
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

	// Periodically broadcast server metrics to all websocket clients
	go func() {
		for {
			handlers.BroadcastDashboardMetrics()
			time.Sleep(2 * time.Second)
		}
	}()

	// Start background goroutine for broadcasting stream stats
	go handlers.BroadcastStreamStats()

	// --- Stream Scheduler: Start scheduled streams and stop overdue live streams ---
	go func() {
		fmt.Println("Starting stream scheduler...")
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for {
			<-ticker.C
			now := time.Now().UTC()
			fmt.Println("Checking for scheduled streams...")
			// Start scheduled streams
			var streamsToStart []models.Stream
			database.Where("status = ? AND scheduled_start_at <= ?", "scheduled", now).Find(&streamsToStart)
			fmt.Println("Found", len(streamsToStart), "scheduled streams to start.")
			for _, stream := range streamsToStart {
				if stream.StreamKey == "" || stream.FilePath == nil {
					fmt.Println("Stream", stream.ID, "has no stream key or file path, skipping.")
					continue // Do not start if no stream key or file path
				}
				// check start time
				if stream.ScheduledStartAt.After(now) {
					fmt.Println("Stream", stream.ID, "has not started yet, skipping. start time:", stream.ScheduledStartAt)
					continue
				}
				models.RestartLock.Lock()
				_, _, err := models.StartStreamWorkerWithDatabase(stream.ID, *stream.FilePath, stream.StreamKey, stream.MaxBitrate, db)
				models.RestartLock.Unlock()
				if err == nil {
					fmt.Println("Stream", stream.ID, "started successfully.")
					db.Model(&stream).Updates(map[string]interface{}{
						"Status":    "live",
						"StartedAt": now,
					})
					// send websocket message
					handlers.BroadcastStreamListUpdate()
				}
			}

			// Stop live streams whose end time has passed
			var streamsToStop []models.Stream
			database.Where("status = ? AND scheduled_end_at IS NOT NULL", "live").Find(&streamsToStop)
			fmt.Println("Found", len(streamsToStop), "live streams to stop.")
			for _, stream := range streamsToStop {
				// check end time
				if stream.ScheduledEndAt.Before(now) {
					models.RestartLock.Lock()
					_ = models.StopStreamWorker(stream.ID) // Ensures ffmpeg is killed
					models.RestartLock.Unlock()
					database.Model(&stream).Updates(map[string]interface{}{
						"Status":    "stopped",
						"StoppedAt": now,
					})
					// send websocket message
					handlers.BroadcastStreamListUpdate()
					fmt.Println("Stream", stream.ID, "stopped successfully.")
				}
			}
		}
	}()

	// -- timer for checking stream that have been live but ffmpeg not running, we restart it
	go func() {
		fmt.Println("Starting stream restart checker...")
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for {
			<-ticker.C
			var streamsToRestart []models.Stream
			database.Where("status = ? AND (started_at IS NOT NULL OR scheduled_start_at <= ?)", "live", time.Now().UTC()).Find(&streamsToRestart)
			fmt.Println("Found", len(streamsToRestart), "streams to restart.")
			for _, stream := range streamsToRestart {
				// check if ffmpeg is running by the pid
				if stream.FfmpegPID != nil && *stream.FfmpegPID > 0 {
					// check if process is still running
					if models.IsProcessRunning(*stream.FfmpegPID) {
						fmt.Println("Stream", stream.ID, "is already running with PID", *stream.FfmpegPID)
						continue
					}
				}
				models.RestartLock.Lock()
				_ = models.StopStreamWorker(stream.ID) // Ensures ffmpeg is killed
				_, _, err := models.StartStreamWorkerWithDatabase(stream.ID, *stream.FilePath, stream.StreamKey, stream.MaxBitrate, database)
				models.RestartLock.Unlock()
				if err != nil {
					fmt.Println("Failed to restart stream", stream.ID, ":", err)
					continue
				}
				// send websocket message
				handlers.BroadcastStreamListUpdate()
				fmt.Println("Stream", stream.ID, "restarted successfully.")
			}
		}
	}()

	// one time restarter
	go func() {
		fmt.Println("Starting one time restarter...")
		var streamsToRestart []models.Stream
		database.Where("status = ? AND (started_at IS NOT NULL OR scheduled_start_at <= ?)", "live", time.Now().UTC()).Find(&streamsToRestart)
		fmt.Println("Found", len(streamsToRestart), "streams to restart.")
		for _, stream := range streamsToRestart {
			// check if ffmpeg is running by the pid
			if stream.FfmpegPID != nil && *stream.FfmpegPID > 0 {
				// check if process is still running
				if models.IsProcessRunning(*stream.FfmpegPID) {
					fmt.Println("Stream", stream.ID, "is already running with PID", *stream.FfmpegPID)
					continue
				}
			}
			// lock
			models.RestartLock.Lock()
			_ = models.StopStreamWorker(stream.ID) // Ensures ffmpeg is killed
			_, _, err := models.StartStreamWorkerWithDatabase(stream.ID, *stream.FilePath, stream.StreamKey, stream.MaxBitrate, database)
			models.RestartLock.Unlock()

			if err != nil {
				fmt.Println("Failed to restart stream", stream.ID, ":", err)
				continue
			}

			// send websocket message
			handlers.BroadcastStreamListUpdate()
			fmt.Println("Stream", stream.ID, "restarted successfully.")
		}
	}()

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
	for id := range models.Workers {
		log.Println("Killing stream worker for stream", id)
		_ = models.StopStreamWorker(id)
	}

	server.Shutdown(context.Background())
}
