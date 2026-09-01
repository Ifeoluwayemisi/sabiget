#!/bin/sh
set -e
echo "[entrypoint] NODE_ENV=$NODE_ENV"
echo "[entrypoint] Generating Prisma client..."
npx prisma generate
echo "[entrypoint] Applying Prisma migrations (if any)..."
echo "[entrypoint] Waiting for database to be ready..."
RETRY=0
until npx prisma migrate deploy; do
	RETRY=$((RETRY+1))
	echo "[entrypoint] Database not ready yet, retrying (#$RETRY) in 2s..."
	sleep 2
	if [ $RETRY -ge 60 ]; then
		echo "[entrypoint] Giving up after $RETRY attempts"
		exit 1
	fi
done
echo "[entrypoint] Starting backend..."
exec node src/app.js
