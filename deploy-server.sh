#!/usr/bin/env bash
# Deploy API + Celery on a server with Postgres + Redis on localhost (127.0.0.1).
set -euo pipefail
cd "$(dirname "$0")"

COMPOSE="docker-compose -f docker-compose.hostdb.yml"

echo "==> Building images..."
$COMPOSE build api celery migrate

echo "==> Fixing old Alembic revision IDs (if any)..."
$COMPOSE run --rm --entrypoint sh migrate -c "PYTHONPATH=/app python scripts/fix_alembic_revisions.py"

echo "==> Running database migrations..."
$COMPOSE run --rm migrate

echo "==> Removing stale containers (docker-compose 1.29 ContainerConfig bug)..."
docker rm -f firoozeh-api carpet-celery 2>/dev/null || true
docker ps -aq --filter "name=firoozeh-api" --filter "name=carpet-celery" | xargs -r docker rm -f 2>/dev/null || true

echo "==> Starting API and Celery..."
$COMPOSE up -d api celery

echo "==> Status:"
$COMPOSE ps

echo ""
echo "API: http://$(hostname -I | awk '{print $1}'):8010/api/v1/docs"
echo "Ensure .env uses 127.0.0.1 for DATABASE_URL and REDIS_URL."
