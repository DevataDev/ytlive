package handlers

import (
	"fmt"
	"log"
	"os"
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
	locker := filelocker.New("./uploads")

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

func (h *TusUploadHandler) processCompletedUpload(event handler.HookEvent) {
	// Get file info
	filePath := event.Upload.Storage["Path"]
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		log.Printf("Error getting file info: %s", err)
		return
	}

	// Extract metadata from the upload
	metadata := event.Upload.MetaData
	userID := metadata["userId"]
	fileName := metadata["filename"]
	streamID := metadata["streamId"]
	mediaType := metadata["mediaType"]

	var createdStreamId string
	if streamID == "" || strings.Contains(streamID, "temp") {
		createdStreamId = generateULID()
		streamName := fmt.Sprintf("Stream %s", time.Now().Format("2006-01-02 15:04:05"))
		defaultLoopCount := -1
		rtmpUrl := "rtmp://a.rtmp.youtube.com/live2/"
		stream := models.Stream{
			ID:        createdStreamId,
			Name:      streamName,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
			UserID:    userID,
			Status:    "stopped",
			LoopCount: &defaultLoopCount,
			RTMPUrl:   rtmpUrl,
		}
		if err := h.DB.Create(&stream).Error; err != nil {
			log.Printf("Failed to create stream: %s", err)
			return
		}
	} else {
		createdStreamId = streamID
	}

	// Generate a unique ID for the media file
	id := generateULID()

	// Create media file record
	mediaFile := models.MediaFile{
		ID:        id,
		FileName:  fileName,
		FilePath:  filePath,
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
	if createdStreamId != "" {
		log.Println("Associating media file with stream ID: ", createdStreamId)
		log.Println("Media file ID: ", mediaFile.ID)
		log.Println("User ID: ", userID)
		log.Println("Stream ID: ", createdStreamId)
		streamMediaFile := models.StreamMediaFile{
			StreamID:    createdStreamId,
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
}
