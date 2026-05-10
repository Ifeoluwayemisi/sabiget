// Order Routes - Order management, payment, delivery verification
const express = require("express");
const router = express.Router();
const { authenticateToken, authorize } = require("../middleware/auth");
const { checkoutLimiter } = require("../middleware/rateLimiter");
const { initializePayment, initiateRefund } = require("../utils/paystack");
const crypto = require("crypto");

const CANCELLABLE_STATUSES = new Set(["PENDING"]);

function getIdempotencyKey(req) {
  return (
    req.headers["x-idempotency-key"] ||
    req.body?.idempotencyKey ||
    crypto.randomUUID()
  );
}

function isAcceptanceExpired(order) {
  return (
    order.status === "PENDING" &&
    order.acceptanceDeadline &&
    new Date(order.acceptanceDeadline) <= new Date()
  );
}

async function triggerOrderRefund(order, reason) {
  if (
    order.status === "REFUNDED" ||
    order.refundInitiatedAt ||
    order.refundCompletedAt
  ) {
    return {
      success: true,
      alreadyRefunded: true,
    };
  }

  const refundResult = await initiateRefund({
    transactionId: order.paymentReference,
    amount: order.totalAmount,
    reason,
  });

  if (!refundResult.success) {
    return refundResult;
  }

  await global.prisma.Order.update({
    where: { id: order.id },
    data: {
      status: "REFUNDED",
      refundInitiatedAt: new Date(),
      refundCompletedAt: new Date(),
      refundAmount: order.totalAmount,
    },
  });

  return refundResult;
}

async function autoKillExpiredPendingOrder(order) {
  if (!isAcceptanceExpired(order)) {
    return order;
  }

  const autoKilledOrder = await global.prisma.Order.update({
    where: { id: order.id },
    data: {
      status: "CANCELLED_AUTO_KILL",
      autoKilledAt: new Date(),
      cancelledAt: new Date(),
      acceptanceDeadline: null,
      adminNotes: "Acceptance window expired before vendor action",
    },
  });

  const refundResult = await triggerOrderRefund(
    autoKilledOrder,
    "Order auto-cancelled after vendor acceptance timeout",
  );

  if (!refundResult.success) {
    throw new Error(
      `Auto-kill refund failed for order ${order.id}: ${refundResult.error}`,
    );
  }

  return global.prisma.Order.findUnique({
    where: { id: order.id },
  });
}

/**
 * POST /api/orders
 * Create a new order (Customer initiates checkout)
 */
router.post("/", checkoutLimiter, authenticateToken, async (req, res) => {
  try {
    const {
      vendorId,
      items,
      deliveryAddress,
      deliveryLat,
      deliveryLng,
    } = req.body;
    const userId = req.user.userId;
    const idempotencyKey = getIdempotencyKey(req);

    if (!vendorId || !items || !items.length || !deliveryAddress) {
      return res.status(400).json({
        success: false,
        error: "Vendor ID, items, and delivery address required",
      });
    }

    const existingOrder = await global.prisma.Order.findUnique({
      where: { idempotencyKey },
    });

    if (existingOrder) {
      if (existingOrder.userId !== userId) {
        return res.status(409).json({
          success: false,
          error: "Idempotency key already used by another user",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Existing order returned for idempotent request",
        orderId: existingOrder.id,
        reference: existingOrder.paymentReference,
        paystackAccessCode: existingOrder.paystackAccessCode,
        idempotencyKey: existingOrder.idempotencyKey,
        status: existingOrder.status,
      });
    }

    const user = await global.prisma.User.findUnique({ where: { id: userId } });
    const vendor = await global.prisma.Vendor.findUnique({
      where: { id: vendorId },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    if (!vendor) {
      return res.status(404).json({ success: false, error: "Vendor not found" });
    }
    if (!vendor.paystackSubcode) {
      return res.status(400).json({
        success: false,
        error: "Vendor is not configured to receive payments yet.",
      });
    }

    let foodCost = 0;
    const orderItemsData = [];

    for (const item of items) {
      const product = await global.prisma.Product.findUnique({
        where: { id: item.productId },
      });
      if (!product || product.vendorId !== vendor.id || !product.isAvailable) {
        return res.status(400).json({
          success: false,
          error: `Product ${item.productId} is invalid or unavailable`,
        });
      }

      const totalPrice = product.price * item.quantity;
      foodCost += totalPrice;

      orderItemsData.push({
        productId: product.id,
        quantity: item.quantity,
        pricePerUnit: product.price,
        totalPrice,
        specialRequests: item.specialRequests || null,
      });
    }

    const serviceFee = 500;
    const platformFee = 0;
    const totalAmount = foodCost + serviceFee + platformFee;
    const paymentReference = `SG-ORD-${Date.now()}-${crypto.randomBytes(4)
      .toString("hex")
      .toUpperCase()}`;

    const order = await global.prisma.Order.create({
      data: {
        userId,
        vendorId,
        status: "UNPAID",
        foodCost,
        serviceFee,
        platformFee,
        totalAmount,
        paymentReference,
        idempotencyKey,
        deliveryAddress,
        deliveryLat: parseFloat(deliveryLat) || 0,
        deliveryLng: parseFloat(deliveryLng) || 0,
        items: {
          create: orderItemsData,
        },
      },
    });

    const paystackRes = await initializePayment({
      email: user.email || "customer@sabiget.com",
      amount: totalAmount,
      reference: paymentReference,
      callbackUrl: "https://sabiget.com/payment-callback",
      subaccount: vendor.paystackSubcode,
      transaction_charge: serviceFee,
      metadata: {
        orderId: order.id,
        vendorId: vendor.id,
        userId,
      },
    });

    if (!paystackRes.success) {
      return res.status(500).json({
        success: false,
        error: "Payment initialization failed",
        details: paystackRes.error,
      });
    }

    await global.prisma.Order.update({
      where: { id: order.id },
      data: { paystackAccessCode: paystackRes.data.access_code },
    });

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      orderId: order.id,
      authorizationUrl: paystackRes.data.authorization_url,
      paystackAccessCode: paystackRes.data.access_code,
      reference: paymentReference,
      idempotencyKey,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/orders/:id
 * Get order details
 */
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const role = req.user.role;

    const order = await global.prisma.Order.findUnique({
      where: { id },
      include: {
        items: {
          include: { product: true },
        },
        vendor: {
          select: { id: true, name: true, phone: true, email: true },
        },
        user: {
          select: { id: true, name: true, phone: true, email: true },
        },
      },
    });

    if (!order) {
      return res
        .status(404)
        .json({ success: false, error: "Order not found" });
    }

    if (role === "VENDOR") {
      const vendor = await global.prisma.Vendor.findUnique({ where: { userId } });
      if (!vendor || order.vendorId !== vendor.id) {
        return res.status(403).json({
          success: false,
          error: "Not authorized to view this order",
        });
      }
    } else if (role !== "ADMIN" && role !== "SUPER_ADMIN" && order.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to view this order",
      });
    }

    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/orders
 * Get user's orders (Customer) or vendor's orders (Vendor)
 */
router.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const role = req.user.role;
    const { status } = req.query;

    const queryOptions = {
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: { product: true },
        },
        vendor: {
          select: { id: true, name: true },
        },
      },
    };

    if (role === "VENDOR") {
      const vendor = await global.prisma.Vendor.findUnique({ where: { userId } });
      if (!vendor) {
        return res.status(403).json({
          success: false,
          error: "Vendor profile not found",
        });
      }

      queryOptions.where = { vendorId: vendor.id };
    } else if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      queryOptions.where = { userId };
    } else {
      queryOptions.where = {};
    }

    if (status) {
      queryOptions.where.status = status;
    }

    const orders = await global.prisma.Order.findMany(queryOptions);

    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/orders/:id/accept
 * Vendor accepts an order
 */
router.post(
  "/:id/accept",
  authenticateToken,
  authorize("VENDOR"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const vendorUserId = req.user.userId;

      const vendor = await global.prisma.Vendor.findUnique({
        where: { userId: vendorUserId },
      });
      if (!vendor) {
        return res.status(403).json({
          success: false,
          error: "Vendor profile not found",
        });
      }

      const order = await global.prisma.Order.findUnique({ where: { id } });
      if (!order) {
        return res
          .status(404)
          .json({ success: false, error: "Order not found" });
      }

      const currentOrder = await autoKillExpiredPendingOrder(order);

      if (currentOrder.vendorId !== vendor.id) {
        return res.status(403).json({
          success: false,
          error: "Not authorized to accept this order",
        });
      }

      if (currentOrder.status === "ACCEPTED") {
        return res.json({
          success: true,
          message: "Order already accepted",
          orderId: id,
          status: currentOrder.status,
        });
      }

      if (currentOrder.status !== "PENDING") {
        return res.status(400).json({
          success: false,
          error: `Cannot accept order in ${currentOrder.status} status`,
        });
      }

      const dvcCode = crypto.randomBytes(3).toString("hex").toUpperCase();

      await global.prisma.Order.update({
        where: { id },
        data: {
          status: "ACCEPTED",
          acceptedAt: new Date(),
          acceptanceDeadline: null,
          dvcCode,
        },
      });

      res.json({
        success: true,
        message: "Order accepted",
        orderId: id,
        status: "ACCEPTED",
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

/**
 * POST /api/orders/:id/reject
 * Vendor rejects an order (before accepting)
 */
router.post(
  "/:id/reject",
  authenticateToken,
  authorize("VENDOR"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const vendorUserId = req.user.userId;

      const vendor = await global.prisma.Vendor.findUnique({
        where: { userId: vendorUserId },
      });
      if (!vendor) {
        return res.status(403).json({
          success: false,
          error: "Vendor profile not found",
        });
      }

      const order = await global.prisma.Order.findUnique({ where: { id } });
      if (!order) {
        return res
          .status(404)
          .json({ success: false, error: "Order not found" });
      }

      const currentOrder = await autoKillExpiredPendingOrder(order);

      if (currentOrder.vendorId !== vendor.id) {
        return res.status(403).json({
          success: false,
          error: "Not authorized to reject this order",
        });
      }

      if (
        currentOrder.status === "CANCELLED_VENDOR" ||
        currentOrder.status === "REFUNDED"
      ) {
        return res.json({
          success: true,
          message: "Order already rejected",
          orderId: id,
          status: currentOrder.status,
        });
      }

      if (!CANCELLABLE_STATUSES.has(currentOrder.status)) {
        return res.status(400).json({
          success: false,
          error: `Cannot reject order in ${currentOrder.status} status`,
        });
      }

      const cancelledOrder = await global.prisma.Order.update({
        where: { id },
        data: {
          status: "CANCELLED_VENDOR",
          cancelledAt: new Date(),
          acceptanceDeadline: null,
          adminNotes: reason || "Vendor rejected order",
        },
      });

      const refundResult = await triggerOrderRefund(
        cancelledOrder,
        reason || "Vendor rejected order before fulfilment",
      );

      if (!refundResult.success) {
        return res.status(502).json({
          success: false,
          error: "Order rejected but refund failed to initialize",
          details: refundResult.error,
        });
      }

      res.json({
        success: true,
        message: "Order rejected and refund initiated",
        orderId: id,
        status: "REFUNDED",
        reason,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

/**
 * POST /api/orders/:id/out-for-delivery
 * Vendor marks order as out for delivery
 */
router.post(
  "/:id/out-for-delivery",
  authenticateToken,
  authorize("VENDOR"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const vendorUserId = req.user.userId;

      const vendor = await global.prisma.Vendor.findUnique({
        where: { userId: vendorUserId },
      });
      const order = await global.prisma.Order.findUnique({ where: { id } });

      if (!vendor || !order || order.vendorId !== vendor.id) {
        return res.status(403).json({ success: false, error: "Not authorized" });
      }

      if (order.status === "OUT_FOR_DELIVERY") {
        return res.json({
          success: true,
          message: "Order already out for delivery",
          orderId: id,
          status: order.status,
        });
      }

      if (order.status !== "ACCEPTED") {
        return res.status(400).json({
          success: false,
          error: `Cannot mark as out for delivery from ${order.status}`,
        });
      }

      await global.prisma.Order.update({
        where: { id },
        data: {
          status: "OUT_FOR_DELIVERY",
          preparedAt: new Date(),
        },
      });

      res.json({
        success: true,
        message: "Order marked out for delivery",
        orderId: id,
        status: "OUT_FOR_DELIVERY",
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

/**
 * POST /api/orders/:id/verify-dvc
 * Vendor enters DVC to complete delivery
 */
router.post(
  "/:id/verify-dvc",
  authenticateToken,
  authorize("VENDOR"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { dvcCode } = req.body;
      const vendorUserId = req.user.userId;

      if (!dvcCode) {
        return res
          .status(400)
          .json({ success: false, error: "DVC code required" });
      }

      const vendor = await global.prisma.Vendor.findUnique({
        where: { userId: vendorUserId },
      });
      const order = await global.prisma.Order.findUnique({ where: { id } });

      if (!vendor || !order || order.vendorId !== vendor.id) {
        return res.status(403).json({ success: false, error: "Not authorized" });
      }

      if (order.status === "DELIVERED" || order.status === "COMPLETED") {
        return res.json({
          success: true,
          message: "DVC already verified",
          orderId: id,
          status: order.status,
        });
      }

      if (order.status !== "OUT_FOR_DELIVERY") {
        return res.status(400).json({
          success: false,
          error: "Order is not out for delivery yet",
        });
      }

      if (order.dvcLockedUntil && order.dvcLockedUntil > new Date()) {
        return res.status(403).json({
          success: false,
          error:
            "DVC verification is locked due to too many failed attempts. Please contact support.",
        });
      }

      if (order.dvcCode !== dvcCode.toUpperCase()) {
        const newAttempts = order.dvcAttempts + 1;
        const lockUpdate =
          newAttempts >= 3
            ? { dvcLockedUntil: new Date(Date.now() + 30 * 60 * 1000) }
            : {};

        await global.prisma.Order.update({
          where: { id },
          data: { dvcAttempts: newAttempts, ...lockUpdate },
        });

        return res
          .status(400)
          .json({ success: false, error: "Invalid DVC code" });
      }

      await global.prisma.Order.update({
        where: { id },
        data: {
          status: "DELIVERED",
          deliveredAt: new Date(),
          dvcEnteredAt: new Date(),
        },
      });

      res.json({
        success: true,
        message: "DVC verified successfully. Delivery complete!",
        orderId: id,
        status: "DELIVERED",
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

/**
 * POST /api/orders/:id/cancel
 * Customer cancels an order (before vendor accepts)
 */
router.post("/:id/cancel", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user.userId;

    const order = await global.prisma.Order.findUnique({ where: { id } });
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    if (order.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to cancel this order",
      });
    }

    const currentOrder = await autoKillExpiredPendingOrder(order);

    if (
      currentOrder.status === "CANCELLED_CUSTOMER" ||
      currentOrder.status === "REFUNDED"
    ) {
      return res.json({
        success: true,
        message: "Order already cancelled",
        orderId: id,
        status: currentOrder.status,
      });
    }

    if (!CANCELLABLE_STATUSES.has(currentOrder.status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot cancel order in ${currentOrder.status} status`,
      });
    }

    const cancelledOrder = await global.prisma.Order.update({
      where: { id },
      data: {
        status: "CANCELLED_CUSTOMER",
        cancelledAt: new Date(),
        acceptanceDeadline: null,
        adminNotes: reason || "Customer cancelled before vendor acceptance",
      },
    });

    const refundResult = await triggerOrderRefund(
      cancelledOrder,
      reason || "Customer cancelled before vendor acceptance",
    );

    if (!refundResult.success) {
      return res.status(502).json({
        success: false,
        error: "Order cancelled but refund failed to initialize",
        details: refundResult.error,
      });
    }

    res.json({
      success: true,
      message: "Order cancelled and refund initiated",
      orderId: id,
      status: "REFUNDED",
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/orders/webhook/paystack
 * Legacy route kept for compatibility.
 */
router.post("/webhook/paystack", async (req, res) => {
  return res.status(410).json({
    success: false,
    message: "Use /api/v1/webhooks/paystack instead",
  });
});

module.exports = router;
