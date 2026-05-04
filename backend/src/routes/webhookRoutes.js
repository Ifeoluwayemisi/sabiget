// ============================================
// Webhook Routes (Paystack Callbacks)
// ============================================

const express = require("express");
const router = express.Router();
const { verifyWebhookSignature } = require("../utils/paystack");

/**
 * POST /api/v1/webhooks/paystack
 * Handle Paystack payment webhooks
 * This is called by Paystack when payment status changes
 */
router.post("/paystack", async (req, res) => {
  try {
    // Verify webhook signature for security
    const signature = req.headers["x-paystack-signature"];
    const rawBody = JSON.stringify(req.body);

    if (!verifyWebhookSignature(rawBody, signature)) {
      console.warn("[Webhook] Invalid signature detected");
      return res.status(401).json({
        success: false,
        message: "Invalid webhook signature",
      });
    }

    const { event, data } = req.body;

    console.log(`[Webhook] Received event: ${event}`);

    // Handle different Paystack events
    switch (event) {
      case "charge.success":
        return handleChargeSuccess(data, res);

      case "charge.failed":
        return handleChargeFailed(data, res);

      case "transfer.success":
        return handleTransferSuccess(data, res);

      case "transfer.failed":
        return handleTransferFailed(data, res);

      default:
        console.log(`[Webhook] Unhandled event: ${event}`);
        return res.status(200).json({
          success: true,
          message: "Webhook received (event not processed)",
        });
    }
  } catch (error) {
    console.error("[Webhook] Error processing webhook:", error);
    // Always return 200 to Paystack to confirm receipt
    return res.status(200).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Handle successful payment (charge.success)
 */
async function handleChargeSuccess(data, res) {
  try {
    const { reference, customer, metadata, amount } = data;

    console.log(`[Webhook] Processing successful charge for reference: ${reference}`);

    if (!metadata || !metadata.orderId) {
       console.log(`[Webhook] No order metadata found for reference: ${reference}`);
       return res.status(200).json({ success: true, message: "Ignored, no order metadata" });
    }

    const orderId = metadata.orderId;

    const order = await global.prisma.Order.findUnique({ where: { id: orderId } });
    if (!order) {
       console.log(`[Webhook] Order not found: ${orderId}`);
       return res.status(200).json({ success: true, message: "Order not found" });
    }

    if (order.status !== "UNPAID") {
       console.log(`[Webhook] Order ${orderId} already processed (Status: ${order.status})`);
       return res.status(200).json({ success: true, message: "Already processed" });
    }

    // Set 10-minute acceptance deadline
    const acceptanceDeadline = new Date(Date.now() + 10 * 60 * 1000);

    await global.prisma.Order.update({
      where: { id: orderId },
      data: {
        status: "PENDING",
        acceptanceDeadline: acceptanceDeadline
      }
    });

    // TODO: Notify vendor via Socket.io with order details

    return res.status(200).json({
      success: true,
      message: "Payment verified and order updated to PENDING",
    });
  } catch (error) {
    console.error("[Webhook] Charge success handler error:", error);
    return res.status(200).json({
      success: false,
      message: "Error processing charge success",
    });
  }
}

/**
 * Handle failed payment (charge.failed)
 */
async function handleChargeFailed(data, res) {
  try {
    const { reference, customer, metadata } = data;

    console.log(
      `[Webhook] Processing failed charge for reference: ${reference}`,
    );

    // TODO: Implement charge failed logic
    // 1. Find order by reference
    // 2. Update order status: UNPAID → FAILED or CANCELLED
    // 3. Send notification to user: "Payment failed. Please try again."
    // 4. Log webhook event

    return res.status(200).json({
      success: true,
      message: "Failed payment processed",
    });
  } catch (error) {
    console.error("[Webhook] Charge failed handler error:", error);
    return res.status(200).json({
      success: false,
      message: "Error processing charge failure",
    });
  }
}

/**
 * Handle successful transfer (transfer.success) - T+1 vendor payout
 */
async function handleTransferSuccess(data, res) {
  try {
    const { reference, recipient, amount } = data;

    console.log(`[Webhook] Processing successful transfer: ${reference}`);

    // TODO: Implement transfer success logic
    // 1. Find PaymentSettlement by transactionId
    // 2. Update settlement status: PENDING → COMPLETED
    // 3. Update vendor balance
    // 4. Log transaction in AuditLog
    // 5. Send notification to vendor: "Payment received!"

    return res.status(200).json({
      success: true,
      message: "Transfer verified",
    });
  } catch (error) {
    console.error("[Webhook] Transfer success handler error:", error);
    return res.status(200).json({
      success: false,
      message: "Error processing transfer success",
    });
  }
}

/**
 * Handle failed transfer (transfer.failed) - T+1 vendor payout failure
 */
async function handleTransferFailed(data, res) {
  try {
    const { reference, recipient, reason } = data;

    console.log(
      `[Webhook] Processing failed transfer: ${reference}, Reason: ${reason}`,
    );

    // TODO: Implement transfer failed logic
    // 1. Find PaymentSettlement
    // 2. Update status: PROCESSING → FAILED
    // 3. Log failure reason
    // 4. Alert admin: "Vendor payout failed - manual intervention needed"
    // 5. Retry mechanism or manual review

    return res.status(200).json({
      success: true,
      message: "Failed transfer processed",
    });
  } catch (error) {
    console.error("[Webhook] Transfer failed handler error:", error);
    return res.status(200).json({
      success: false,
      message: "Error processing transfer failure",
    });
  }
}

module.exports = router;
