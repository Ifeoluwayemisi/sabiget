import { initiateRefund } from "../utils/paystack.js";
import { emitOrderStatusUpdate } from "./socketService.js";

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

  // Claim the refund atomically BEFORE contacting Paystack so concurrent
  // paths (customer cancel vs vendor reject vs auto-kill worker) can never
  // issue duplicate refunds for the same order. The claim is released if
  // Paystack rejects the request so a later retry can still refund.
  const claim = await getPrisma().Order.updateMany({
    where: { id: order.id, refundInitiatedAt: null },
    data: { refundInitiatedAt: new Date() },
  });

  if (claim.count === 0) {
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
    await getPrisma().Order.updateMany({
      where: { id: order.id, refundCompletedAt: null },
      data: { refundInitiatedAt: null },
    });
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

  // Guarded transition: if the vendor accepted or the customer cancelled
  // while this function ran, the update matches nothing and the order keeps
  // its winner's state instead of being force-killed.
  const killed = await getPrisma().Order.updateMany({
    where: { id: order.id, status: "PENDING" },
    data: {
      status: "CANCELLED_AUTO_KILL",
      autoKilledAt: new Date(),
      cancelledAt: new Date(),
      acceptanceDeadline: null,
      adminNotes: "Acceptance window expired before vendor action",
    },
  });

  if (killed.count === 0) {
    return getPrisma().Order.findUnique({
      where: { id: order.id },
    });
  }

  const autoKilledOrder = await getPrisma().Order.findUnique({
    where: { id: order.id },
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

  const finalOrder = await getPrisma().Order.findUnique({
    where: { id: order.id },
  });

  emitOrderStatusUpdate(finalOrder);

  return finalOrder;
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

/**
 * Retry stranded refunds. A cancelled order whose Paystack refund call
 * failed (transiently) currently keeps `refundInitiatedAt` cleared, so a
 * background sweep re-arms the atomic claim until Paystack accepts it.
 *
 * Only statuses that ALWAYS follow a confirmed payment are swept. Failed
 * charges also land on CANCELLED_CUSTOMER but are never captured, so they
 * are deliberately excluded to avoid refund noise on money that was never
 * taken.
 */
async function retryFailedRefunds(limit = 50) {
  const stranded = await getPrisma().Order.findMany({
    where: {
      status: {
        in: ["CANCELLED_VENDOR", "CANCELLED_AUTO_KILL", "CANCELLED_ADMIN"],
      },
      refundInitiatedAt: null,
      refundCompletedAt: null,
    },
    take: limit,
    orderBy: {
      cancelledAt: "asc",
    },
  });

  let processed = 0;

  for (const order of stranded) {
    try {
      const result = await triggerOrderRefund(
        order,
        "Retry refund for cancelled order",
      );
      if (result.success) {
        processed += 1;
      }
    } catch (error) {
      console.error(
        `[Refunds] Retry failed for order ${order.id}: ${error.message}`,
      );
    }
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

  // Guarded so concurrent completion requests can only win once; loyalty
  // crediting downstream then runs for exactly one completion.
  const completed = await getPrisma().Order.updateMany({
    where: { id: orderId, status: "DELIVERED" },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      adminNotes: notes,
    },
  });

  if (completed.count === 0) {
    const latest = await getPrisma().Order.findUnique({
      where: { id: orderId },
    });

    if (latest && latest.status === "COMPLETED") {
      return {
        success: true,
        alreadyCompleted: true,
        order: latest,
      };
    }

    return {
      success: false,
      error: `Cannot complete order in ${latest ? latest.status : "unknown"} status`,
    };
  }

  const completedOrder = await getPrisma().Order.findUnique({
    where: { id: orderId },
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
  retryFailedRefunds,
  completeDeliveredOrder,
};
