package handlers

import (
	"time"
	"windsorf-youtube-live/internal/metrics"
	"windsorf-youtube-live/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"gorm.io/gorm"
)

// MetricsHandler handles metrics collection and exposure
type MetricsHandler struct {
	DB *gorm.DB
}

// NewMetricsHandler creates a new metrics handler
func NewMetricsHandler(db *gorm.DB) *MetricsHandler {
	// Initialize metrics system
	metrics.Init()
	return &MetricsHandler{
		DB: db,
	}
}

// PrometheusHandler returns a handler for exposing Prometheus metrics
func (h *MetricsHandler) PrometheusHandler() gin.HandlerFunc {
	handler := promhttp.Handler()

	return func(c *gin.Context) {
		// Update metrics before serving
		h.updateMetrics()

		// Use the promhttp handler to serve metrics
		handler.ServeHTTP(c.Writer, c.Request)
	}
}

// updateMetrics updates all application metrics before serving them
func (h *MetricsHandler) updateMetrics() {
	// Update stream metrics
	var activeStreamCount int64
	h.DB.Model(&models.Stream{}).Where("status = ?", "live").Count(&activeStreamCount)
	metrics.SetActiveStreamsCount(int(activeStreamCount))

	// Update TikTok mirror metrics
	var mirrorCount int64
	h.DB.Model(&models.Mirror{}).Where("status = ?", "live").Count(&mirrorCount)
	metrics.SetTikTokMirrorsCount(int(mirrorCount))

	// Update user metrics
	var userCount int64
	h.DB.Model(&models.User{}).Count(&userCount)
	metrics.SetRegisteredUsersCount(int(userCount))

	// Update active users (users who have been active recently)
	// Since we don't have last_login_at, we'll use updated_at as a proxy
	var activeUserCount int64
	oneWeekAgo := time.Now().AddDate(0, 0, -7)
	h.DB.Model(&models.User{}).Where("updated_at > ?", oneWeekAgo).Count(&activeUserCount)
	metrics.SetActiveUsersCount(int(activeUserCount))

	// For each active stream, update metrics
	var activeStreams []models.Stream
	h.DB.Where("status = ?", "live").Find(&activeStreams)

	for _, stream := range activeStreams {
		// Set bitrate if available (using MaxBitrate as a proxy since we don't have Bitrate)
		if stream.MaxBitrate != nil {
			metrics.SetStreamBitrate(stream.ID, "youtube", float64(*stream.MaxBitrate))
		}

		// We don't have ViewerCount in the model, so we can't set this metric
		// If you add ViewerCount to the Stream model later, uncomment this code:
		// metrics.SetStreamViewers(stream.ID, "youtube", stream.ViewerCount)
	}

	// add started stream count metrics
	var startedStreamCount int64
	h.DB.Model(&models.Stream{}).Where("status = ?", "live").Count(&startedStreamCount)
	metrics.SetStartedStreamsCount(int(startedStreamCount))

	// add scheduled stream count metrics
	var scheduledStreamCount int64
	h.DB.Model(&models.Stream{}).Where("status = ?", "scheduled").Count(&scheduledStreamCount)
	metrics.SetScheduledStreamsCount(int(scheduledStreamCount))

	// add total stream count metrics
	var totalStreamCount int64
	h.DB.Model(&models.Stream{}).Count(&totalStreamCount)
	metrics.SetTotalStreamsCount(int(totalStreamCount))
}
