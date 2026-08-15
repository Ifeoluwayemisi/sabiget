#!/bin/sh
set -e
echo "[entrypoint] NODE_ENV=$NODE_ENV"
echo "[entrypoint] Generating Prisma client..."
npx prisma generate
echo "[entrypoint] Applying Prisma migrations (if any)..."
# Use migrate deploy for containers; ignore non-zero if no migrations
npx prisma migrate deploy || true
echo "[entrypoint] Starting backend..."
exec node src/app.js
