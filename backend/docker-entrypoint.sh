#!/bin/sh
set -e
echo "[entrypoint] NODE_ENV=$NODE_ENV"
if [ -z "${DIRECT_URL:-}" ]; then
	echo "[entrypoint] ERROR: DIRECT_URL is required for Prisma migrations."
	echo "[entrypoint] Set DIRECT_URL to the direct Neon connection and keep DATABASE_URL for pooled runtime traffic."
	exit 1
fi
echo "[entrypoint] Generating Prisma client..."
npx prisma generate
echo "[entrypoint] Applying Prisma migrations (if any)..."
npx prisma migrate deploy
echo "[entrypoint] Starting backend..."
exec node src/app.js
