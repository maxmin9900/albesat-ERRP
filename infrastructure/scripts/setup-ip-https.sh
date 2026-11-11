#!/usr/bin/env bash
# Live QR camera on server IP — requires HTTPS (self-signed, no domain needed).
# http://IP cannot use live camera (browser security); this sets up https://IP.
#
# Usage: sudo ./infrastructure/scripts/setup-ip-https.sh
#    or: sudo SERVER_IP=203.0.113.10 ./infrastructure/scripts/setup-ip-https.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IP="${SERVER_IP:-}"
if [ -z "$IP" ]; then
  IP="$(curl -4 -s --max-time 5 ifconfig.me 2>/dev/null || true)"
fi
if [ -z "$IP" ]; then
  IP="$(hostname -I | awk '{print $1}')"
fi
if [ -z "$IP" ]; then
  echo "Set SERVER_IP=your.public.ip" >&2
  exit 1
fi

SSL_DIR="/etc/nginx/ssl"
mkdir -p "$SSL_DIR"

openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
  -keyout "$SSL_DIR/carpet-ip.key" \
  -out "$SSL_DIR/carpet-ip.crt" \
  -subj "/CN=$IP" \
  -addext "subjectAltName=IP:$IP"

chmod 640 "$SSL_DIR/carpet-ip.key"
chmod 644 "$SSL_DIR/carpet-ip.crt"

NGINX_SITE="/etc/nginx/sites-available/carpet-ip"
cp "$ROOT/infrastructure/nginx/ip-https.conf" "$NGINX_SITE"
sed -i "s/SERVER_IP/$IP/g" "$NGINX_SITE"
ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/carpet-ip

# Remove default site if it conflicts on port 80/443
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

nginx -t
systemctl reload nginx

echo ""
echo "============================================"
echo " Live camera ready on: https://$IP"
echo "============================================"
echo ""
echo "On phone:"
echo "  1. Open http://$IP  (auto redirects to https)"
echo "  2. Tap Advanced → Proceed (one time only)"
echo "  3. Tap Allow camera → live QR scan works"
echo ""
echo "Rebuild web if needed:"
echo "  cd $ROOT/apps/web && npm run build && pm2 restart carpet-web"
