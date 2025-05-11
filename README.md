# YouTube & TikTok Live Stream Manager

A full-featured live stream management platform for YouTube and TikTok, built with Go (Gin), GORM, Bootstrap 5, jQuery, and WebSocket. Includes advanced monitor management, token refresh, and channel binding mechanisms.

## Features
- Gin backend with WebSocket endpoints
- Bootstrap 5 + jQuery frontend
- Manage YouTube and TikTok live streams
- Monitor TikTok users and bind YouTube channels to monitors
- Bind channels to streams and monitors via UI modals
- Automatic YouTube token refresh with background worker
- Dynamic script loading with versioning
- RESTful API and JWT-based authentication

## Architecture
- **Backend:** Go, Gin, GORM, WebSocket
- **Frontend:** Bootstrap 5, jQuery
- **Integrations:** YouTube Data API, TikTok
- **Database Models:**
  - `Channels` (with `ExpiresAt` for token expiration)
  - `Monitor` (with optional `ChannelId` for binding)

## Running

1. Install Go 1.20+
2. Copy and edit `config.yaml` for your environment (YouTube/TikTok API keys, DB, etc).
3. Run:
   ```bash
   go mod tidy
   go run ./cmd/main.go
   ```
4. Open [http://localhost:8080](http://localhost:8080)

## Usage

- **Monitor Management:**
  - Add TikTok users to monitor.
  - Use the "Bind" button to associate a YouTube channel and stream with a monitor.
  - Remove or update monitors as needed.
- **Channel Binding:**
  - Both stream and monitor lists have a "Bind Channel" button.
  - Select a channel and a live stream from the modal, then save.
- **Token Management:**
  - Tokens are refreshed automatically by a background worker.

## API Endpoints (Highlights)
- `PUT /api/monitors/:id/channel-id` — Bind a channel and stream to a monitor
- `PUT /api/monitors/:id/rtmp-url` — Update RTMP URL for a monitor
- `PUT /api/monitors/:id/stream-key` — Update stream key for a monitor
- `GET /api/youtube/list-channels` — List all YouTube channels
- `GET /api/youtube/channel/:id/streams` — List live streams for a channel

## Next Steps
- Extend TikTok integration
- Add more robust error handling and logging
- Improve UI/UX further
- Expand test coverage

---

For more details, see the code and comments in each module. Contributions and suggestions are welcome!
