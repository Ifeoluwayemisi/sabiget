// ============================================
// Webhook Routes (Paystack Callbacks)
// ============================================

import express from "express";
import { verifyWebhookSignature } from "../utils/paystack.js";
import { emitOrderStatusUpdate } from "../services/socketService.js";

const router = express.Router();

const ACCEPTANCE_WINDOW_MS = 10 * 60 * 1000;

function getWebhookOrderId(payload) {
  return payload?.metadata?.orderId || null;
}

async function createWebhookLog({ orderId, event, payload }) {
  if (!orderId) {
    return null;
  }

  return global.prisma.WebhookLog.create({
    data: {
      orderId,
      provider: "paystack",
      event,
      payload,
    },
  });
}

async function updateWebhookLog(logId, data) {
  if (!logId) {
    return;
  }

  await global.prisma.WebhookLog.update({
    where: { id: logId },
    data,
  });
}

function buildVendorNotification(order) {
  return {
    orderId: order.id,
    vendorId: order.vendorId,
    status: order.status,
    totalAmount: order.totalAmount,
    deliveryAddress: order.deliveryAddress,
    acceptanceDeadline: order.acceptanceDeadline,
    customer: order.user
      ? {
          id: order.user.id,
          name: order.user.name,
          phone: order.user.phone,
        }
      : null,
    items: order.items?.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      totalPrice: item.totalPrice,
      product: item.product
        ? {
            id: item.product.id,
            name: item.product.name,
          }
        : null,
    })),
  };
}

router.post("/paystack", async (req, res) => {
  let webhookLogId = null;

  try {
    const signature = req.headers["x-paystack-signature"];
    const rawBody = req.rawBody || JSON.stringify(req.body);

    if (!verifyWebhookSignature(rawBody, signature)) {
      console.warn("[Webhook] Invalid signature detected");
      return res.status(401).json({
        success: false,
        message: "Invalid webhook signature",
      });
    }

    const { event, data } = req.body;

    webhookLogId = (
      await createWebhookLog({
        orderId: getWebhookOrderId(data),
        event,
        payload: req.body,
      })
    )?.id;

    console.log(`[Webhook] Received event: ${event}`);

    switch (event) {
      case "charge.success":
        await handleChargeSuccess(data);
        break;

      case "charge.failed":
        await handleChargeFailed(data);
        break;

      case "transfer.success":
        await handleTransferSuccess(data);
        break;

      case "transfer.failed":
        await handleTransferFailed(data);
        break;

      default:
        console.log(`[Webhook] Unhandled event: ${event}`);
        break;
    }

    await updateWebhookLog(webhookLogId, {
      processed: true,
      processedAt: new Date(),
      error: null,
    });

    return res.status(200).json({
      success: true,
      message: "Webhook received",
    });
  } catch (error) {
    console.error("[Webhook] Error processing webhook:", error);

    await updateWebhookLog(webhookLogId, {
      processed: false,
      error: error.message,
    });

    return res.status(200).json({
      success: false,
      error: error.message,
    });
  }
});

async function handleChargeSuccess(data) {
  const { reference, metadata, amount } = data;

  console.log(
    `[Webhook] Processing successful charge for reference: ${reference}`,
  );

  if (!metadata?.orderId) {
    console.log(`[Webhook] No order metadata found for reference: ${reference}`);
    return;
  }

  const order = await global.prisma.Order.findUnique({
    where: { id: metadata.orderId },
    include: {
      user: {
        select: { id: true, name: true, phone: true },
      },
      items: {
        include: {
          product: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  if (!order) {
    console.log(`[Webhook] Order not found: ${metadata.orderId}`);
    return;
  }

  if (order.paymentReference !== reference) {
    throw new Error(
      `Payment reference mismatch for order ${order.id}: expected ${order.paymentReference}, received ${reference}`,
    );
  }

  if (Math.round(order.totalAmount * 100) !== amount) {
    throw new Error(
      `Payment amount mismatch for order ${order.id}: expected ${Math.round(order.totalAmount * 100)}, received ${amount}`,
    );
  }

  if (order.status !== "UNPAID") {
    console.log(
      `[Webhook] Order ${order.id} already processed (status: ${order.status})`,
    );
    return;
  }

  const updatedOrder = await global.prisma.Order.update({
    where: { id: order.id },
    data: {
      status: "PENDING",
      acceptanceDeadline: new Date(Date.now() + ACCEPTANCE_WINDOW_MS),
    },
    include: {
      user: {
        select: { id: true, name: true, phone: true },
      },
      items: {
        include: {
          product: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  global.io
    ?.to(`vendor:${updatedOrder.vendorId}`)
    .emit("order:new", buildVendorNotification(updatedOrder));

  emitOrderStatusUpdate(updatedOrder);
}

async function handleChargeFailed(data) {
  const { reference, metadata } = data;

  console.log(`[Webhook] Processing failed charge for reference: ${reference}`);

  if (!metadata?.orderId) {
    console.log(`[Webhook] No order metadata found for failed charge: ${reference}`);
    return;
  }

  const order = await global.prisma.Order.findUnique({
    where: { id: metadata.orderId },
  });

  if (!order) {
    console.log(`[Webhook] Order not found for failed charge: ${metadata.orderId}`);
    return;
  }

  if (order.paymentReference !== reference) {
    throw new Error(
      `Failed-charge reference mismatch for order ${order.id}: expected ${order.paymentReference}, received ${reference}`,
    );
  }

  if (order.status !== "UNPAID") {
    console.log(
      `[Webhook] Failed charge ignored because order ${order.id} is already ${order.status}`,
    );
    return;
  }

  await global.prisma.Order.update({
    where: { id: order.id },
    data: {
      status: "CANCELLED_CUSTOMER",
      cancelledAt: new Date(),
      adminNotes: "Payment failed before order confirmation",
    },
  });
}

async function handleTransferSuccess(data) {
  const { reference } = data;
  console.log(`[Webhook] Processing successful transfer: ${reference}`);
}

async function handleTransferFailed(data) {
  const { reference, reason } = data;
  console.log(
    `[Webhook] Processing failed transfer: ${reference}, Reason: ${reason}`,
  );
}

export default router;
