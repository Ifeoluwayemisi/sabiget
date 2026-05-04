// Order Routes - Order management, payment, delivery verification
const express = require("express");
const router = express.Router();
const { authenticateToken, authorize } = require("../middleware/auth");
const { checkoutLimiter } = require("../middleware/rateLimiter");
const { initializePayment } = require("../utils/paystack");
const crypto = require("crypto");

/**
 * POST /api/orders
 * Create a new order (Customer initiates checkout)
 */
router.post("/", checkoutLimiter, authenticateToken, async (req, res) => {
  try {
    const { vendorId, items, deliveryAddress, deliveryLat, deliveryLng } = req.body;
    const userId = req.user.userId;

    if (!vendorId || !items || !items.length || !deliveryAddress) {
      return res.status(400).json({ success: false, error: "Vendor ID, items, and delivery address required" });
    }

    const user = await global.prisma.User.findUnique({ where: { id: userId } });
    const vendor = await global.prisma.Vendor.findUnique({ where: { id: vendorId } });
    
    if (!vendor) return res.status(404).json({ success: false, error: "Vendor not found" });
    if (!vendor.paystackSubcode) {
      return res.status(400).json({ success: false, error: "Vendor is not configured to receive payments yet." });
    }

    let foodCost = 0;
    const orderItemsData = [];

    // Process items and calculate total securely from database
    for (const item of items) {
      const product = await global.prisma.Product.findUnique({ where: { id: item.productId } });
      if (!product || product.vendorId !== vendor.id || !product.isAvailable) {
        return res.status(400).json({ success: false, error: `Product ${item.productId} is invalid or unavailable` });
      }
      
      const totalPrice = product.price * item.quantity;
      foodCost += totalPrice;
      
      orderItemsData.push({
        productId: product.id,
        quantity: item.quantity,
        pricePerUnit: product.price,
        totalPrice: totalPrice,
        specialRequests: item.specialRequests || null
      });
    }

    const serviceFee = 500; // Flat fee for SabiGet
    const platformFee = 0;
    const totalAmount = foodCost + serviceFee + platformFee;

    const idempotencyKey = crypto.randomUUID();
    const paymentReference = `SG-ORD-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // Create Order
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
          create: orderItemsData
        }
      }
    });

    // Initialize Paystack with Split
    const paystackRes = await initializePayment({
      email: user.email || "customer@sabiget.com",
      amount: totalAmount,
      reference: paymentReference,
      callbackUrl: "https://sabiget.com/payment-callback", // Would be loaded from env in prod
      subaccount: vendor.paystackSubcode,
      transaction_charge: serviceFee, // SabiGet takes the 500 NGN, the rest goes to the vendor
      metadata: {
        orderId: order.id,
        vendorId: vendor.id,
        userId: userId
      }
    });

    if (!paystackRes.success) {
      return res.status(500).json({ success: false, error: "Payment initialization failed", details: paystackRes.error });
    }

    await global.prisma.Order.update({
      where: { id: order.id },
      data: { paystackAccessCode: paystackRes.data.access_code }
    });

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      orderId: order.id,
      authorizationUrl: paystackRes.data.authorization_url,
      reference: paymentReference
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
          include: { product: true }
        },
        vendor: {
          select: { id: true, name: true, phone: true, email: true }
        },
        user: {
          select: { id: true, name: true, phone: true, email: true }
        }
      }
    });

    if (!order) return res.status(404).json({ success: false, error: "Order not found" });

    // Authorization bounds
    if (role === "VENDOR") {
      const vendor = await global.prisma.Vendor.findUnique({ where: { userId } });
      if (!vendor || order.vendorId !== vendor.id) {
        return res.status(403).json({ success: false, error: "Not authorized to view this order" });
      }
    } else if (role !== "ADMIN" && order.userId !== userId) {
      return res.status(403).json({ success: false, error: "Not authorized to view this order" });
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
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: { product: true }
        },
        vendor: {
          select: { id: true, name: true }
        }
      }
    };

    if (role === "VENDOR") {
      const vendor = await global.prisma.Vendor.findUnique({ where: { userId } });
      if (!vendor) return res.status(403).json({ success: false, error: "Vendor profile not found" });
      
      queryOptions.where = { vendorId: vendor.id };
    } else if (role !== "ADMIN") {
      queryOptions.where = { userId: userId };
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

      const vendor = await global.prisma.Vendor.findUnique({ where: { userId: vendorUserId } });
      if (!vendor) return res.status(403).json({ success: false, error: "Vendor profile not found" });

      const order = await global.prisma.Order.findUnique({ where: { id } });
      if (!order) return res.status(404).json({ success: false, error: "Order not found" });

      if (order.vendorId !== vendor.id) {
        return res.status(403).json({ success: false, error: "Not authorized to accept this order" });
      }

      if (order.status !== "PENDING") {
        return res.status(400).json({ success: false, error: `Cannot accept order in ${order.status} status` });
      }

      const dvcCode = crypto.randomBytes(3).toString('hex').toUpperCase();

      const updatedOrder = await global.prisma.Order.update({
        where: { id },
        data: {
          status: "ACCEPTED",
          acceptedAt: new Date(),
          acceptanceDeadline: null,
          dvcCode: dvcCode
        }
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
      const vendorId = req.user.userId;

      // TODO: Cancel order and trigger refund
      res.json({
        message: "Order rejected",
        orderId: id,
        status: "CANCELLED_VENDOR",
        reason,
        info: "Implementation pending",
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
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

      const vendor = await global.prisma.Vendor.findUnique({ where: { userId: vendorUserId } });
      const order = await global.prisma.Order.findUnique({ where: { id } });
      
      if (!vendor || !order || order.vendorId !== vendor.id) {
         return res.status(403).json({ success: false, error: "Not authorized" });
      }

      if (order.status !== "ACCEPTED") {
        return res.status(400).json({ success: false, error: `Cannot mark as out for delivery from ${order.status}` });
      }

      await global.prisma.Order.update({
        where: { id },
        data: {
          status: "PREPARED",
          preparedAt: new Date()
        }
      });

      res.json({
        success: true,
        message: "Order marked out for delivery",
        orderId: id,
        status: "PREPARED"
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
        return res.status(400).json({ success: false, error: "DVC code required" });
      }

      const vendor = await global.prisma.Vendor.findUnique({ where: { userId: vendorUserId } });
      const order = await global.prisma.Order.findUnique({ where: { id } });
      
      if (!vendor || !order || order.vendorId !== vendor.id) {
         return res.status(403).json({ success: false, error: "Not authorized" });
      }

      if (order.status !== "PREPARED") {
         return res.status(400).json({ success: false, error: `Order is not out for delivery yet` });
      }

      if (order.dvcLockedUntil && order.dvcLockedUntil > new Date()) {
         return res.status(403).json({ success: false, error: "DVC verification is locked due to too many failed attempts. Please contact support." });
      }

      if (order.dvcCode !== dvcCode.toUpperCase()) {
         const newAttempts = order.dvcAttempts + 1;
         const lockUpdate = newAttempts >= 3 ? { dvcLockedUntil: new Date(Date.now() + 30 * 60 * 1000) } : {};
         
         await global.prisma.Order.update({
            where: { id },
            data: { dvcAttempts: newAttempts, ...lockUpdate }
         });

         return res.status(400).json({ success: false, error: "Invalid DVC code" });
      }

      await global.prisma.Order.update({
        where: { id },
        data: {
          status: "DELIVERED",
          deliveredAt: new Date(),
          dvcEnteredAt: new Date(),
          completedAt: new Date()
        }
      });

      res.json({
        success: true,
        message: "DVC verified successfully. Delivery complete!",
        orderId: id,
        status: "DELIVERED"
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

    // TODO: Check if order is still in PENDING status, trigger refund
    res.json({
      message: "Order cancelled",
      orderId: id,
      status: "CANCELLED_CUSTOMER",
      info: "Implementation pending",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/orders/webhook/paystack
 * Webhook handler for Paystack payment notifications
 */
router.post("/webhook/paystack", async (req, res) => {
  try {
    const { event, data } = req.body;

    // TODO: Verify webhook signature, handle payment success/failure
    res.json({
      message: "Webhook processed",
      event,
      info: "Implementation pending",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
