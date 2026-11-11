#!/usr/bin/env bash
# One-shot WhatsApp Cloud API setup: exchange the 24h token for a 60-day one,
# write it into .env, and verify the connection.
#
#   bash apps/api/scripts/whatsapp_setup.sh
#
# Needs (from developers.facebook.com -> your app):
#   App ID + App Secret : Settings -> Basic
#   Temporary token     : WhatsApp -> API Setup
set -euo pipefail
cd "$(dirname "$0")/../../.."   # repo root (where .env lives)

PHONE_NUMBER_ID="${PHONE_NUMBER_ID:-1106637959188896}"
TEST_TO="${TEST_TO:-}"

read -rp "App ID: " APP_ID
read -rsp "App Secret (hidden): " APP_SECRET; echo
read -rsp "Temporary access token (hidden): " TEMP_TOKEN; echo
[ -z "$TEST_TO" ] && read -rp "Send a test message to (e.g. +96899275151, blank to skip): " TEST_TO

echo
echo "==> Exchanging for a 60-day token..."
RESP=$(curl -s -G "https://graph.facebook.com/v21.0/oauth/access_token" \
  --data-urlencode "grant_type=fb_exchange_token" \
  --data-urlencode "client_id=${APP_ID}" \
  --data-urlencode "client_secret=${APP_SECRET}" \
  --data-urlencode "fb_exchange_token=${TEMP_TOKEN}")

LONG_TOKEN=$(printf '%s' "$RESP" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("access_token",""))' 2>/dev/null || true)
if [ -z "$LONG_TOKEN" ]; then
  echo "!! Exchange failed. Meta said:"
  printf '%s\n' "$RESP"
  echo
  echo "   Common causes: wrong App Secret, or the temporary token already expired."
  exit 1
fi
echo "    got a token (${#LONG_TOKEN} chars)"

echo "==> Writing .env ..."
cp .env ".env.bak.$(date +%s)"
# Drop any previous values so repeated runs do not stack duplicates.
sed -i '/^WHATSAPP_ACCESS_TOKEN=/d; /^WHATSAPP_PHONE_NUMBER_ID=/d; /^WHATSAPP_INVOICE_TEMPLATE_NAME=/d' .env
# Guarantee a trailing newline before appending (a missing one silently glued
# PUBLIC_WEB_URL onto AUDIT_ENABLED once already).
[ -n "$(tail -c1 .env)" ] && echo >> .env
{
  echo "WHATSAPP_ACCESS_TOKEN=${LONG_TOKEN}"
  echo "WHATSAPP_PHONE_NUMBER_ID=${PHONE_NUMBER_ID}"
  echo "WHATSAPP_INVOICE_TEMPLATE_NAME=draft_invoice"
} >> .env
echo "    backup saved, 3 keys written"

echo "==> Verifying (still in mock mode — nothing is live yet)..."
COMPOSE="docker compose -f docker-compose.hostdb.yml"
$COMPOSE run --rm --entrypoint sh migrate \
  -c "PYTHONPATH=/app python scripts/whatsapp_check.py ${TEST_TO:+--to $TEST_TO}"

echo
echo "If the check above says SENT, switch the app to cloud mode with:"
echo "  sed -i 's/^WHATSAPP_MODE=.*/WHATSAPP_MODE=cloud/' .env && docker restart firoozeh-api carpet-celery"
