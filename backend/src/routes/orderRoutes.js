// Order Routes - Order management, payment, delivery verification
import crypto from "node:crypto";
import express from "express";
import { authenticateToken, authorize } from "../middleware/auth.js";
import { checkoutLimiter } from "../middleware/rateLimiter.js";
import { initializePayment } from "../utils/paystack.js";
import {
  CANCELLABLE_STATUSES,
  autoKillExpiredPendingOrder,
  completeDeliveredOrder,
  triggerOrderRefund,
} from "../services/orderService.js";
import { generateDVC, generateIdempotencyKey, hashCode, verifyCode } from "../utils/generators.js";
import { emitOrderStatusUpdate } from "../services/socketService.js";
import { sendOrderNotification } from "../utils/notifications.js";
import config from "../config.js";
import {
  generateGuestOrderToken,
  verifyGuestOrderToken,
} from "../utils/jwt.js";
import { updateLoyaltyPointsOnOrderCompletion } from "../services/customerService.js";

const router = express.Router();
function getIdempotencyKey(req) {
  return (
    req.headers["x-idempotency-key"] ||
    req.body?.idempotencyKey ||
    generateIdempotencyKey()
  );
}

/**
 * POST /api/orders/guest-checkout
 * Create order as anonymous GUEST (no authentication needed)
 * Body: { phone, vendorId, items, deliveryAddress, deliveryLat, deliveryLng }
 * MUST BE DEFINED BEFORE THE ROOT "/" ROUTE
 */
router.post("/guest-checkout", checkoutLimiter, async (req, res) => {
  try {
    const {
      phone,
      vendorId,
      items,
      deliveryAddress,
      deliveryLat,
      deliveryLng,
    } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: "Phone number required for guest checkout",
      });
    }

    if (!vendorId || !items || !items.length || !deliveryAddress) {
      return res.status(400).json({
        success: false,
        error: "Vendor ID, items, and delivery address required",
      });
    }

    const phoneRegex = /^(\+234|0)[789]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        error: "Invalid Nigerian phone number",
        example: "+2348123456789",
      });
    }

    const idempotencyKey = getIdempotencyKey(req);

    // Find or create GUEST user with this phone
    let user = await global.prisma.User.findUnique({ where: { phone } });

    if (!user) {
      user = await global.prisma.User.create({
        data: {
          phone,
          role: "GUEST",
          isVerified: false,
        },
      });
    } else if (user.role !== "GUEST" && user.role !== "MEMBER") {
      return res.status(403).json({
        success: false,
        error: "This phone is registered as a vendor account",
      });
    }

    // Idempotency: a retried request carrying the same key (client retries
    // after a lost response) returns the already-created order instead of
    // charging the customer twice. The key is bound to the phone that owns
    // the order, mirroring the authenticated member path.
    const existingOrder = await global.prisma.Order.findUnique({
      where: { idempotencyKey },
    });

    if (existingOrder) {
      if (existingOrder.userId !== user.id) {
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
        guestOrderToken: generateGuestOrderToken(existingOrder.id),
        idempotencyKey: existingOrder.idempotencyKey,
        status: existingOrder.status,
      });
    }

    const vendor = await global.prisma.Vendor.findUnique({
      where: { id: vendorId },
    });

    if (!vendor) {
      return res
        .status(404)
        .json({ success: false, error: "Vendor not found" });
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

    const serviceFee = config.serviceFeeNaira;
    const platformFee = 0;
    const totalAmount = foodCost + serviceFee + platformFee;
    const paymentReference = `SG-ORD-${Date.now()}-${generateIdempotencyKey()}`;

    const order = await global.prisma.Order.create({
      data: {
        userId: user.id,
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
      email: user.email || `guest+${phone}@sabiget.com`,
      amount: totalAmount,
      reference: paymentReference,
      callbackUrl: config.paystack.callbackUrl,
      subaccount: vendor.paystackSubcode,
      transaction_charge: serviceFee,
      metadata: {
        orderId: order.id,
        vendorId: vendor.id,
        userId: user.id,
        isGuest: true,
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

    return res.status(201).json({
      success: true,
      message:
        "Guest order created. Please verify your phone to complete payment.",
      orderId: order.id,
      authorizationUrl: paystackRes.data.authorization_url,
      paystackAccessCode: paystackRes.data.access_code,
      reference: paymentReference,
      // Short-lived, bound to this single order; enables guest tracking
      // without weakening GET /orders/:id authentication.
      guestOrderToken: generateGuestOrderToken(order.id),
      expiresIn: "1 hour",
      nextStep: "Verify OTP at /auth/send-otp",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/orders/:id/guest-status
 * Limited-scope order tracking for guests who paid without signing in.
 * Requires the short-lived guestOrderToken issued by /guest-checkout.
 * The token is bound to a single order ID and grants read access to that
 * order only, so normal authentication rules stay intact.
 */
router.get("/:id/guest-status", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Guest order token required",
      });
    }

    const payload = verifyGuestOrderToken(token);

    // Ownership binding: even a valid token must match THIS order.
    if (!payload || payload.orderId !== req.params.id) {
      return res.status(403).json({
        success: false,
        error: "Invalid token for this order",
      });
    }

    const order = await global.prisma.Order.findUnique({
      where: { id: req.params.id },
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

    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/orders
 * Create a new order (Customer initiates checkout)
 */
router.post("/", checkoutLimiter, authenticateToken, async (req, res) => {
  try {
    const { vendorId, items, deliveryAddress, deliveryLat, deliveryLng } =
      req.body;
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
      return res
        .status(404)
        .json({ success: false, error: "Vendor not found" });
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

    const serviceFee = config.serviceFeeNaira;
    const platformFee = 0;
    const totalAmount = foodCost + serviceFee + platformFee;
    const paymentReference = `SG-ORD-${Date.now()}-${generateIdempotencyKey()}`;

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
      callbackUrl: config.paystack.callbackUrl,
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
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    if (role === "VENDOR") {
      const vendor = await global.prisma.Vendor.findUnique({
        where: { userId },
      });
      if (!vendor || order.vendorId !== vendor.id) {
        return res.status(403).json({
          success: false,
          error: "Not authorized to view this order",
        });
      }
    } else if (
      role !== "ADMIN" &&
      role !== "SUPER_ADMIN" &&
      order.userId !== userId
    ) {
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
      const vendor = await global.prisma.Vendor.findUnique({
        where: { userId },
      });
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

      const order = await global.prisma.Order.findUnique({
        where: { id },
        include: {
          user: {
            select: { id: true, phone: true, email: true },
          },
        },
      });
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

      const dvcCode = generateDVC(config.dvc.length);

      // Guarded transition: a concurrent customer cancel, vendor reject, or
      // auto-kill wins and this update matches nothing.
      const accepted = await global.prisma.Order.updateMany({
        where: { id, vendorId: vendor.id, status: "PENDING" },
        data: {
          status: "ACCEPTED",
          acceptedAt: new Date(),
          acceptanceDeadline: null,
          // Only the salted hash is stored; verification never compares
          // plaintext. The raw code goes to the vendor once via notification.
          dvcCode: hashCode(dvcCode),
        },
      });

      if (accepted.count === 0) {
        const latest = await global.prisma.Order.findUnique({
          where: { id },
          select: { status: true },
        });

        if (latest && latest.status === "ACCEPTED") {
          return res.json({
            success: true,
            message: "Order already accepted",
            orderId: id,
            status: "ACCEPTED",
          });
        }

        return res.status(400).json({
          success: false,
          error: `Cannot accept order in ${latest ? latest.status : "unknown"} status`,
        });
      }

      emitOrderStatusUpdate({ ...currentOrder, status: "ACCEPTED" });

      // Fire-and-forget: the vendor receives the DVC at acceptance (to pass
      // to the rider) and the customer is told their order was accepted.
      void sendOrderNotification({
        type: "ACCEPTED",
        orderId: id,
        vendorName: vendor.name,
        customer: currentOrder.user || null,
      }).catch((error) =>
        console.error(`[Notifications] accept notify failed for ${id}:`, error.message),
      );
      void sendOrderNotification({
        type: "VENDOR_DVC",
        orderId: id,
        vendorName: vendor.name,
        vendor,
        dvc: dvcCode,
      }).catch((error) =>
        console.error(`[Notifications] DVC notify failed for ${id}:`, error.message),
      );

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
 * POST /api/orders/:id/preparing
 * Vendor marks an accepted order as being prepared.
 * Only ACCEPTED -> PREPARING is allowed (backwards-compatible paths can
 * still jump ACCEPTED -> OUT_FOR_DELIVERY without passing through here).
 */
router.post(
  "/:id/preparing",
  authenticateToken,
  authorize("VENDOR"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const vendorUserId = req.user.userId;

      const vendor = await global.prisma.Vendor.findUnique({
        where: { userId: vendorUserId },
      });
      const order = await global.prisma.Order.findUnique({
        where: { id },
        include: {
          user: {
            select: { id: true, phone: true, email: true },
          },
        },
      });

      if (!vendor || !order || order.vendorId !== vendor.id) {
        return res
          .status(403)
          .json({ success: false, error: "Not authorized" });
      }

      if (order.status === "PREPARING") {
        return res.json({
          success: true,
          message: "Order is already being prepared",
          orderId: id,
          status: "PREPARING",
        });
      }

      if (order.status !== "ACCEPTED") {
        return res.status(400).json({
          success: false,
          error: `Cannot mark as preparing from ${order.status}`,
        });
      }

      const updated = await global.prisma.Order.updateMany({
        where: { id, vendorId: vendor.id, status: "ACCEPTED" },
        data: {
          status: "PREPARING",
          preparedAt: new Date(),
        },
      });

      if (updated.count === 0) {
        const latest = await global.prisma.Order.findUnique({
          where: { id },
          select: { status: true },
        });

        if (latest && latest.status === "PREPARING") {
          return res.json({
            success: true,
            message: "Order is already being prepared",
            orderId: id,
            status: "PREPARING",
          });
        }

        return res.status(400).json({
          success: false,
          error: `Cannot mark as preparing from ${latest ? latest.status : "unknown"}`,
        });
      }

      emitOrderStatusUpdate({ ...order, status: "PREPARING" });

      void sendOrderNotification({
        type: "PREPARING",
        orderId: id,
        vendorName: vendor.name,
        customer: order.user || null,
      }).catch((error) =>
        console.error(`[Notifications] preparing notify failed for ${id}:`, error.message),
      );

      res.json({
        success: true,
        message: "Order marked as preparing",
        orderId: id,
        status: "PREPARING",
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

      const rejected = await global.prisma.Order.updateMany({
        where: { id, status: "PENDING" },
        data: {
          status: "CANCELLED_VENDOR",
          cancelledAt: new Date(),
          acceptanceDeadline: null,
          adminNotes: reason || "Vendor rejected order",
        },
      });

      if (rejected.count === 0) {
        const latest = await global.prisma.Order.findUnique({
          where: { id },
          select: { status: true },
        });

        return res.status(400).json({
          success: false,
          error: `Cannot reject order in ${latest ? latest.status : "unknown"} status`,
        });
      }

      const cancelledOrder = await global.prisma.Order.findUnique({
        where: { id },
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

      emitOrderStatusUpdate({ ...cancelledOrder, status: "REFUNDED" });

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
      const order = await global.prisma.Order.findUnique({
        where: { id },
        include: {
          user: {
            select: { id: true, phone: true, email: true },
          },
        },
      });

      if (!vendor || !order || order.vendorId !== vendor.id) {
        return res
          .status(403)
          .json({ success: false, error: "Not authorized" });
      }

      if (order.status === "OUT_FOR_DELIVERY") {
        return res.json({
          success: true,
          message: "Order already out for delivery",
          orderId: id,
          status: order.status,
        });
      }

      if (order.status !== "ACCEPTED" && order.status !== "PREPARING") {
        return res.status(400).json({
          success: false,
          error: `Cannot mark as out for delivery from ${order.status}`,
        });
      }

      const updated = await global.prisma.Order.updateMany({
        where: { id, vendorId: vendor.id, status: { in: ["ACCEPTED", "PREPARING"] } },
        data: {
          status: "OUT_FOR_DELIVERY",
          preparedAt: new Date(),
        },
      });

      if (updated.count === 0) {
        const latest = await global.prisma.Order.findUnique({
          where: { id },
          select: { status: true },
        });

        if (latest && latest.status === "OUT_FOR_DELIVERY") {
          return res.json({
            success: true,
            message: "Order already out for delivery",
            orderId: id,
            status: "OUT_FOR_DELIVERY",
          });
        }

        return res.status(400).json({
          success: false,
          error: `Cannot mark as out for delivery from ${latest ? latest.status : "unknown"}`,
        });
      }

      emitOrderStatusUpdate({ ...order, status: "OUT_FOR_DELIVERY" });

      void sendOrderNotification({
        type: "OUT_FOR_DELIVERY",
        orderId: id,
        vendorName: vendor.name,
        customer: order.user || null,
      }).catch((error) =>
        console.error(`[Notifications] out-for-delivery notify failed for ${id}:`, error.message),
      );

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
        return res
          .status(403)
          .json({ success: false, error: "Not authorized" });
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

      // The stored DVC is a salted hash, never the plaintext code.
      if (!verifyCode(dvcCode.toUpperCase(), order.dvcCode)) {
        // Atomic increment so simultaneous wrong submissions all count.
        await global.prisma.Order.update({
          where: { id },
          data: { dvcAttempts: { increment: 1 } },
        });

        const attemptsSnapshot = await global.prisma.Order.findUnique({
          where: { id },
          select: { dvcAttempts: true, dvcLockedUntil: true },
        });

        if (
          attemptsSnapshot &&
          attemptsSnapshot.dvcAttempts >= config.dvc.maxAttempts &&
          !attemptsSnapshot.dvcLockedUntil
        ) {
          await global.prisma.Order.updateMany({
            where: { id, dvcLockedUntil: null },
            data: {
              dvcLockedUntil: new Date(
                Date.now() + config.dvc.lockoutMinutes * 60 * 1000,
              ),
            },
          });
        }

        return res
          .status(400)
          .json({ success: false, error: "Invalid DVC code" });
      }

      const delivered = await global.prisma.Order.updateMany({
        where: { id, vendorId: vendor.id, status: "OUT_FOR_DELIVERY" },
        data: {
          status: "DELIVERED",
          deliveredAt: new Date(),
          dvcEnteredAt: new Date(),
          dvcLockedUntil: null,
        },
      });

      if (delivered.count === 0) {
        const latest = await global.prisma.Order.findUnique({
          where: { id },
          select: { status: true },
        });

        if (
          latest &&
          (latest.status === "DELIVERED" || latest.status === "COMPLETED")
        ) {
          return res.json({
            success: true,
            message: "DVC already verified",
            orderId: id,
            status: latest.status,
          });
        }

        return res.status(400).json({
          success: false,
          error: "Order is not out for delivery yet",
        });
      }

      emitOrderStatusUpdate({ ...order, status: "DELIVERED" });

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
 * POST /api/orders/:id/complete
 * Finalize a delivered order and unlock settlement
 */
router.post(
  "/:id/complete",
  authenticateToken,
  authorize("VENDOR", "ADMIN", "SUPER_ADMIN"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.userId;
      const role = req.user.role;

      const order = await global.prisma.Order.findUnique({
        where: { id },
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          error: "Order not found",
        });
      }

      if (role === "VENDOR") {
        const vendor = await global.prisma.Vendor.findUnique({
          where: { userId },
        });

        if (!vendor || order.vendorId !== vendor.id) {
          return res.status(403).json({
            success: false,
            error: "Not authorized to complete this order",
          });
        }
      }

      const result = await completeDeliveredOrder(id);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }

      // Update loyalty points for customer after order completion
      try {
        const pointsResult = await updateLoyaltyPointsOnOrderCompletion(id);
        if (pointsResult.success) {
          console.log(
            `[Order] Loyalty points +${pointsResult.pointsEarned} credited to order ${id}`,
          );
        }
      } catch (pointsError) {
        console.error(
          `[Order] Error updating loyalty points for order ${id}:`,
          pointsError.message,
        );
        // Don't fail the request, just log the error
      }

      emitOrderStatusUpdate(result.order);

      return res.json({
        success: true,
        message: result.alreadyCompleted
          ? "Order already completed"
          : "Order completed successfully",
        orderId: id,
        status: result.order.status,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
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

    const cancelled = await global.prisma.Order.updateMany({
      where: { id, userId, status: "PENDING" },
      data: {
        status: "CANCELLED_CUSTOMER",
        cancelledAt: new Date(),
        acceptanceDeadline: null,
        adminNotes: reason || "Customer cancelled before vendor acceptance",
      },
    });

    if (cancelled.count === 0) {
      const latest = await global.prisma.Order.findUnique({
        where: { id },
        select: { status: true },
      });

      return res.status(400).json({
        success: false,
        error: `Cannot cancel order in ${latest ? latest.status : "unknown"} status`,
      });
    }

    const cancelledOrder = await global.prisma.Order.findUnique({
      where: { id },
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

    emitOrderStatusUpdate({ ...cancelledOrder, status: "REFUNDED" });

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

export default router;
