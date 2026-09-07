process.env.JWT_ACCESS_SECRET ||= "test-access-secret";

import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

let mockCurrentUser = { userId: "vendor_user_1", role: "VENDOR" };

const initiateRefund = jest.fn();

await jest.unstable_mockModule("../middleware/auth.js", () => ({
  authenticateToken: (req, res, next) => {
    req.user = mockCurrentUser;
    next();
  },
  authorize:
    (...roles) =>
    (req, res, next) => {
      if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }
      next();
    },
}));

await jest.unstable_mockModule("../middleware/rateLimiter.js", () => ({
  checkoutLimiter: (req, res, next) => next(),
}));

await jest.unstable_mockModule("../utils/paystack.js", () => ({
  initializePayment: jest.fn(),
  initiateRefund,
  verifyWebhookSignature: jest.fn(),
  createSubAccount: jest.fn(),
  createPaymentSplit: jest.fn(),
  verifyPayment: jest.fn(),
  generatePaystackReference: jest.fn(() => "pay_ref_test"),
}));

await jest.unstable_mockModule("../services/customerService.js", () => ({
  updateLoyaltyPointsOnOrderCompletion: jest.fn(),
}));

const { startTestServer } = await import("./startTestServer.js");
const {
  triggerOrderRefund,
  completeDeliveredOrder,
  retryFailedRefunds,
} = await import("../services/orderService.js");
const { hashCode } = await import("../utils/generators.js");
const orderRouter = (await import("../routes/orderRoutes.js")).default;

function buildPrisma() {
  return {
    Vendor: {
      findUnique: jest.fn().mockResolvedValue({ id: "vendor_1", userId: "vendor_user_1" }),
    },
    User: { findUnique: jest.fn() },
    Order: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
  };
}

describe("guarded order transitions", () => {
  const servers = [];
  let prisma;
  const futureDeadline = new Date(Date.now() + 15 * 60 * 1000);

  beforeEach(async () => {
    mockCurrentUser = { userId: "vendor_user_1", role: "VENDOR" };
    prisma = buildPrisma();
    global.prisma = prisma;
    global.io = { to: jest.fn(() => ({ emit: jest.fn() })) };
    jest.clearAllMocks();
    servers.push(await startTestServer(orderRouter));
  });

  afterEach(async () => {
    while (servers.length) {
      await servers.pop().close();
    }
  });

  afterAll(() => {
    delete global.prisma;
    delete global.io;
  });

  it("accepts a pending order atomically", async () => {
    prisma.Order.findUnique.mockResolvedValue({
      id: "ord_1",
      vendorId: "vendor_1",
      status: "PENDING",
      acceptanceDeadline: futureDeadline,
    });
    prisma.Order.updateMany.mockResolvedValueOnce({ count: 1 });

    const server = servers.at(-1);
    const response = await server.request("/ord_1/accept", { method: "POST" });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ACCEPTED");
    expect(prisma.Order.update).not.toHaveBeenCalled();
  });

  it("rejects acceptance when a cancel/auto-kill won the race", async () => {
    prisma.Order.findUnique
      .mockResolvedValueOnce({
        id: "ord_2",
        vendorId: "vendor_1",
        status: "PENDING",
        acceptanceDeadline: futureDeadline,
      })
      .mockResolvedValueOnce({ id: "ord_2", status: "CANCELLED_CUSTOMER" });

    prisma.Order.updateMany.mockResolvedValueOnce({ count: 0 }); // accept loses

    const server = servers.at(-1);
    const response = await server.request("/ord_2/accept", { method: "POST" });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("CANCELLED_CUSTOMER");
  });

  it("never issues a second refund when the atomic claim is taken", async () => {
    prisma.Order.updateMany.mockResolvedValue({ count: 0 });

    const result = await triggerOrderRefund(
      { id: "ord_3", status: "CANCELLED_CUSTOMER", totalAmount: 5000 },
      "test",
    );

    expect(result.alreadyRefunded).toBe(true);
    expect(initiateRefund).not.toHaveBeenCalled();
  });

  it("releases the refund claim when Paystack rejects the refund", async () => {
    prisma.Order.updateMany
      .mockResolvedValueOnce({ count: 1 }) // claim acquired
      .mockResolvedValueOnce({ count: 1 }); // claim released
    initiateRefund.mockResolvedValue({ success: false, error: "declined" });

    const result = await triggerOrderRefund(
      {
        id: "ord_4",
        status: "CANCELLED_CUSTOMER",
        paymentReference: "ref_4",
        totalAmount: 5000,
      },
      "test",
    );

    expect(result.success).toBe(false);
    expect(prisma.Order.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { refundInitiatedAt: null },
      }),
    );
    expect(prisma.Order.update).not.toHaveBeenCalled();
  });

  it("completes a delivered order exactly once under concurrency", async () => {
    prisma.Order.findUnique
      .mockResolvedValueOnce({ id: "ord_5", status: "DELIVERED" })
      .mockResolvedValueOnce({ id: "ord_5", status: "COMPLETED" })
      .mockResolvedValueOnce({ id: "ord_5", status: "DELIVERED" })
      .mockResolvedValueOnce({ id: "ord_5", status: "COMPLETED" });
    prisma.Order.updateMany
      .mockResolvedValueOnce({ count: 1 }) // first caller wins
      .mockResolvedValueOnce({ count: 0 }); // second caller loses

    const first = await completeDeliveredOrder("ord_5");
    const second = await completeDeliveredOrder("ord_5");

expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(second.alreadyCompleted).toBe(true);
    expect(prisma.Order.update).not.toHaveBeenCalled();
  });

  it("stores only a hashed DVC when accepting an order", async () => {
    prisma.Order.findUnique.mockResolvedValue({
      id: "ord_6",
      vendorId: "vendor_1",
      status: "PENDING",
      acceptanceDeadline: futureDeadline,
    });
    prisma.Order.updateMany.mockResolvedValueOnce({ count: 1 });

    const server = servers.at(-1);
    const response = await server.request("/ord_6/accept", { method: "POST" });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ACCEPTED");
    expect(prisma.Order.updateMany).toHaveBeenCalledTimes(1);
    // sha256 hex digest length 64; plaintext DVC never hits the database.
    expect(prisma.Order.updateMany.mock.calls[0][0].data.dvcCode).toMatch(
      /^[0-9a-f]{64}$/,
    );
  });

  it("marks an accepted order as preparing atomically", async () => {
    prisma.Order.findUnique.mockResolvedValue({
      id: "ord_7",
      vendorId: "vendor_1",
      status: "ACCEPTED",
    });
    prisma.Order.updateMany.mockResolvedValueOnce({ count: 1 });

    const server = servers.at(-1);
    const response = await server.request("/ord_7/preparing", {
      method: "POST",
    });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("PREPARING");
    expect(prisma.Order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "ACCEPTED" }),
        data: expect.objectContaining({ status: "PREPARING" }),
      }),
    );
  });

  it("rejects preparing a non-accepted order", async () => {
    prisma.Order.findUnique.mockResolvedValue({
      id: "ord_8",
      vendorId: "vendor_1",
      status: "PENDING",
    });

    const server = servers.at(-1);
    const response = await server.request("/ord_8/preparing", {
      method: "POST",
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("PENDING");
    expect(prisma.Order.updateMany).not.toHaveBeenCalled();
  });

  it("marks an accepted order out for delivery", async () => {
    prisma.Order.findUnique.mockResolvedValue({
      id: "ord_9",
      vendorId: "vendor_1",
      status: "ACCEPTED",
    });
    prisma.Order.updateMany.mockResolvedValueOnce({ count: 1 });

    const server = servers.at(-1);
    const response = await server.request("/ord_9/out-for-delivery", {
      method: "POST",
    });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("OUT_FOR_DELIVERY");
  });

  it("marks a preparing order out for delivery", async () => {
    prisma.Order.findUnique.mockResolvedValue({
      id: "ord_10",
      vendorId: "vendor_1",
      status: "PREPARING",
    });
    prisma.Order.updateMany.mockResolvedValueOnce({ count: 1 });

    const server = servers.at(-1);
    const response = await server.request("/ord_10/out-for-delivery", {
      method: "POST",
    });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("OUT_FOR_DELIVERY");
    expect(prisma.Order.updateMany.mock.calls[0][0].where.status.in).toEqual([
      "ACCEPTED",
      "PREPARING",
    ]);
  });

  it("verifies a DVC against its stored hash", async () => {
    prisma.Order.findUnique.mockResolvedValue({
      id: "ord_11",
      vendorId: "vendor_1",
      status: "OUT_FOR_DELIVERY",
      dvcCode: hashCode("ABCD12"),
      dvcLockedUntil: null,
    });
    prisma.Order.updateMany.mockResolvedValueOnce({ count: 1 });

    const server = servers.at(-1);
    const response = await server.request("/ord_11/verify-dvc", {
      method: "POST",
      body: JSON.stringify({ dvcCode: "abcd12" }),
    });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("DELIVERED");
    // Case-insensitive: the route uppercases before hashing and comparing.
    expect(prisma.Order.update).not.toHaveBeenCalled();
  });

  it("rejects a wrong DVC and counts the failed attempt", async () => {
    prisma.Order.findUnique
      .mockResolvedValueOnce({
        id: "ord_12",
        vendorId: "vendor_1",
        status: "OUT_FOR_DELIVERY",
        dvcCode: hashCode("ABCD12"),
        dvcLockedUntil: null,
      })
      .mockResolvedValueOnce({ dvcAttempts: 1, dvcLockedUntil: null });
    prisma.Order.update.mockResolvedValue({});

    const server = servers.at(-1);
    const response = await server.request("/ord_12/verify-dvc", {
      method: "POST",
      body: JSON.stringify({ dvcCode: "ZZZZ99" }),
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid DVC code");
    expect(prisma.Order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { dvcAttempts: { increment: 1 } },
      }),
    );
  });

  it("locks DVC verification after the configured max attempts", async () => {
    prisma.Order.findUnique
      .mockResolvedValueOnce({
        id: "ord_13",
        vendorId: "vendor_1",
        status: "OUT_FOR_DELIVERY",
        dvcCode: hashCode("ABCD12"),
        dvcLockedUntil: null,
      })
      .mockResolvedValueOnce({ dvcAttempts: 3, dvcLockedUntil: null });
    prisma.Order.update.mockResolvedValue({});
    prisma.Order.updateMany.mockResolvedValue({ count: 1 });

    const server = servers.at(-1);
    const response = await server.request("/ord_13/verify-dvc", {
      method: "POST",
      body: JSON.stringify({ dvcCode: "ZZZZ99" }),
    });

    expect(response.status).toBe(400);
    const lockoutCall = prisma.Order.updateMany.mock.calls.find(
      (call) => call[0].data && call[0].data.dvcLockedUntil,
    );
    expect(lockoutCall).toBeDefined();
    const lockoutMillis = lockoutCall[0].data.dvcLockedUntil - Date.now();
    expect(lockoutMillis).toBeGreaterThan(14 * 60 * 1000);
    expect(lockoutMillis).toBeLessThan(16 * 60 * 1000);
  });

  it("rejects further DVC attempts while locked", async () => {
    prisma.Order.findUnique.mockResolvedValue({
      id: "ord_13",
      vendorId: "vendor_1",
      status: "OUT_FOR_DELIVERY",
      dvcCode: hashCode("ABCD12"),
      dvcLockedUntil: new Date(Date.now() + 60 * 60 * 1000),
    });

    const server = servers.at(-1);
    const response = await server.request("/ord_13/verify-dvc", {
      method: "POST",
      body: JSON.stringify({ dvcCode: "ABCD12" }),
    });

    expect(response.status).toBe(403);
    expect(response.body.error).toContain("locked");
  });

  it("retries stranded refunds without touching cashed-out or customercancelled orders", async () => {
    prisma.Order.findMany.mockResolvedValue([
      {
        id: "ord_14",
        status: "CANCELLED_VENDOR",
        paymentReference: "ref_14",
        totalAmount: 4000,
        refundInitiatedAt: null,
        refundCompletedAt: null,
      },
      {
        id: "ord_15",
        status: "CANCELLED_AUTO_KILL",
        paymentReference: "ref_15",
        totalAmount: 9000,
        refundInitiatedAt: null,
        refundCompletedAt: null,
      },
    ]);
    prisma.Order.updateMany.mockResolvedValue({ count: 1 });
    prisma.Order.update.mockResolvedValue({});
    initiateRefund.mockResolvedValue({ success: true });

    const processed = await retryFailedRefunds();

    expect(processed).toBe(2);
    expect(prisma.Order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            in: ["CANCELLED_VENDOR", "CANCELLED_AUTO_KILL", "CANCELLED_ADMIN"],
          },
        }),
        orderBy: { cancelledAt: "asc" },
      }),
    );
    expect(initiateRefund).toHaveBeenCalledTimes(2);
    expect(prisma.Order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "REFUNDED" }),
      }),
    );
  });
});
