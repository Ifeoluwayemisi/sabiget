// Socket.IO connection lifecycle: handshake auth and validated room joins.
// REST stays authoritative for all order mutations; this layer only delivers events.
import { verifyAccessToken } from "../utils/jwt.js";

/**
 * Fan out an authoritative order status change to the customer and vendor
 * rooms. Callers must invoke this only AFTER the database transition has
 * succeeded — the payload describes committed state, never intent.
 */
export function emitOrderStatusUpdate(order) {
  const io = global.io;
  if (!io || !order?.id || !order.vendorId || !order.userId) {
    return;
  }

  const payload = {
    orderId: order.id,
    status: order.status,
    vendorId: order.vendorId,
    userId: order.userId,
  };

  io.to(`customer:${order.userId}`).emit("order:statusUpdated", payload);
  io.to(`vendor:${order.vendorId}`).emit("order:statusUpdated", payload);
}

export function registerSocketHandlers(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    const payload = token ? verifyAccessToken(token) : null;

    if (!payload || !payload.userId) {
      return next(new Error("Unauthorized"));
    }

    socket.data.user = { userId: payload.userId, role: payload.role };
    return next();
  });

  const vendorConnections = new Map();

  io.on("connection", (socket) => {
    const user = socket.data.user || {};
    console.log(
      `[Socket.io] Client connected: ${socket.id} (${user.role}:${user.userId})`,
    );

    socket.on("vendor:join", async (vendorId) => {
      try {
        if (typeof vendorId !== "string" || !vendorId) {
          throw Object.assign(new Error("Invalid vendor id"), { statusCode: 400 });
        }

        // A vendor may only join their own room; ownership is resolved
        // server-side from the authenticated user, never from the payload.
        if (user.role !== "VENDOR") {
          throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
        }

        const vendor = await global.prisma.Vendor.findUnique({
          where: { userId: user.userId },
          select: { id: true },
        });

        if (!vendor || vendor.id !== vendorId) {
          throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
        }

        await socket.join(`vendor:${vendorId}`);
        vendorConnections.set(vendorId, socket.id);
        console.log(`[Socket.io] Vendor ${vendorId} joined room`);
        socket.emit("connection:success", {
          message: "Connected to vendor notifications channel",
          vendorId,
        });
      } catch (error) {
        console.warn(
          `[Socket.io] vendor:join rejected (${user.userId}): ${error.message}`,
        );
        socket.emit("connection:error", {
          scope: "vendor:join",
          message:
            error.statusCode === 403
              ? "Not authorized for this vendor room"
              : "Unable to join vendor room",
        });
      }
    });

    socket.on("customer:join", async (userId) => {
      try {
        if (typeof userId !== "string" || !userId) {
          throw Object.assign(new Error("Invalid user id"), { statusCode: 400 });
        }

        if (userId !== user.userId) {
          throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
        }

        await socket.join(`customer:${userId}`);
        console.log(
          `[Socket.io] Customer ${userId} joined order tracking room`,
        );
        socket.emit("connection:success", {
          message: "Connected to order tracking channel",
          userId,
        });
      } catch (error) {
        console.warn(
          `[Socket.io] customer:join rejected (${user.userId}): ${error.message}`,
        );
        socket.emit("connection:error", {
          scope: "customer:join",
          message:
            error.statusCode === 403
              ? "Not authorized for this customer room"
              : "Unable to join order tracking room",
        });
      }
    });

    socket.on("disconnect", () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
      for (const [vendorId, socketId] of vendorConnections.entries()) {
        if (socketId === socket.id) {
          vendorConnections.delete(vendorId);
          console.log(`[Socket.io] Vendor ${vendorId} disconnected`);
        }
      }
    });

    socket.on("error", (error) => {
      console.error(`[Socket.io] Error: ${error.message}`);
    });
  });

  return vendorConnections;
}
