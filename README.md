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

---

## CI/CD — Deploy to Azure Container Apps

Every push to `main` builds a new Docker image, pushes it to GHCR, and deploys it to Azure Container Apps.

```
main branch push
  └─► Build & push image → ghcr.io/<owner>/viora:<sha>
        └─► az containerapp update → Azure Container App
```

### Prerequisites

- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) with the Container Apps extension
- An Azure subscription
- This repo pushed to GitHub

```bash
# Install the Container Apps CLI extension (once)
az extension add --name containerapp --upgrade
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights
```

---

### Step 1 — Create Azure resources (one-time)

```bash
# Variables — change these to your values
LOCATION="eastus"
RG="viora-rg"
ENV="viora-env"
APP="viora"

# Resource group
az group create --name $RG --location $LOCATION

# Container Apps environment
az containerapp env create \
  --name $ENV \
  --resource-group $RG \
  --location $LOCATION

# Container App (initial creation with GHCR credentials)
# Replace GITHUB_USER with your GitHub username
# Replace GHCR_PAT with the token you will create in Step 3
az containerapp create \
  --name $APP \
  --resource-group $RG \
  --environment $ENV \
  --image ghcr.io/GITHUB_USER/viora:latest \
  --registry-server ghcr.io \
  --registry-username GITHUB_USER \
  --registry-password GHCR_PAT \
  --target-port 3000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 1 \
  --cpu 0.5 \
  --memory 1.0Gi \
  --env-vars NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
```

> **Why `--max-replicas 1`?** Viora uses in-memory room state. Multiple replicas would not share state. Keep it at 1 unless you add a Redis Socket.io adapter.

---

### Step 2 — Create a Service Principal for GitHub Actions

```bash
SUBSCRIPTION_ID=$(az account show --query id -o tsv)

az ad sp create-for-rbac \
  --name "viora-github-actions" \
  --role contributor \
  --scopes /subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RG \
  --sdk-auth
```

Copy the full JSON output — you'll need it in the next step.

---

### Step 3 — Create a GitHub PAT for GHCR pulls

Azure Container Apps needs a token to pull images from GHCR at deploy time.

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)**
2. Generate a new token with the **`read:packages`** scope
3. Copy the token value

---

### Step 4 — Add secrets and variables to GitHub

Go to **GitHub → your repo → Settings → Secrets and variables → Actions**.

**Secrets** (sensitive values):

| Secret | Value |
|---|---|
| `AZURE_CREDENTIALS` | Full JSON from the `az ad sp create-for-rbac` output |
| `GHCR_TOKEN` | GitHub PAT with `read:packages` scope (from Step 3) |

**Variables** (non-sensitive config):

| Variable | Value |
|---|---|
| `ACA_NAME` | `viora` (or whatever you named the Container App) |
| `ACA_RG` | `viora-rg` (your resource group name) |

---

### Step 5 — Create the `production` environment (optional)

The deploy job references a GitHub environment named `production`. You can use it to add manual approval gates before deployments.

Go to **GitHub → your repo → Settings → Environments → New environment** → name it `production`.

If you skip this, remove the `environment: production` line from `.github/workflows/deploy.yml`.

---

### How the workflow runs

1. **Push to `main`** triggers the workflow
2. **Build job** — checks out code, builds the Docker image, pushes two tags to GHCR:
   - `ghcr.io/<owner>/viora:latest`
   - `ghcr.io/<owner>/viora:<git-sha>`
3. **Deploy job** — logs into Azure, runs `az containerapp update` to point the app at the new `<git-sha>`-tagged image, and prints the live URL

The `<git-sha>` tag (not `latest`) is what gets deployed — this gives each deployment a unique, immutable tag so you can roll back to any previous commit by re-running its workflow run.
