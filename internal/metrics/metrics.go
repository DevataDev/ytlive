package metrics

import (
	"runtime"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/mem"
)

var (
	registry = prometheus.NewRegistry()
	once     sync.Once

	// System metrics
	cpuUsage = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "ytlive_system_cpu_usage_percent",
		Help: "Current CPU usage in percent",
	})

	memoryUsage = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "ytlive_system_memory_usage_bytes",
		Help: "Current memory usage in bytes",
	})

	memoryTotal = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "ytlive_system_memory_total_bytes",
		Help: "Total system memory in bytes",
	})

	goroutines = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "ytlive_goroutines_count",
		Help: "Number of goroutines",
	})

	// Stream metrics
	activeStreams = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "ytlive_active_streams_count",
		Help: "Number of currently active streams",
	})

	streamErrors = promauto.NewCounter(prometheus.CounterOpts{
		Name: "ytlive_stream_errors_total",
		Help: "Total number of stream errors",
	})

	startedStreams = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "ytlive_started_streams_count",
		Help: "Number of started streams",
	})

	scheduledStreams = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "ytlive_scheduled_streams_count",
		Help: "Number of scheduled streams",
	})

	totalStreams = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "ytlive_total_streams_count",
		Help: "Total number of streams",
	})

	streamBitrate = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "ytlive_stream_bitrate_kbps",
			Help: "Current bitrate of streams in kbps",
		},
		[]string{"stream_id", "platform"},
	)

	streamViewers = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "ytlive_stream_viewers_count",
			Help: "Current number of viewers per stream",
		},
		[]string{"stream_id", "platform"},
	)

	// TikTok specific metrics
	tiktokMirrors = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "ytlive_tiktok_mirrors_count",
		Help: "Number of active TikTok mirrors",
	})

	// User metrics
	registeredUsers = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "ytlive_registered_users_count",
		Help: "Total number of registered users",
	})

	activeUsers = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "ytlive_active_users_count",
		Help: "Number of users active in the last 24 hours",
	})
)

// Init initializes the metrics collection
func Init() {
	once.Do(func() {
		// Register all metrics with Prometheus
		prometheus.DefaultRegisterer.MustRegister(registry)

		// Start collecting system metrics
		go collectSystemMetrics()
	})
}

// collectSystemMetrics periodically collects system metrics
func collectSystemMetrics() {
	for {
		// CPU usage
		cpuPercent, err := cpu.Percent(0, false)
		if err == nil && len(cpuPercent) > 0 {
			cpuUsage.Set(cpuPercent[0])
		}

		// Memory usage
		memInfo, err := mem.VirtualMemory()
		if err == nil {
			memoryUsage.Set(float64(memInfo.Used))
			memoryTotal.Set(float64(memInfo.Total))
		}

		// Goroutines count
		goroutines.Set(float64(runtime.NumGoroutine()))

		time.Sleep(15 * time.Second)
	}
}

// SetActiveStreamsCount sets the number of active streams
func SetActiveStreamsCount(count int) {
	activeStreams.Set(float64(count))
}

// IncrementStreamErrors increments the stream error counter
func IncrementStreamErrors() {
	streamErrors.Inc()
}

// SetStreamBitrate sets the bitrate for a specific stream
func SetStreamBitrate(streamID, platform string, bitrate float64) {
	streamBitrate.WithLabelValues(streamID, platform).Set(bitrate)
}

// SetStreamViewers sets the viewer count for a specific stream
func SetStreamViewers(streamID, platform string, viewers int) {
	streamViewers.WithLabelValues(streamID, platform).Set(float64(viewers))
}

// SetTikTokMirrorsCount sets the number of active TikTok mirrors
func SetTikTokMirrorsCount(count int) {
	tiktokMirrors.Set(float64(count))
}

// SetRegisteredUsersCount sets the total number of registered users
func SetRegisteredUsersCount(count int) {
	registeredUsers.Set(float64(count))
}

// SetActiveUsersCount sets the number of active users
func SetActiveUsersCount(count int) {
	activeUsers.Set(float64(count))
}

// SetStartedStreamsCount sets the number of started streams
func SetStartedStreamsCount(count int) {
	startedStreams.Set(float64(count))
}

// SetScheduledStreamsCount sets the number of scheduled streams
func SetScheduledStreamsCount(count int) {
	scheduledStreams.Set(float64(count))
}

// SetTotalStreamsCount sets the total number of streams
func SetTotalStreamsCount(count int) {
	totalStreams.Set(float64(count))
}
