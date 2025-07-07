package main

import (
	"log"
	"os"
	"os/exec"
	"time"

	"github.com/go-resty/resty/v2"
	"github.com/joho/godotenv"
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
    "github.com/shirou/gopsutil/v3/host"
    "github.com/shirou/gopsutil/v3/load"
)

// Metrics represents the minimal set of stats we ship to /agent/heartbeat.
// Task returned by panel
type Task struct {
	ID   string         `json:"id"`
	Type string         `json:"type"`
	Data map[string]any `json:"data"`
}

// handleTask executes a single task in a goroutine.
func handleTask(cli *resty.Client, backend, key string, t Task) {
	log.Printf("handling task %s of type %s", t.ID, t.Type)

	// For initial implementation we support simple shell commands.
	switch t.Type {
	case "shell":
		cmdStr, ok := t.Data["cmd"].(string)
		if !ok {
			log.Println("task missing cmd string")
			return
		}
		output, err := runShell(cmdStr)
		status := "ok"
		if err != nil {
			status = "error"
			output = err.Error()
		}
		// report result
		_, _ = cli.R().
			SetHeader("X-Agent-Key", key).
			SetBody(map[string]any{
				"task_id": t.ID,
				"status":  status,
				"output":  output,
			}).
			Post(backend + "/agent/tasks/result")
	default:
		log.Printf("unknown task type %s", t.Type)
	}
}

func runShell(cmd string) (string, error) {
	// Simple execution using sh -c, limited stdout capture.
	out, err := exec.Command("sh", "-c", cmd).CombinedOutput()
	return string(out), err
}

type Metrics struct {
	CPUPercent    float64 `json:"cpu_percent"`
	MemUsedMB     uint64  `json:"mem_used_mb"`
	DiskUsedMB    uint64  `json:"disk_used_mb"`
	NetMbps       float64 `json:"net_mbps"`
	StreamsTotal  int     `json:"streams_total"`
	StreamsActive int     `json:"streams_active"`
	StreamsSched  int     `json:"streams_scheduled"`
    OSName        string  `json:"os_name"`
    UptimeSec     uint64  `json:"uptime_sec"`
    Load1         float64 `json:"load_1"`
    Load5         float64 `json:"load_5"`
    Load15        float64 `json:"load_15"`
}

func collectMetrics(prevBytes uint64, intervalSec float64) (Metrics, uint64) {
	cpuPerc, _ := cpu.Percent(0, false)
	vm, _ := mem.VirtualMemory()
	du, _ := disk.Usage("/")

	io, _ := net.IOCounters(false)
	totalBytes := io[0].BytesRecv + io[0].BytesSent
	diff := totalBytes - prevBytes
	hInfo, _ := host.Info()
    uptime := hInfo.Uptime
    loadAvg, _ := load.Avg()

    mbps := 0.0
	if intervalSec > 0 {
		mbps = float64(diff*8) / 1_000_000 / intervalSec
	}

	return Metrics{
		CPUPercent:    cpuPerc[0],
		MemUsedMB:     vm.Used / (1024 * 1024),
		DiskUsedMB:    du.Used / (1024 * 1024),
		NetMbps:       mbps,
		StreamsTotal:  0,
		StreamsActive: 0,
		StreamsSched:  0,
        OSName:       hInfo.Platform + " " + hInfo.PlatformVersion,
        UptimeSec:    uptime,
        Load1:        loadAvg.Load1,
        Load5:        loadAvg.Load5,
        Load15:       loadAvg.Load15,
	}, totalBytes
}

func main() {
	_ = godotenv.Load()

	backend := os.Getenv("OPS_BACKEND_URL")
	agentKey := os.Getenv("AGENT_KEY")
	if backend == "" || agentKey == "" {
		log.Fatal("OPS_BACKEND_URL and AGENT_KEY must be set")
	}

	client := resty.New()
	interval := 30 * time.Second
	var lastBytes uint64

	for {
		start := time.Now()

		metrics, bytesNow := collectMetrics(lastBytes, interval.Seconds())
		lastBytes = bytesNow

		// send heartbeat
		_, err := client.R().
			SetHeader("Content-Type", "application/json").
			SetHeader("X-Agent-Key", agentKey).
			SetBody(metrics).
			Post(backend + "/agent/heartbeat")
		if err != nil {
			log.Println("heartbeat error:", err)
		}

		// poll tasks
		var resp struct {
			Tasks []Task `json:"tasks"`
		}
		_, err = client.R().
			SetHeader("X-Agent-Key", agentKey).
			SetResult(&resp).
			Get(backend + "/agent/tasks")
		if err == nil && len(resp.Tasks) > 0 {
			log.Printf("received %d tasks\n", len(resp.Tasks))
			for _, t := range resp.Tasks {
				go handleTask(client, backend, agentKey, t)
			}
		}

		// wait exactly interval duration
		time.Sleep(time.Until(start.Add(interval)))
	}
}
