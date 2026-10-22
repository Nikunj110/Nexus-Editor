# Nexus Editor

🔥 **Live Demo:** [https://editor.nikunjgajera.me](https://editor.nikunjgajera.me)

A real-time collaborative code editor with persistent rooms, live cursor and code synchronization, independent per-language code buffers, and self-hosted Docker-based sandboxed code execution.

## Architecture

```
                    Browser (Next.js)
                         |
               ┌─────────┴──────────┐
               │                    │
            HTTP/API            WebSocket
               │                    │
               v                    v
         Express Server       Socket.IO Server
               │                    │
        ┌──────┴──────┐             v
        │             │           Redis
        v             v     (real-time state &
   PostgreSQL     Docker    per-language cache)
  (persistent)   (sandboxed
                 execution)
```

### Responsibility Separation

| Layer | Responsibility |
|-------|---------------|
| **PostgreSQL** | Persistent room data (code content, active language, timestamps). Survives server restarts. |
| **Redis** | Real-time ephemeral state (`{roomId}:code:{language}` buffers, `{roomId}:language`, 24h TTL). Instant reads for active rooms. |
| **WebSocket (Socket.IO)** | Real-time collaboration (per-language code sync, cursor positions, user presence, join/leave toasts). |
| **Express API** | REST endpoints for room lookup and secure Docker code execution. |
| **Docker** | Isolated code execution in ephemeral, resource-constrained containers. |
| **Next.js** | Frontend application with Monaco Editor, customizable terminal layout, and live presence UI. |

## Features

- **Real-time collaboration** — Multiple users can edit code simultaneously with instant synchronization
- **Per-language code isolation** — Each language (`javascript`, `python`, `cpp`, `c`) maintains an independent code buffer with language-specific boilerplate; switching languages preserves your code
- **Persistent rooms** — Code is automatically saved to PostgreSQL (debounced) and Redis cache (instant); survives refresh and server restarts
- **Room-based URLs** — Shareable unique URLs (`/room/abc123`)
- **Live cursor sharing** — View other users' cursor positions with custom names and colored badges in real-time
- **Online user presence** — Live online count badge with a clickable modal listing all active participants
- **Self-hosted sandboxed code execution** — Execute code in isolated Docker containers with no third-party API dependencies
- **Standard Input (stdin) support** — Dedicated terminal input tab for running interactive programs and competitive programming inputs
- **Multi-language support** — JavaScript, Python, C, and C++
- **Flexible terminal layout** — Toggle between bottom panel and side-by-side panel layout, with drag-to-resize functionality

## Supported Languages

| Language | Runtime / Compiler | Docker Image | Notes |
|----------|-------------------|--------------|-------|
| **JavaScript** | Node.js v20 | `node:20-alpine` | Lightweight (~50MB) |
| **Python** | Python 3.12 | `python:3.12-alpine` | Lightweight (~55MB) |
| **C** | GCC (musl) | `alpine-cpp` | Built from `server/Dockerfile.cpp` (~180MB) |
| **C++** | G++ (musl) | `alpine-cpp` | Built from `server/Dockerfile.cpp` (~180MB) |

## Prerequisites

- **Node.js** v20+
- **Docker Engine / Docker Desktop** (for code execution)
- **PostgreSQL** (cloud-hosted e.g. Neon, or local via Docker)
- **Redis** (cloud-hosted e.g. Aiven/Upstash, or local via Docker)

## Environment Variables

Create `server/.env` based on `server/.env.example`:

```env
# Database (Neon, Supabase, or local Docker)
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"

# Redis (Aiven, Upstash, or local Docker)
REDIS_URL="rediss://user:password@host:port"

# Server port
PORT=3001

# Code execution limits
DOCKER_EXECUTION_TIMEOUT=10000    # 10 seconds
DOCKER_MEMORY_LIMIT=128m          # 128MB per container
```

## Getting Started

### Option A: Cloud-hosted databases (Recommended for production)

1. Set up a PostgreSQL database (e.g., [Neon](https://neon.tech))
2. Set up a Redis instance (e.g., [Aiven](https://aiven.io) or [Upstash](https://upstash.com))
3. Copy `server/.env.example` to `server/.env` and fill in your connection strings

### Option B: Local databases via Docker

```bash
docker compose up -d
```

Then configure `server/.env`:
```env
DATABASE_URL="postgresql://myuser:mypassword@localhost:5432/sync_db"
REDIS_URL="redis://localhost:6379"
```

### Install and Run

```bash
# Terminal 1: Backend
cd server
npm install
npx prisma db push
npx prisma generate
npm run dev

# Terminal 2: Frontend
cd web
npm install
npm run dev
```

### Build & Pull Docker Images (Required for execution)

Pull the runtime images and build the local C/C++ compiler image:

```bash
# Pull Node & Python images
docker pull node:20-alpine
docker pull python:3.12-alpine

# Build C/C++ compiler image
cd server
docker build -t alpine-cpp -f Dockerfile.cpp .
```

## How It Works

### Room Lifecycle & Per-Language State

1. User visits `/` and enters a display name and room ID (or generates a random ID).
2. Navigates to `/room/[roomId]`.
3. Client establishes a WebSocket connection and emits `join-room`.
4. Backend restores the room state:
   - Fetches all language buffers from Redis (`{roomId}:code:{language}`).
   - Fetches active language (`{roomId}:language`).
   - If Redis is cold, falls back to PostgreSQL and initializes language templates.
   - Emits `load-all-codes` and `language-update` to sync the client.
5. When a user switches languages:
   - Current code is cached locally and on the server.
   - Server loads target language buffer and broadcasts `language-code-load` to keep all users in sync with appropriate code.

### Data Persistence Architecture

```
User types code in language X
     |
     v
Broadcast to room: { code, language } (Instant WebSocket)
     |
     v
Cache in Redis: {roomId}:code:{language} (Immediate, 24h TTL)
     |
     v
Debounced write to PostgreSQL (2 seconds after typing stops)
```

- **Per-Language Redis Keys**: `{roomId}:code:{language}` stores independent buffers for `javascript`, `python`, `cpp`, and `c`.
- **Last user disconnect**: All pending debounced saves are flushed immediately from Redis to PostgreSQL.
- **On room rejoin**: Redis is checked first (fast in-memory state), PostgreSQL is the persistent backing store.

### Sandboxed Code Execution

```
Frontend → POST /api/execute → Express server → Temporary Docker Container
     |
     v
Container Launch Flags:
  - --rm (auto-cleanup on exit)
  - --network none (no internet access)
  - --memory 128m (RAM limit)
  - --cpus 0.5 (CPU cap)
  - --pids-limit 64 (fork bomb protection)
  - --user 1000:1000 (non-root user)
  - --read-only (immutable root filesystem)
  - --tmpfs /tmp:rw,exec,nosuid,size=64m (ephemeral writable /tmp for binary compilation)
  - --security-opt no-new-privileges
  - 10 second execution timeout
     |
     v
Child Process: writes stdin (if any) → captures stdout/stderr → returns JSON → container destroyed
```

### Security Guardrails

| Guardrail | Implementation | Protection |
|-----------|----------------|------------|
| **Network Isolation** | `--network none` | Prevents SSRF, data exfiltration, port scanning |
| **Memory Limit** | `--memory 128m` | Prevents host OOM crashes and memory exhaustion attacks |
| **CPU Quota** | `--cpus 0.5` | Prevents CPU monopolization / crypto-mining |
| **Process Cap** | `--pids-limit 64` | Prevents fork bombs (`:(){ :\|:& };:`) |
| **Non-Root Execution** | `--user 1000:1000` | Prevents privilege escalation and container breakout |
| **Read-Only Root** | `--read-only` | Prevents modifications to system libraries and binaries |
| **Execution Timeout** | 10s default (`DOCKER_EXECUTION_TIMEOUT`) | Kills infinite loops (`while(true)`) |
| **Ephemeral Writable Storage** | `--tmpfs /tmp:rw,exec,nosuid,size=64m` | In-memory compilation area for GCC/G++, safely wiped on container destruction |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | API health check |
| `GET` | `/api/rooms/:roomId` | Check if a room exists in PostgreSQL |
| `POST` | `/api/execute` | Execute code in an isolated Docker container |

### POST /api/execute

**Request Body:**
```json
{
  "language": "cpp",
  "code": "#include <iostream>\nusing namespace std;\nint main() {\n    int a, b;\n    if (cin >> a >> b) cout << a + b << endl;\n    else cout << \"Hello from C++!\";\n    return 0;\n}",
  "stdin": "5 10"
}
```

**Response:**
```json
{
  "stdout": "15\n",
  "stderr": "",
  "exitCode": 0,
  "timedOut": false
}
```

## Deployment & CI/CD

Deployment is automated via GitHub Actions (`.github/workflows/deploy.yml`):

1. **Trigger**: Push to `main` branch
2. **Target**: Azure VM running Ubuntu with Docker, Node.js, and PM2
3. **Automated Pipeline**:
   - Pulls latest commit from `main`
   - Builds Next.js frontend (`npm run build`)
   - Compiles TypeScript backend (`npx tsc`)
   - Builds custom `alpine-cpp` Docker image from `server/Dockerfile.cpp`
   - Pre-pulls `node:20-alpine` and `python:3.12-alpine` execution images
   - Restarts backend and frontend via `pm2 restart all`

## Project Structure

```
Nexus-Editor/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions CI/CD to Azure VM
├── docker-compose.yml          # Local Postgres + Redis setup (optional)
├── server/
│   ├── .env                    # Environment variables (not committed)
│   ├── .env.example            # Environment template
│   ├── Dockerfile.cpp          # Alpine image with GCC, G++, and musl-dev
│   ├── prisma/
│   │   └── schema.prisma       # Prisma schema for Room / Document model
│   └── src/
│       ├── index.ts            # Express + Socket.IO server (per-language buffers, presence, debounce)
│       ├── config/
│       │   ├── redis.ts        # Redis client connection
│       │   └── languages.ts    # Language execution configurations & commands
│       └── routes/
│           ├── execute.ts      # Docker execution route with stdin & security flags
│           └── rooms.ts        # Room existence check endpoint
└── web/
    ├── app/
    │   ├── page.tsx            # Landing page (Join / Create Room)
    │   ├── layout.tsx          # Root layout
    │   ├── globals.css         # Styling and design system
    │   └── room/
    │       └── [roomId]/
    │           └── page.tsx    # Room wrapper page
    └── components/
        └── CollaborativeEditor.tsx  # Monaco Editor, WebSocket sync, terminal, cursors
```

## License

ISC
