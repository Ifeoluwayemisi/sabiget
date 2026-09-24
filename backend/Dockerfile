# Debian-based image: Prisma's native engines require OpenSSL, which Alpine
# (musl) images do not ship by default, causing "Could not parse schema engine
# response" failures during generate/migrate. node:18-slim ships libssl3.
FROM node:18-slim
WORKDIR /app
COPY package*.json ./
# Install all dependencies so Prisma CLI is available in container
RUN npm ci
COPY . .
# Ensure entrypoint is executable
RUN chmod +x ./docker-entrypoint.sh || true
ENV NODE_ENV=production
EXPOSE 5000
ENTRYPOINT ["./docker-entrypoint.sh"]
