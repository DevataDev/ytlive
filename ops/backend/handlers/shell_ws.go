package handlers

import (
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

// Bridge stores paired client and agent websocket connections.
type Bridge struct {
	client *websocket.Conn
	agent  *websocket.Conn
	mutex  sync.Mutex
}

var (
	upgrader  = websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	bridges   = make(map[string]*Bridge) // key: channelID
	bridgesMu sync.Mutex
)

// ShellClientWS upgrades client HTTP to WS, creates channel, returns channel ID, and waits for agent.
func ShellClientWS(c *gin.Context) {
	channelID := uuid.NewString()
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	bridgesMu.Lock()
	br := &Bridge{client: conn}
	bridges[channelID] = br
	bridgesMu.Unlock()

	// Send initial message containing channelID so frontend knows.
	_ = conn.WriteJSON(map[string]string{"channel": channelID})

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
func AgentShellWS(c *gin.Context) {
	channelID := c.Query("channel")
	if channelID == "" {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

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
	// relay data both directions
	var wg sync.WaitGroup
	copy := func(src, dst *websocket.Conn) {
		defer wg.Done()
		for {
			mt, msg, err := src.ReadMessage()
			if err != nil {
				dst.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
				return
			}
			_ = dst.WriteMessage(mt, msg)
		}
	}
	wg.Add(2)
	go copy(p.client, p.agent)
	go copy(p.agent, p.client)
	wg.Wait()
	p.client.Close()
	p.agent.Close()
}
