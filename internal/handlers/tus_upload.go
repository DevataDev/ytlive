package handlers

import (
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"
	config "windsorf-youtube-live/internal/configuration"
	"windsorf-youtube-live/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/tus/tusd/pkg/filelocker"
	"github.com/tus/tusd/pkg/filestore"
	"github.com/tus/tusd/pkg/handler"
	"gorm.io/gorm"
)

type TusUploadHandler struct {
	DB     *gorm.DB
	Config *config.Config
}

func (h *TusUploadHandler) SetupTusHandler(router *gin.Engine) {
	// Create a new filestore using the uploads directory
	uploadPath := "./uploads"
	if err := os.MkdirAll(uploadPath, 0755); err != nil {
		log.Fatalf("Failed to create upload directory: %s", err)
	}

	// Create a filestore and configure it
	store := filestore.New(uploadPath)
	locker := filelocker.New(uploadPath)

	// Create a new tus handler
	composer := handler.NewStoreComposer()
	store.UseIn(composer)
	locker.UseIn(composer)

	tusConfig := handler.Config{
		BasePath:                "/files/", // Keep trailing slash for tus protocol
		StoreComposer:           composer,
		NotifyCompleteUploads:   true,
		MaxSize:                 4 * 1024 * 1024 * 1024, // 4 GB
		RespectForwardedHeaders: true,
	}

	tusHandler, err := handler.NewUnroutedHandler(tusConfig)
	if err != nil {
		log.Fatalf("Unable to create tus handler: %s", err)
	}

	log.Println("Tus upload handler setup completed")

	// Handle completed uploads
	go func() {
		for {
			event := <-tusHandler.CompleteUploads
			log.Printf("Upload %s completed", event.Upload.ID)

			// Process the completed file
			go h.processCompletedUpload(event)
		}
	}()

	// Setup routing
	router.POST("/files/", gin.WrapF(tusHandler.PostFile))
	router.HEAD("/files/:id", gin.WrapF(tusHandler.HeadFile))
	router.PATCH("/files/:id", gin.WrapF(tusHandler.PatchFile))
	router.GET("/files/:id", gin.WrapF(tusHandler.GetFile))

	log.Println("Tus upload handler setup routing completed")
}

func parseMediaType(filePathStr string) (string, error) {
	// Implement your logic to determine the media type based on the file path
	// For example, you can check the file extension or use a library like ffprobe
	// to determine the media type.
	// Get file extension and validate
	ext := strings.ToLower(filepath.Ext(filePathStr))
	log.Println("File extension: ", ext)
	allowedExts := map[string]bool{
		".mp4": true,
		".mkv": true,
		".wav": true,
		".mp3": true,
	}

	if !allowedExts[ext] && ext != "" {
		err := errors.New("invalid file extension, " + ext)
		return "", err
	}

	mediaType := ""
	switch ext {
	case ".mp4", ".mkv":
		mediaType = "video"
	case ".mp3", ".wav":
		mediaType = "audio"
	}

	if mediaType == "" {
		mediaType = "video" // default to video if type couldn't be determined
	}

	log.Println("Media type detected: ", mediaType)

	return mediaType, nil
}

func (h *TusUploadHandler) processCompletedUpload(event handler.HookEvent) {
	// Get file info
	filePathStr := event.Upload.Storage["Path"]
	fileInfo, err := os.Stat(filePathStr)
	if err != nil {
		log.Printf("Error getting file info: %s", err)
		return
	}

	log.Println("Processing completed upload, file path : ", fileInfo.Name(), filePathStr)

	// Extract metadata from the upload
	metadata := event.Upload.MetaData
	userID := metadata["userId"]
	fileName := metadata["filename"]
	streamID := metadata["streamId"]
	mediaType := metadata["mediaType"]
	uploadOnly := metadata["uploadOnly"] == "true" // Convert string to bool

	log.Println("Processing completed upload, mediaType : ", mediaType)
	if mediaType == "detect" {
		log.Println("No media type provided, skipping processing, detecting media type : ", filePathStr, fileName)
		// Fix line 170 - change from:

		// To:
		mediaType, err = parseMediaType(fileName)
		if err != nil {
			log.Printf("Error parsing media type: %s", err)
			return
		}
	}

	if !uploadOnly {
		if streamID == "" {
			log.Println("No stream ID provided, creating new stream")
			streamID = generateULID()
		}

		log.Println("Checking Stream ID: ", streamID)
		log.Println("Checking User ID: ", userID)
		log.Println("Checking Media Type: ", mediaType)
		log.Println("Checking File Name: ", fileName)

		var stream models.Stream
		result := h.DB.Where("id = ?", streamID).First(&stream)
		if result.Error != nil {
			if errors.Is(result.Error, gorm.ErrRecordNotFound) {
				// Create new stream
				stream = models.Stream{
					ID:        streamID,
					Name:      fmt.Sprintf("Stream %s", time.Now().Format("2006-01-02 15:04:05")),
					RTMPUrl:   fmt.Sprintf("rtmp://a.rtmp.youtube.com/live2/"),
					UserID:    userID,
					CreatedAt: time.Now(),
					UpdatedAt: time.Now(),
				}
				if err := h.DB.Create(&stream).Error; err != nil {
					log.Printf("Error creating stream: %v", err)
					return
				}
			} else {
				log.Printf("Error retrieving stream: %v", result.Error)
			}
		}

		// Generate a unique ID for the media file
		id := generateULID()

		// Create media file record
		mediaFile := models.MediaFile{
			ID:        id,
			FileName:  fileName,
			FilePath:  filePathStr,
			FileSize:  fileInfo.Size(),
			MediaType: models.MediaType(mediaType),
			MimeType:  metadata["filetype"],
			UserId:    userID,
		}

		// Start a transaction
		tx := h.DB.Begin()

		// Create the media file record
		if err := tx.Create(&mediaFile).Error; err != nil {
			tx.Rollback()
			log.Printf("Failed to create media file record: %s", err)
			return
		}

		// If streamID is provided, associate the media file with the stream
		if streamID != "" {
			log.Println("Associating media file with stream ID: ", streamID)
			log.Println("Media file ID: ", mediaFile.ID)
			log.Println("User ID: ", userID)
			log.Println("Stream ID: ", streamID)
			streamMediaFile := models.StreamMediaFile{
				StreamID:    streamID,
				MediaFileID: mediaFile.ID,
				Order:       0,
				IsPrimary:   false,
				CreatedAt:   time.Now(),
				UpdatedAt:   time.Now(),
			}

			if err := tx.Create(&streamMediaFile).Error; err != nil {
				tx.Rollback()
				log.Printf("Failed to associate media file with stream: %s", err)
				return
			}
		}

		// Commit the transaction
		if err := tx.Commit().Error; err != nil {
			log.Printf("Failed to commit transaction: %s", err)
			return
		}
		log.Printf("Successfully processed completed upload: %s", mediaFile.ID)
	} else {
		log.Println("Upload only flag is set, skipping stream creation")
		mediaFile := models.MediaFile{
			ID:        generateULID(),
			FileName:  fileName,
			FilePath:  filePathStr,
			FileSize:  fileInfo.Size(),
			MediaType: models.MediaType(mediaType),
			MimeType:  metadata["filetype"],
			UserId:    userID,
		}
		if err := h.DB.Create(&mediaFile).Error; err != nil {
			log.Printf("Failed to create media file record: %s", err)
			return
		}
		log.Printf("Successfully processed completed upload: %s", mediaFile.ID)
	}
}
