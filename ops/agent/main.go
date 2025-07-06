package main

import (
    "log"
    "os"
    "time"

    "github.com/go-resty/resty/v2"
    "github.com/joho/godotenv"
    "github.com/shirou/gopsutil/v3/cpu"
    "github.com/shirou/gopsutil/v3/disk"
    "github.com/shirou/gopsutil/v3/mem"
    "github.com/shirou/gopsutil/v3/net"
)

type Metrics struct {
    CPUPercent   float64 `json:"cpu_percent"`
    MemoryUsedMB uint64  `json:"memory_used_mb"`
    DiskReadMB   uint64  `json:"disk_read_mb"`
    DiskWriteMB  uint64  `json:"disk_write_mb"`
    NetRecvMB    uint64  `json:"net_recv_mb"`
    NetSentMB    uint64  `json:"net_sent_mb"`
}

type RegisterPayload struct {
    ID      string  `json:"id"`
    Name    string  `json:"name"`
    Address string  `json:"address"`
    Status  string  `json:"status"`
    Metrics Metrics `json:"metrics"`
}

func collectMetrics() Metrics {
    cpuPercents, _ := cpu.Percent(0, false)
    vm, _ := mem.VirtualMemory()
    ioCounters, _ := disk.IOCounters()
    netIO, _ := net.IOCounters(false)

    var readMB, writeMB uint64
    for _, v := range ioCounters {
        readMB += v.ReadBytes / (1024 * 1024)
        writeMB += v.WriteBytes / (1024 * 1024)
    }

    return Metrics{
        CPUPercent:   cpuPercents[0],
        MemoryUsedMB: vm.Used / (1024 * 1024),
        DiskReadMB:   readMB,
        DiskWriteMB:  writeMB,
        NetRecvMB:    netIO[0].BytesRecv / (1024 * 1024),
        NetSentMB:    netIO[0].BytesSent / (1024 * 1024),
    }
}

func main() {
    _ = godotenv.Load()

    backend := os.Getenv("OPS_BACKEND_URL")
    agentID := os.Getenv("AGENT_ID")
    name := os.Getenv("AGENT_NAME")
    if backend == "" || agentID == "" {
        log.Fatal("OPS_BACKEND_URL and AGENT_ID must be set")
    }

    client := resty.New()

    for {
        payload := RegisterPayload{
            ID:      agentID,
            Name:    name,
            Address: getOutboundIP(),
            Status:  "online",
            Metrics: collectMetrics(),
        }

        _, err := client.R().
            SetHeader("Content-Type", "application/json").
            SetBody(payload).
            Post(backend + "/agents/heartbeat")
        if err != nil {
            log.Println("heartbeat error:", err)
        }
        time.Sleep(30 * time.Second)
    }
}

// getOutboundIP is a best-effort helper to discover agent IP.
func getOutboundIP() string {
    // simplified; real implementation omitted for brevity
    host, _ := os.Hostname()
    return host
}
