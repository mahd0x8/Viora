# Viora

A real-time synchronized video watch party app. Host a room, share the link, and play/pause/seek stay perfectly in sync for everyone.

---

## Features

- **Google Drive video** — paste any publicly shared Drive link to host a video
- **Synchronized playback** — play, pause, and seek are broadcast instantly to all viewers
- **Room chat** — live chat sidebar with named participants
- **No accounts** — rooms are identified by a short URL; anyone with the link can join
- **LAN & Docker ready** — runs locally or in a container accessible across your network

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Real-time | Socket.io |
| Server | Custom Express + Socket.io wrapping Next.js |
| Styling | Tailwind CSS |
| Runtime | Node.js 20 |
| Container | Docker (multi-stage, `node:20-slim`) |

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+

### Run locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Run on a local network (LAN)

Other devices on the same Wi-Fi can access the app directly. Find your machine's IP:

```bash
ip route get 1.1.1.1 | awk '{print $7; exit}'
```

Then open `http://<your-ip>:3000` on any device on the same network.

---

## Docker

### Build and run

```bash
docker compose up --build
```

### Rebuild from scratch

```bash
docker compose build --no-cache && docker compose up
```

The container listens on port `3000`. Access it at `http://localhost:3000` or `http://<your-ip>:3000` from other LAN devices.

> **Note:** The `docker-compose.yml` sets `network: host` for the build stage so `npm ci` can reach the npm registry. This is required on Linux hosts where Docker's default bridge DNS may be blocked.

---

## How It Works

### Creating a room

1. Upload your video to Google Drive and set sharing to **Anyone with the link**
2. Copy the share URL (`https://drive.google.com/file/d/.../view`)
3. Paste it into Viora and click **Create Room**
4. A room URL is generated — share it with your partner

### Joining a room

Open the room link, enter your name, and the video starts in sync with everyone already watching.

### Sync mechanism

- Play, pause, and seek events are emitted via Socket.io to all participants
- When a new viewer joins, an existing participant sends their current timestamp and play state so the late joiner catches up immediately
- An `isRemoteAction` flag prevents received events from being re-broadcast

### Video proxy

Google Drive's share URLs aren't directly streamable in `<video>` tags (CORS + redirect chain). Viora proxies requests through a Next.js API route (`/api/video?id=FILE_ID`) which follows Google's redirects server-side and streams the video back with proper range-request support for seeking.

---

## Project Structure

```
Viora/
├── server.ts                    # Express + Socket.io server wrapping Next.js
├── next.config.js
├── docker-compose.yml
├── Dockerfile
└── src/
    ├── app/
    │   ├── page.tsx             # Home — create a room
    │   ├── room/[id]/
    │   │   ├── page.tsx         # Server component (resolves params)
    │   │   └── RoomClient.tsx   # Video player + chat + socket sync
    │   └── api/video/route.ts   # Google Drive video proxy
    └── lib/
        └── socket.ts            # Singleton socket.io-client
```

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
