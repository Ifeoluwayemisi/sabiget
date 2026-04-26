require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { PrismaClient } = require("@prisma/client");
const { Server } = require("socket.io");
const http = require("http");

const { apiLimiter } = require("./middleware/rateLimiter");

// Initialize Prisma Client
const prisma = new PrismaClient();

// Initialize Express App
const app = express();
const server = http.createServer(app);

// Initialize Socket.io for real-time vendor alerts
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// ============================================
// MIDDLEWARE
// ============================================

// Security
app.use(helmet());

// CORS
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);

// Body Parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Rate Limiting
app.use(apiLimiter);

// Request Logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============================================
// HEALTH CHECK
// ============================================

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ============================================
// API ROUTES (Placeholder - will be implemented)
// ============================================

// Auth Routes
app.use("/api/auth", require("./routes/authRoutes"));

// Vendor Routes
app.use("/api/vendors", require("./routes/vendorRoutes"));

// Product Routes
app.use("/api/products", require("./routes/productRoutes"));

// Order Routes
app.use("/api/orders", require("./routes/orderRoutes"));

// Admin Routes
app.use("/api/admin", require("./routes/adminRoutes"));

// ============================================
// SOCKET.IO - Real-time Vendor Notifications
// ============================================

io.on("connection", (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  // Join vendor-specific room
  socket.on("vendor:join", (vendorId) => {
    socket.join(`vendor:${vendorId}`);
    console.log(`[Socket.io] Vendor ${vendorId} joined room`);
    socket.emit("connection:success", {
      message: "Connected to vendor channel",
    });
  });

  // Join customer-specific room
  socket.on("customer:join", (userId) => {
    socket.join(`customer:${userId}`);
    console.log(`[Socket.io] Customer ${userId} joined room`);
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });

  // Error handling
  socket.on("error", (error) => {
    console.error(`[Socket.io] Error: ${error}`);
  });
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.path,
    method: req.method,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("[Error]", err);
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

async function shutdown() {
  console.log("\n[Shutdown] Closing connections...");
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`\n✅ Server running on port ${PORT}`);
  console.log(`📍 API: http://localhost:${PORT}`);
  console.log(`🌐 Frontend: ${process.env.FRONTEND_URL}`);
  console.log(
    `📊 Database: ${process.env.DATABASE_URL?.split("@")[1] || "PostgreSQL"}`,
  );
  console.log("\n[Info] Waiting for requests...\n");
});

// Export for testing
module.exports = { app, server, prisma, io };
