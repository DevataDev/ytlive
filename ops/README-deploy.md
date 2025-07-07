# Ops Panel Deployment

This directory contains everything needed to containerise and deploy the **Ops Panel** project **without touching the main project stack**.

## Stack

* **PostgreSQL** – database
* **ops-backend** – Go API running on port `8080`
* **ops-frontend** – Next JS 15 front-end running on port `3000`

All three containers live inside an isolated `ops-net` docker-compose network and are completely separate from any `docker-compose.yml` at project root.

## Files Added

| File | Purpose |
|------|---------|
| `ops/docker-compose.yml` | One-shot compose file to run DB, backend & frontend |
| `ops/backend/Dockerfile` | Multi-stage image for the Go backend |
| `ops/frontend/Dockerfile` | Multi-stage image for the Next JS frontend |

## Quick Start (local)

```bash
cd ops
# build and start in background
docker compose up -d --build
# tail logs
docker compose logs -f
```

The front-end will be reachable at http://localhost:3000 and will talk to the back-end via the internal service name.

## Environment variables

Compose already provides sane defaults. Override as needed via `docker compose --env-file <file>` or by exporting beforehand:

```
POSTGRES_PASSWORD=supersecret
ENCRYPTION_KEY=anothersecret
POSTGRES_DSN="host=db user=ops password=supersecret dbname=ops port=5432 sslmode=disable"
```

## Pushing images

If you wish to push images to your registry, you can reuse the script at project root or craft something similar targeting the two new images produced by compose.

---
Feel free to adjust versions, build flags and environment variables to match your production requirements.
