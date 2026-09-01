// ============================================
// SabiGet Backend - Main Express Server
// ============================================

import "dotenv/config";
import http from "node:http";
import { pathToFileURL } from "node:url";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { PrismaClient } from "@prisma/client";
import { Server } from "socket.io";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { apiLimiter, otpLimiter } from "./middleware/rateLimiter.js";
import authRoutes from "./routes/authRoutes.js";
import vendorRoutes from "./routes/vendorRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";
import { autoKillExpiredPendingOrders } from "./services/orderService.js";
import { registerSocketHandlers } from "./services/socketService.js";

const prisma = new PrismaClient();
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  },
});

global.prisma = prisma;
global.io = io;

app.use(helmet());

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);

app.use(
  express.json({
    limit: "10mb",
    verify: (req, res, buf) => {
      req.rawBody = buf.toString("utf8");
    },
  }),
);
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(morgan("combined"));
app.use(apiLimiter);

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.use("/api/v1/auth", otpLimiter, authRoutes);
app.use("/api/v1/vendors", vendorRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/customers", customerRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/webhooks", webhookRoutes);

const vendorConnections = registerSocketHandlers(io);

global.vendorConnections = vendorConnections;

const AUTO_KILL_INTERVAL_MS = 60 * 1000;

const autoKillInterval = setInterval(async () => {
  try {
    const processed = await autoKillExpiredPendingOrders();
    if (processed > 0) {
      console.log(`[Orders] Auto-killed ${processed} expired pending order(s)`);
    }
  } catch (error) {
    console.error("[Orders] Auto-kill worker error:", error.message);
  }
}, AUTO_KILL_INTERVAL_MS);

app.use(notFoundHandler);
app.use(errorHandler);

async function shutdown() {
  console.log("\n[Shutdown] Closing connections...");
  clearInterval(autoKillInterval);
  await prisma.$disconnect();
}

async function startServer() {
  const PORT = process.env.PORT || 5000;
  const NODE_ENV = process.env.NODE_ENV || "development";

  return new Promise((resolve) => {
    server.listen(PORT, () => {
      console.log(
        `SabiGet backend running on http://localhost:${PORT} (${NODE_ENV})`,
      );
      resolve(server);
    });
  });
}

process.on("SIGINT", async () => {
  await shutdown();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await shutdown();
  process.exit(0);
});

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await startServer();
}

export { app, server, io, prisma, shutdown, startServer };
