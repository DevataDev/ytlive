package main

import "github.com/gorilla/websocket"

// wsReader adapts websocket connection to io.Reader for stdin of shell
// It reads binary/text messages and copies payload.
type wsReader struct{ c *websocket.Conn }

func (w *wsReader) Read(p []byte) (int, error) {
	_, msg, err := w.c.ReadMessage()
	if err != nil {
		return 0, err
	}
	n := copy(p, msg)
	return n, nil
}

// wsWriter adapts io.Writer (stdout/stderr) to websocket binary messages
// Each Write sends the provided bytes as a BinaryMessage.
type wsWriter struct{ c *websocket.Conn }

func (w *wsWriter) Write(p []byte) (int, error) {
	if err := w.c.WriteMessage(websocket.BinaryMessage, p); err != nil {
		return 0, err
	}
	return len(p), nil
}
