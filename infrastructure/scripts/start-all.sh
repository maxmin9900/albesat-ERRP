#!/usr/bin/env bash
# Start all Carpet Pro services after reboot (run on server as root).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "==> PostgreSQL + Redis"
sudo systemctl start postgresql
sudo systemctl start redis-server 2>/dev/null || sudo systemctl start redis
redis-cli ping

echo "==> API + Celery (Docker)"
docker-compose -f docker-compose.hostdb.yml create api celery 2>/dev/null || true
docker-compose -f docker-compose.hostdb.yml start api celery
curl -sf http://127.0.0.1:8010/health

echo "==> Next.js (PM2 — survives SSH disconnect)"
cd apps/web
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-/api/v1}"
export API_INTERNAL_URL="${API_INTERNAL_URL:-http://127.0.0.1:8010}"
if ! command -v pm2 >/dev/null; then
  npm install -g pm2
fi
npm run build
pm2 delete carpet-web 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

echo "==> Nginx (HTTPS required for camera QR scanning on phones)"
sudo systemctl start nginx 2>/dev/null || true

echo ""
echo "Done."
echo "  Phone scan (no domain):"
echo "    A) http://YOUR-IP — use “Take photo of QR” (works without HTTPS)"
echo "    B) https://YOUR-IP — run: sudo SERVER_IP=YOUR-IP infrastructure/scripts/setup-ip-https.sh"
echo "       then accept browser warning once → live camera works"
pm2 list
docker ps --format 'table {{.Names}}\t{{.Status}}'
