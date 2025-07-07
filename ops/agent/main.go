package main

import (
	"bufio"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/creack/pty"
	"github.com/gorilla/websocket"

	"github.com/go-resty/resty/v2"
	"github.com/joho/godotenv"
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/load"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
)

var (
	AgentVersion = "1.0.5"
	AgentName    = "ops-agent"
)

// Metrics represents the minimal set of stats we ship to /agent/heartbeat.
// Task returned by panel
type Task struct {
	ID        string                 `json:"id"`
	Type      string                 `json:"type"`
	Data      map[string]interface{} `json:"data"`
	Status    string                 `json:"status"`
	Output    string                 `json:"output"`
	CreatedAt time.Time              `json:"created_at"`
	UpdatedAt time.Time              `json:"updated_at"`
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
			SetHeader("X-Agent-Name", AgentName).
			SetHeader("X-Agent-Version", AgentVersion).
			SetBody(map[string]interface{}{
				"task_id": t.ID,
				"status":  status,
				"output":  output,
			}).
			Post(backend + "/agent/tasks/result")
	case "shell_session":
		ch, ok := t.Data["channel"].(string)
		if !ok {
			log.Println("shell_session missing channel")
			return
		}
		// update task result
		_, _ = cli.R().
			SetHeader("X-Agent-Key", key).
			SetHeader("X-Agent-Name", AgentName).
			SetHeader("X-Agent-Version", AgentVersion).
			SetBody(map[string]interface{}{
				"task_id": t.ID,
				"status":  "running",
				"output":  "",
			}).
			Post(backend + "/agent/tasks/result")
		log.Println("shell_session channel:", ch)
		var wsURL string
		if strings.HasPrefix(backend, "https://") {
			wsURL = "wss://" + strings.TrimPrefix(backend, "https://") + "/agent/ws/shell?channel=" + ch
		} else if strings.HasPrefix(backend, "http://") {
			wsURL = "ws://" + strings.TrimPrefix(backend, "http://") + "/agent/ws/shell?channel=" + ch
		} else {
			wsURL = backend + "/agent/ws/shell?channel=" + ch
		}

		log.Println("ws url:", wsURL)
		dialer := websocket.Dialer{
			EnableCompression: false,
		}
		header := http.Header{"X-Agent-Key": []string{key}, "X-Agent-Name": []string{AgentName}, "X-Agent-Version": []string{AgentVersion}}
		conn, _, err := dialer.Dial(wsURL, header)
		if err != nil {
			log.Println("ws dial err:", err)
			// update task result
			_, _ = cli.R().
				SetHeader("X-Agent-Key", key).
				SetHeader("X-Agent-Name", AgentName).
				SetHeader("X-Agent-Version", AgentVersion).
				SetBody(map[string]interface{}{
					"task_id": t.ID,
					"status":  "error",
					"output":  err.Error(),
				}).
				Post(backend + "/agent/tasks/result")
			return
		}
		cmd := exec.Command("bash", "--login")
		cmd.Env = append(os.Environ(), "TERM=xterm-256color")
		ptmx, errP := pty.Start(cmd)
		// set a sane initial window size so full-screen programs don't exit
		_ = pty.Setsize(ptmx, &pty.Winsize{Rows: 24, Cols: 80})
		log.Println("pty started")
		if errP != nil {
			log.Println("pty start error:", errP)
			// update task result
			_, _ = cli.R().
				SetHeader("X-Agent-Key", key).
				SetHeader("X-Agent-Name", AgentName).
				SetHeader("X-Agent-Version", AgentVersion).
				SetBody(map[string]interface{}{
					"task_id": t.ID,
					"status":  "error",
					"output":  errP.Error(),
				}).
				Post(backend + "/agent/tasks/result")
			conn.Close()
			return
		}
		// Ensure the PTY is closed when done.
		defer func() {
			_ = ptmx.Close()
			// update task result
			_, _ = cli.R().
				SetHeader("X-Agent-Key", key).
				SetHeader("X-Agent-Name", AgentName).
				SetHeader("X-Agent-Version", AgentVersion).
				SetBody(map[string]interface{}{
					"task_id": t.ID,
					"status":  "ok",
					"output":  "finished",
				}).
				Post(backend + "/agent/tasks/result")
			conn.Close()
		}()
		// monitor shell exit – if bash dies, close websocket to inform backend
		go func() {
			_ = cmd.Wait()
			// send close to backend side
			_ = conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, "shell exited"), time.Now().Add(time.Second))
		}()

		// Pipe data between websocket and PTY
		go func() { _, _ = io.Copy(ptmx, &wsReader{c: conn}) }()
		_, _ = io.Copy(&wsWriter{c: conn}, ptmx)
	case "docker_update":
		img, _ := t.Data["image"].(string)
		ctr, _ := t.Data["container"].(string)
		if img == "" || ctr == "" {
			log.Println("docker_update missing image or container")
			return
		}
		out, err := updateDockerContainer(img, ctr)
		status := "ok"
		if err != nil {
			status = "error"
			out = err.Error()
		}
		_, _ = cli.R().
			SetHeader("X-Agent-Key", key).
			SetHeader("X-Agent-Name", AgentName).
			SetHeader("X-Agent-Version", AgentVersion).
			SetBody(map[string]any{"task_id": t.ID, "status": status, "output": out}).
			Post(backend + "/agent/tasks/result")
	default:
		log.Printf("unknown task type %s", t.Type)
	}
}

// updateDockerContainer pulls latest image and restarts the container
func updateDockerContainer(image, container string) (string, error) {
	cmds := [][]string{
		{"docker", "pull", image},
		{"docker", "stop", container},
		{"docker", "rm", container},
		{"docker", "run", "-d", "--name", container, image},
	}
	var output strings.Builder
	for _, args := range cmds {
		cmd := exec.Command(args[0], args[1:]...)
		out, err := cmd.CombinedOutput()
		output.Write(out)
		if err != nil {
			return output.String(), err
		}
	}
	return output.String(), nil
}

func runShell(cmd string) (string, error) {
	// Simple execution using sh -c, limited stdout capture.
	out, err := exec.Command("sh", "-c", cmd).CombinedOutput()
	return string(out), err
}

// Container mirrors backend models.Container (json subset)
type Container struct {
	ID     string `json:"id,omitempty"`
	Name   string `json:"name"`
	Image  string `json:"image"`
	Status string `json:"status"`
	Ports  string `json:"ports"`
	Uptime string `json:"uptime"`
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
		OSName:        hInfo.Platform + " " + hInfo.PlatformVersion,
		UptimeSec:     uptime,
		Load1:         loadAvg.Load1,
		Load5:         loadAvg.Load5,
		Load15:        loadAvg.Load15,
	}, totalBytes
}

// collectDocker runs `docker ps` and converts output into Container slice
func collectDocker() []Container {
	cmd := exec.Command("docker", "ps", "--format", "{{.ID}};;{{.Names}};;{{.Image}};;{{.Status}};;{{.Ports}};;{{.RunningFor}}")
	out, err := cmd.Output()
	if err != nil {
		return nil
	}
	var list []Container
	scanner := bufio.NewScanner(strings.NewReader(string(out)))
	for scanner.Scan() {
		parts := strings.SplitN(scanner.Text(), ";;", 6)
		if len(parts) < 6 {
			continue
		}
		list = append(list, Container{
			Name:   parts[1],
			Image:  parts[2],
			Status: parts[3],
			Ports:  parts[4],
			Uptime: parts[5],
		})
	}
	return list
}

func collectEnv() map[string]string {
	kv := make(map[string]string)
	for _, e := range os.Environ() {
		parts := strings.SplitN(e, "=", 2)
		if len(parts) == 2 {
			kv[parts[0]] = parts[1]
		}
	}
	return kv
}

func startReportLoops(cli *resty.Client, backend, key string) {
	go func() {
		dockerTicker := time.NewTicker(60 * time.Second)
		envTicker := time.NewTicker(300 * time.Second)
		for {
			select {
			case <-dockerTicker.C:
				containers := collectDocker()
				if containers == nil {
					continue
				}
				_, err := cli.R().
					SetHeader("X-Agent-Key", key).
					SetHeader("X-Agent-Name", AgentName).
					SetHeader("X-Agent-Version", AgentVersion).
					SetBody(containers).
					Post(backend + "/agent/report/docker")
				if err != nil {
					log.Println("docker report err:", err)
				}
			case <-envTicker.C:
				envs := collectEnv()
				_, err := cli.R().
					SetHeader("X-Agent-Key", key).
					SetHeader("X-Agent-Name", AgentName).
					SetHeader("X-Agent-Version", AgentVersion).
					SetBody(envs).
					Post(backend + "/agent/report/env")
				if err != nil {
					log.Println("env report err:", err)
				}
			}
		}
	}()
}

func main() {
	_ = godotenv.Load()

	backend := os.Getenv("OPS_BACKEND_URL")
	agentKey := os.Getenv("AGENT_KEY")

	log.Println("Agent : ", AgentName, "Version : ", AgentVersion, "Backend : ", backend, " Started...")
	if backend == "" || agentKey == "" {
		log.Fatal("OPS_BACKEND_URL and AGENT_KEY must be set")
	}

	client := resty.New()
	// start reporting loops
	startReportLoops(client, backend, agentKey)
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
			SetHeader("X-Agent-Name", AgentName).
			SetHeader("X-Agent-Version", AgentVersion).
			SetBody(metrics).
			Post(backend + "/agent/heartbeat")
		log.Println("heartbeat sent")
		if err != nil {
			log.Println("heartbeat error:", err)
		}

		// poll tasks
		var resp struct {
			Tasks []Task `json:"tasks"`
		}
		log.Println("polling tasks")
		_, err = client.R().
			SetHeader("X-Agent-Key", agentKey).
			SetHeader("X-Agent-Name", AgentName).
			SetHeader("X-Agent-Version", AgentVersion).
			SetResult(&resp).
			Get(backend + "/agent/tasks")
		log.Println("tasks polled")
		if err == nil && len(resp.Tasks) > 0 {
			log.Printf("received %d tasks\n", len(resp.Tasks))
			for _, t := range resp.Tasks {
				go handleTask(client, backend, agentKey, t)
			}
		} else {
			if err != nil {
				log.Println("tasks error:", err)
			}
			log.Println("response 	: ", resp)
			log.Println("no tasks")
		}

		// wait exactly interval duration
		time.Sleep(time.Until(start.Add(interval)))
	}
}
