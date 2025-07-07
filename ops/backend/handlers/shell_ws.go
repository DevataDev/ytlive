package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/devatadev/ytlive/ops/backend/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"gorm.io/gorm"
)

// Bridge stores paired client and agent websocket connections.

type ShellWSHandler struct{ DB *gorm.DB }

type Bridge struct {
	client *websocket.Conn
	agent  *websocket.Conn
	mutex  sync.Mutex
}

var (
	upgrader     = websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	bridges      = make(map[string]*Bridge) // key: channelID
	bridgesMu    sync.Mutex
	pingInterval = 15 * time.Second
	pongWait     = 30 * time.Second
)

// ShellClientWS upgrades client HTTP to WS, creates channel, returns channel ID, and waits for agent.
func (h *ShellWSHandler) Client(c *gin.Context) {
	serverID := c.Query("server")
	if serverID == "" {
		c.JSON(400, gin.H{"error": "missing server"})
		return
	}
	channelID := uuid.NewString()
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	setupWS(conn, "client")

	bridgesMu.Lock()
	br := &Bridge{client: conn}
	bridges[channelID] = br
	bridgesMu.Unlock()

	// // Send initial message containing channelID so frontend knows.
	// _ = conn.WriteJSON(map[string]string{"channel": channelID})

	// enqueue task for agent
	data, _ := json.Marshal(map[string]string{"channel": channelID})
	taskId := ulidString()
	h.DB.Create(&models.Task{
		ID:       taskId,
		ServerID: serverID,
		Type:     "shell_session",
		Data:     string(data),
		Status:   "pending",
	})

	// send back task id to client
	// _ = conn.WriteJSON(map[string]string{"task_id": taskId})
	_ = conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("Establishing Session %s Please Wait ....\r\n", taskId)))

	// Wait until agent connects
	waitChan := make(chan struct{})

	go func() {
		for {
			br.mutex.Lock()
			a := br.agent
			br.mutex.Unlock()
			if a != nil {
				close(waitChan)
				return
			}
		}
	}()

	<-waitChan // now paired

	pipe(connections{client: conn, agent: br.agent})
}

// AgentShellWS called by agent with ?channel=<id>. It upgrades and pairs.
func (h *ShellWSHandler) Agent(c *gin.Context) {
	channelID := c.Query("channel")
	if channelID == "" {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	setupWS(conn, "agent")

	bridgesMu.Lock()
	br, ok := bridges[channelID]
	if !ok {
		bridgesMu.Unlock()
		conn.Close()
		return
	}
	br.mutex.Lock()
	br.agent = conn
	br.mutex.Unlock()
	bridgesMu.Unlock()

	pipe(connections{client: br.client, agent: conn})
}

type connections struct {
	client *websocket.Conn
	agent  *websocket.Conn
}

func pipe(p connections) {
	log.Println("pipe started")
	var wg sync.WaitGroup

	relay := func(srcName string, src, dst *websocket.Conn) {
		defer wg.Done()
		for {
			mt, msg, err := src.ReadMessage()
			if err != nil {
				if ce, ok := err.(*websocket.CloseError); ok {
					log.Printf("%s closed: %d %s", srcName, ce.Code, ce.Text)
				} else {
					log.Printf("%s read err: %v", srcName, err)
				}
				_ = dst.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""), time.Now().Add(time.Second))
				return
			}
			if err := dst.WriteMessage(mt, msg); err != nil {
				log.Printf("write err: %v", err)
				return
			}
		}
	}

	wg.Add(2)
	go relay("client", p.client, p.agent)
	go relay("agent", p.agent, p.client)
	wg.Wait()
	_ = p.client.Close()
	_ = p.agent.Close()
	log.Println("pipe ended")
}

// setupWS configures ping/pong keep-alive and close logging.
func setupWS(c *websocket.Conn, label string) {
	c.SetReadLimit(1 << 20)
	c.SetReadDeadline(time.Now().Add(pongWait))
	c.SetPongHandler(func(string) error {
		c.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})
	c.SetCloseHandler(func(code int, text string) error {
		log.Printf("ws %s closed: %d %s", label, code, text)
		return nil
	})
	// periodic ping
	ticker := time.NewTicker(pingInterval)
	go func() {
		for range ticker.C {
			if err := c.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(5*time.Second)); err != nil {
				log.Printf("ping %s err: %v", label, err)
				c.Close()
				return
			}
		}
	}()
}
