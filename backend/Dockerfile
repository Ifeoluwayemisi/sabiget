FROM node:18-alpine
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
