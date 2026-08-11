# Nexus Editor

🔥 **Live Demo:** [https://editor.nikunjgajera.me](https://editor.nikunjgajera.me)

A real-time collaborative code editor with persistent rooms, live code synchronization, and self-hosted Docker-based code execution.

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
        v             v        (real-time state)
   PostgreSQL     Docker
  (persistent)   (code execution)
```

### Responsibility Separation

| Layer | Responsibility |
|-------|---------------|
| **PostgreSQL** | Persistent room data (code, language, timestamps). Survives restarts. |
| **Redis** | Real-time ephemeral state (latest code cache, language cache, 24h TTL). Fast reads for active rooms. |
| **WebSocket (Socket.IO)** | Real-time collaboration (code sync, cursor sharing, user presence, notifications). |
| **Express API** | REST endpoints for room lookup and code execution. |
| **Docker** | Isolated code execution. Ephemeral containers per run. |
| **Next.js** | Frontend application, routing, editor UI. |

## Features

- **Real-time collaboration** — Multiple users can edit the same code simultaneously
- **Persistent rooms** — Code is saved to PostgreSQL and survives browser refresh, disconnects, and server restarts
- **Room-based URLs** — Each room has a unique URL (`/room/abc123`) that can be shared
- **Live cursor sharing** — See other users' cursor positions in real-time
- **Online user count** — See who's in the room
- **Self-hosted code execution** — Run code in isolated Docker containers (no external API dependency)
- **Multi-language support** — JavaScript, TypeScript, Python, PHP
- **Resizable terminal** — Drag to resize the terminal output panel

## Supported Languages

| Language | Docker Image | Size |
|----------|-------------|------|
| JavaScript | `node:20-alpine` | ~50MB |
| TypeScript | `node:20-alpine` | ~50MB |
| Python | `python:3.12-alpine` | ~55MB |
| PHP | `php:8.3-cli-alpine` | ~30MB |

## Prerequisites

- **Node.js** v20+
- **Docker Desktop** (for code execution)
- **PostgreSQL** (cloud-hosted or local via Docker)
- **Redis** (cloud-hosted or local via Docker)

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

### Option A: Cloud-hosted databases (Recommended for deployment)

1. Set up a PostgreSQL database (e.g., [Neon](https://neon.tech))
2. Set up a Redis instance (e.g., [Aiven](https://aiven.io) or [Upstash](https://upstash.com))
3. Copy `server/.env.example` to `server/.env` and fill in your connection strings

### Option B: Local databases via Docker

```bash
docker compose up -d
```

Then use these in your `server/.env`:
```env
DATABASE_URL="postgresql://myuser:mypassword@localhost:5432/sync_db"
REDIS_URL="redis://localhost:6379"
```

### Start the application

```bash
# Terminal 1: Start the backend
cd server
npm install
npx prisma db push
npx prisma generate
npm run dev

# Terminal 2: Start the frontend
cd web
npm install
npm run dev
```

### Pre-pull Docker images (first time only)

```bash
docker pull node:20-alpine
docker pull python:3.12-alpine
docker pull php:8.3-cli-alpine
```

## How It Works

### Room Flow

1. User visits `http://localhost:3000/`
2. Enters display name and room ID (or generates a random one)
3. Clicks "Join Room" → navigates to `/room/[roomId]`
4. Backend checks if room exists:
   - **Exists**: Load saved code and language from Redis (or PostgreSQL fallback)
   - **New**: Create room in PostgreSQL with default code
5. User joins the Socket.IO room for real-time collaboration

### Data Persistence

```
User types code
     |
     v
Broadcast to other users (instant, via WebSocket)
     |
     v
Cache in Redis (immediate, 24h TTL)
     |
     v
Debounced write to PostgreSQL (2 seconds after typing stops)
```

- **On last user disconnect**: Redis state is immediately flushed to PostgreSQL
- **On room rejoin**: Redis is checked first (latest), PostgreSQL is fallback (source of truth)

### Code Execution

```
Frontend → POST /api/execute → Express server → Docker
     |
     v
Create temporary container:
  - --rm (auto-cleanup)
  - --network none (no internet)
  - --memory 128m
  - --cpus 0.5
  - --pids-limit 64
  - --user 1000:1000 (non-root)
  - --read-only filesystem
  - 10 second timeout
     |
     v
Execute code → Capture stdout/stderr → Return result → Container removed
```

### Security Restrictions

| Restriction | Purpose |
|------------|---------|
| `--network none` | No internet access from user code |
| `--memory 128m` | Prevent memory bombs |
| `--cpus 0.5` | Prevent CPU monopolization |
| `--pids-limit 64` | Prevent fork bombs |
| `--user 1000:1000` | Non-root execution |
| `--read-only` | Immutable root filesystem |
| `--rm` | Auto-cleanup after exit |
| `--security-opt no-new-privileges` | No privilege escalation |
| 10s timeout | Kill long-running/infinite loops |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Health check |
| `GET` | `/api/rooms/:roomId` | Check if a room exists |
| `POST` | `/api/execute` | Execute code in Docker container |

### POST /api/execute

**Request:**
```json
{
  "language": "javascript",
  "code": "console.log('Hello, World!');"
}
```

**Response:**
```json
{
  "stdout": "Hello, World!\n",
  "stderr": "",
  "exitCode": 0,
  "timedOut": false
}
```

## Project Structure

```
Nexus-Editor/
├── docker-compose.yml          # Local Postgres + Redis (optional)
├── server/
│   ├── .env                    # Environment variables (not committed)
│   ├── .env.example            # Environment template
│   ├── prisma/
│   │   └── schema.prisma       # Database schema
│   └── src/
│       ├── index.ts            # Express + Socket.IO server
│       ├── config/
│       │   ├── redis.ts        # Redis client setup
│       │   └── languages.ts    # Language → Docker image mapping
│       └── routes/
│           ├── execute.ts      # Code execution endpoint
│           └── rooms.ts        # Room lookup endpoint
└── web/
    ├── app/
    │   ├── page.tsx            # Landing page (join/create room)
    │   ├── layout.tsx          # Root layout
    │   ├── globals.css         # Global styles
    │   └── room/
    │       └── [roomId]/
    │           └── page.tsx    # Room editor page
    └── components/
        └── CollaborativeEditor.tsx  # Monaco editor + collaboration
```

## License

ISC
