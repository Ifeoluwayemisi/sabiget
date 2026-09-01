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
const { triggerOrderRefund, completeDeliveredOrder } = await import(
  "../services/orderService.js"
);
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
});
