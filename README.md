# Viora

A real-time synchronized video watch party app. Host a room, share the link, and play/pause/seek stay perfectly in sync for everyone.

---

## Features

- **Google Drive video** — paste any publicly shared Drive link to host a video
- **Synchronized playback** — play, pause, and seek are broadcast instantly to all viewers
- **Room chat** — live chat sidebar with named participants
- **No accounts** — rooms are identified by a short URL; anyone with the link can join
- **LAN & Docker ready** — runs locally or in a container accessible across your network
- **CI/CD** — every push to `main` builds, pushes to GHCR, and deploys to Azure Container Apps automatically

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
| Registry | GitHub Container Registry (GHCR) |
| Hosting | Azure Container Apps |
| CI/CD | GitHub Actions |

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

> **Note:** `docker-compose.yml` sets `network: host` for the build stage so `npm ci` can reach the npm registry. This is required on Linux hosts where Docker's default bridge DNS may be blocked.

---

## How It Works

### Creating a room

1. Upload your video to Google Drive and set sharing to **Anyone with the link**
2. Copy the share URL (`https://drive.google.com/file/d/.../view`)
3. Paste it into Viora and click **Create Room**
4. Enter your name and share the room URL with your partner

### Joining a room

Open the room link, enter your name, and the video starts in sync with everyone already watching.

### Sync mechanism

- Play, pause, and seek events are emitted via Socket.io to all participants
- When a new viewer joins, an existing participant sends their current timestamp and play state so the late joiner catches up immediately
- An `isRemoteAction` flag prevents received events from being re-broadcast

### Video proxy

Google Drive share URLs aren't directly streamable in `<video>` tags due to CORS and redirect chains. Viora proxies requests through a Next.js API route (`/api/video?id=FILE_ID`) which follows Google's redirects server-side and streams the video back with proper range-request support for seeking.

---

## Project Structure

```
Viora/
├── server.ts                    # Express + Socket.io server wrapping Next.js
├── next.config.js
├── docker-compose.yml
├── Dockerfile
├── .github/
│   └── workflows/
│       └── deploy.yml           # CI/CD — build, push to GHCR, deploy to Azure
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

Every push to `main` automatically builds a new Docker image, pushes it to GHCR, and deploys it to Azure Container Apps.

```
Push to main
  └─► Build Docker image
        └─► Push to ghcr.io/mahd0x8/viora:<sha>
              └─► az containerapp update → Azure Container Apps
```

### GitHub Actions Secrets & Variables

Go to **GitHub → repo → Settings → Secrets and variables → Actions**

**Secrets tab:**

| Secret | Description |
|---|---|
| `AZURE_CREDENTIALS` | JSON output from `az ad sp create-for-rbac` |
| `GHCR_TOKEN` | GitHub PAT with `read:packages` scope |

**Variables tab:**

| Variable | Value |
|---|---|
| `ACA_NAME` | `viora` |
| `ACA_RG` | `viora-rg` |

---

### One-Time Azure Setup

#### 1. Install Azure CLI and extension

```bash
# Install Azure CLI (Ubuntu/Debian)
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Add Container Apps extension
az extension add --name containerapp

# Register providers
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights

# Log in
az login
```

#### 2. Create Azure resources

```bash
LOCATION="eastus"
RG="viora-rg"
ENV="viora-env"
APP="viora"
GITHUB_USER="mahd0x8"
GHCR_PAT="<your-pat-with-read:packages>"

# Resource group
az group create --name $RG --location $LOCATION

# Container Apps environment (~2 min)
az containerapp env create \
  --name $ENV \
  --resource-group $RG \
  --location $LOCATION

# Container App
az containerapp create \
  --name $APP \
  --resource-group $RG \
  --environment $ENV \
  --image ghcr.io/$GITHUB_USER/viora:latest \
  --registry-server ghcr.io \
  --registry-username $GITHUB_USER \
  --registry-password $GHCR_PAT \
  --target-port 3000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 1 \
  --cpu 0.5 \
  --memory 1.0Gi \
  --env-vars NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0

# Print the live URL
az containerapp show \
  --name $APP \
  --resource-group $RG \
  --query "properties.configuration.ingress.fqdn" -o tsv
```

> **Why `--max-replicas 1`?** Viora uses in-memory room state. Multiple replicas would split traffic and break sync. Keep it at 1 unless you add a Redis Socket.io adapter.

#### 3. Create a Service Principal for GitHub Actions

```bash
SUBSCRIPTION_ID=$(az account show --query id -o tsv)

az ad sp create-for-rbac \
  --name "viora-github-actions" \
  --role contributor \
  --scopes /subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RG \
  --sdk-auth
```

Copy the entire JSON output and save it as the `AZURE_CREDENTIALS` secret in GitHub.

#### 4. Create a GitHub PAT for GHCR pulls

Azure Container Apps needs a token to pull images from GHCR at deploy time.

1. **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)**
2. Generate a new token — scope: **`read:packages`**
3. Save it as the `GHCR_TOKEN` secret in GitHub

#### 5. Create the `production` environment (optional)

Go to **GitHub → repo → Settings → Environments → New environment** → name it `production`.

This enables manual approval gates before each deployment. If you skip it, remove `environment: production` from `.github/workflows/deploy.yml`.

---

### How the workflow runs

1. **Push to `main`** triggers the workflow
2. **Build job** — builds the Docker image and pushes two tags to GHCR:
   - `ghcr.io/mahd0x8/viora:latest`
   - `ghcr.io/mahd0x8/viora:<git-sha>`
3. **Deploy job** — logs into Azure, runs `az containerapp update` with the immutable `<git-sha>` tag, prints the live URL

Using the `<git-sha>` tag (not `latest`) means every deployment is traceable and you can roll back to any previous commit by re-running its workflow.
