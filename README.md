# YouTube Live Stream Manager (Gin + WebSocket)

## Features
- Gin backend with WebSocket endpoint
- Bootstrap 5 + jQuery frontend
- Manage YouTube live stream (stream key input, start/stop buttons)

## Running

1. Install Go 1.20+
2. Run:
   ```bash
   go mod tidy
   go run ./cmd/main.go
   ```
3. Open [http://localhost:8080](http://localhost:8080)

## Next Steps
- Integrate actual YouTube Live API for real streaming
- Add authentication
- Improve UI and error handling
