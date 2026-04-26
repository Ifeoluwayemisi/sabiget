// Order Routes - Order management, payment, delivery verification
const express = require("express");
const router = express.Router();
const { authenticateToken, authorize } = require("../middleware/auth");
const { checkoutLimiter } = require("../middleware/rateLimiter");

/**
 * POST /api/orders
 * Create a new order (Customer initiates checkout)
 */
router.post("/", checkoutLimiter, authenticateToken, async (req, res) => {
  try {
    const { vendorId, items, deliveryAddress, deliveryLat, deliveryLng } =
      req.body;
    const userId = req.user.userId;

    if (!vendorId || !items || !deliveryAddress) {
      return res.status(400).json({
        error: "Vendor ID, items, and delivery address required",
      });
    }

    // TODO: Create order and initiate Paystack payment
    res.json({
      message: "Order created",
      userId,
      vendorId,
      status: "UNPAID",
      info: "Implementation pending",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/orders/:id
 * Get order details
 */
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // TODO: Fetch order from database
    res.json({
      message: "Order details fetched",
      orderId: id,
      info: "Implementation pending",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/orders
 * Get user's orders (Customer) or vendor's orders (Vendor)
 */
router.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status } = req.query;

    // TODO: Fetch orders based on role (customer or vendor)
    res.json({
      message: "Orders fetched",
      userId,
      status,
      info: "Implementation pending",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
      const vendorId = req.user.userId;

      // TODO: Update order status to ACCEPTED, stop 10-min timer
      res.json({
        message: "Order accepted",
        orderId: id,
        status: "ACCEPTED",
        info: "Implementation pending",
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
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

      // TODO: Update order status to OUT_FOR_DELIVERY
      res.json({
        message: "Order marked out for delivery",
        orderId: id,
        status: "OUT_FOR_DELIVERY",
        info: "Implementation pending",
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
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

      if (!dvcCode) {
        return res.status(400).json({ error: "DVC code required" });
      }

      // TODO: Verify DVC, unlock payout, update order to DELIVERED
      res.json({
        message: "DVC verified",
        orderId: id,
        status: "DELIVERED",
        info: "Implementation pending",
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
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
