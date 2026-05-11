import { initiateRefund } from "../utils/paystack.js";

const CANCELLABLE_STATUSES = new Set(["PENDING"]);

function getPrisma() {
  return global.prisma;
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

  await getPrisma().Order.update({
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

  const autoKilledOrder = await getPrisma().Order.update({
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

  return getPrisma().Order.findUnique({
    where: { id: order.id },
  });
}

async function autoKillExpiredPendingOrders(limit = 50) {
  const expiredOrders = await getPrisma().Order.findMany({
    where: {
      status: "PENDING",
      acceptanceDeadline: {
        lte: new Date(),
      },
    },
    take: limit,
    orderBy: {
      acceptanceDeadline: "asc",
    },
  });

  let processed = 0;

  for (const order of expiredOrders) {
    await autoKillExpiredPendingOrder(order);
    processed += 1;
  }

  return processed;
}

async function completeDeliveredOrder(orderId, notes = "Order payout unlocked") {
  const order = await getPrisma().Order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    return {
      success: false,
      error: "Order not found",
    };
  }

  if (order.status === "COMPLETED") {
    return {
      success: true,
      alreadyCompleted: true,
      order,
    };
  }

  if (order.status !== "DELIVERED") {
    return {
      success: false,
      error: `Cannot complete order in ${order.status} status`,
    };
  }

  const completedOrder = await getPrisma().Order.update({
    where: { id: orderId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      adminNotes: notes,
    },
  });

  return {
    success: true,
    order: completedOrder,
  };
}

export {
  CANCELLABLE_STATUSES,
  isAcceptanceExpired,
  triggerOrderRefund,
  autoKillExpiredPendingOrder,
  autoKillExpiredPendingOrders,
  completeDeliveredOrder,
};
