# Docker on Windows — when Docker Hub DNS fails (Iran / filtered network)

## Symptom

```
lookup registry-1.docker.io: no such host
```

Windows cannot resolve Docker Hub. This is common in Iran; use **registry mirror** + **mirror image names**.

---

## Step 1 — Docker Desktop registry mirror

1. Open **Docker Desktop**
2. **Settings** → **Docker Engine**
3. Replace or merge with (from `docker/daemon.windows.example.json`):

```json
{
  "dns": ["8.8.8.8", "1.1.1.1", "178.22.122.100"],
  "registry-mirrors": [
    "https://docker.arvancloud.ir",
    "https://hub.hamdocker.ir"
  ]
}
```

4. **Apply & Restart** (wait until Docker is fully running)

---

## Step 2 — Test pull from mirror

```powershell
docker pull docker.arvancloud.ir/library/python:3.11-slim
docker pull docker.arvancloud.ir/library/node:20-bookworm-slim
docker pull docker.arvancloud.ir/library/postgres:16-alpine
docker pull docker.arvancloud.ir/library/redis:7-alpine
```

If Arvan fails, try Hamdocker:

```powershell
docker pull hub.hamdocker.ir/library/python:3.11-slim
```

Then edit `.env` and replace `docker.arvancloud.ir` with `hub.hamdocker.ir` in image lines.

---

## Step 3 — Run Carpet stack

```powershell
cd E:\samir
copy .env.docker.mirror.example .env
.\scripts\docker-local-up.ps1 -SkipDnsCheck
```

Or:

```powershell
.\scripts\docker-local-up.ps1 -UseMirrorEnv -SkipDnsCheck
```

Check:

```powershell
docker compose -f docker-compose.yml -f docker-compose.dockerdb.yml ps
```

Expect 5 services: postgres, redis, api, celery, web.

---

## Step 4 — Windows DNS (optional)

**Settings → Network → Wi‑Fi/Ethernet → DNS** → manual:

- `178.22.122.100` (Shecan)
- `8.8.8.8`

Then:

```powershell
ipconfig /flushdns
```

---

## VPN

If mirrors still fail, connect VPN, restart Docker Desktop, run Step 2 again.

---

## Hybrid fallback (no Hub, no mirror)

DB + API in Docker, **Next.js on host**:

```powershell
docker compose -f docker-compose.yml -f docker-compose.dockerdb.yml up -d postgres redis api celery
docker compose -f docker-compose.yml -f docker-compose.dockerdb.yml run --rm migrate
copy apps\web\.env.local.example apps\web\.env.local
.\scripts\dev-web-host.ps1
```

Open http://localhost:3000/operations (role: **Operations Operator**).

---

## Web Docker build notes

- Use **`node:20-bookworm-slim`**, not `node:20-alpine` (alpine often causes `exec format error` on Windows).
- Compose uses **`WEB_NODE_IMAGE`** (not `NODE_IMAGE`). If Windows has `NODE_IMAGE=...-alpine` in user/system env, unset it.
- In `.env`:

```env
WEB_NODE_IMAGE=docker.arvancloud.ir/library/node:20-bookworm-slim
```
