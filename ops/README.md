# Ops Panel

This directory hosts the **Operations Panel** – a standalone tool for managing remote server deployments for the YukLive platform.

Directory layout:

| Path | Purpose |
|------|---------|
| `ops/backend` | Go REST API that authenticates operators, stores encrypted credentials and proxies commands to remote *ops-agent*s. |
| `ops/frontend` | Next.js 15 UI (App Router) for operators to log in, list servers, execute actions and view metrics. |
| `ops/agent`    | Lightweight Go binary meant to run on each managed host (added later). |

The Ops Panel is **physically separated** from the main product code yet lives in the same repository to ease coordinated CI/CD.

> NOTE: This is just the scaffold. Detailed implementation will follow in subsequent commits.
