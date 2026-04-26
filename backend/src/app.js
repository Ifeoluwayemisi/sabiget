// ============================================
// SabiGet Backend - Main Express Server
// ============================================

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { PrismaClient } = require("@prisma/client");
const { Server } = require("socket.io");
const http = require("http");

// Middleware & Utils
const { apiLimiter, rateLimitOTP } = require("./middleware/rateLimiter");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");

// ============================================
// INITIALIZATION
// ============================================

const prisma = new PrismaClient();
const app = express();
const server = http.createServer(app);

// Initialize Socket.io for real-time vendor alerts
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  },
});

// Store connection for global access
global.prisma = prisma;
global.io = io;

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
  })
);

// Body Parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Logging
app.use(morgan("combined"));

// Rate Limiting
app.use(apiLimiter);

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
// API ROUTES
// ============================================

// Auth Routes (with OTP rate limiting)
app.use("/api/v1/auth", rateLimitOTP, require("./routes/authRoutes"));

// Vendor Routes
app.use("/api/v1/vendors", require("./routes/vendorRoutes"));

// Product Routes
app.use("/api/v1/products", require("./routes/productRoutes"));

// Order Routes
app.use("/api/v1/orders", require("./routes/orderRoutes"));

// Customer Routes
app.use("/api/v1/customers", require("./routes/customerRoutes"));

// Admin Routes
app.use("/api/v1/admin", require("./routes/adminRoutes"));

// Webhook Routes
app.use("/api/v1/webhooks", require("./routes/webhookRoutes"));

// ============================================
// SOCKET.IO - Real-time Vendor Notifications
// ============================================

const vendorConnections = new Map(); // Track vendor socket connections

io.on("connection", (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  // ===== Vendor Events =====
  
  // Vendor joins their order queue
  socket.on("vendor:join", (vendorId) => {
    socket.join(`vendor:${vendorId}`);
    vendorConnections.set(vendorId, socket.id);
    console.log(`[Socket.io] Vendor ${vendorId} joined room`);
    socket.emit("connection:success", {
      message: "Connected to vendor notifications channel",
      vendorId,
    });
  });

  // Vendor accepts an order
  socket.on("order:accept", (data) => {
    const { vendorId, orderId } = data;
    console.log(`[Socket.io] Order ${orderId} accepted by vendor ${vendorId}`);
    socket.emit("order:accepted", { orderId, status: "ACCEPTED" });
  });

  // Vendor updates order status
  socket.on("order:statusUpdate", (data) => {
    const { vendorId, orderId, status } = data;
    console.log(
      `[Socket.io] Order ${orderId} status updated to ${status}`
    );
    io.to(`vendor:${vendorId}`).emit("order:statusUpdated", {
      orderId,
      status,
    });
  });

  // Vendor enters DVC code
  socket.on("order:dvcEntered", (data) => {
    const { vendorId, orderId, dvcCode } = data;
    console.log(`[Socket.io] DVC entered for order ${orderId}`);
    socket.emit("order:dvcReceived", { orderId, success: true });
  });

  // ===== Disconnection =====

  socket.on("disconnect", () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    // Remove vendor from connections map
    for (const [vendorId, socketId] of vendorConnections.entries()) {
      if (socketId === socket.id) {
        vendorConnections.delete(vendorId);
        console.log(`[Socket.io] Vendor ${vendorId} disconnected`);
      }
    }
  });

  socket.on("error", (error) => {
    console.error(`[Socket.io] Error: ${error}`);
  });
});

// Store vendor connections globally for use in controllers
global.vendorConnections = vendorConnections;

// ============================================
// ERROR HANDLING
// ============================================

// 404 Handler
app.use(notFoundHandler);

// Global Error Handler
app.use(errorHandler);

// ============================================
// SERVER STARTUP
// ============================================

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════╗
║         🍽️  SabiGet Backend v1.0  🍽️              ║
╚════════════════════════════════════════════════════╝

✅ Server running on: http://localhost:${PORT}
✅ Environment: ${NODE_ENV}
✅ Frontend: ${process.env.FRONTEND_URL || "http://localhost:3000"}
✅ Database: PostgreSQL (Prisma ORM)
✅ Real-time: Socket.io
✅ Payment: Paystack Integration

🚀 Ready to accept requests...
  `);
});

// Graceful Shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  await prisma.$disconnect();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

module.exports = { app, server, io, prisma };


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
