import { afterAll, afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

// Restored from a pre-ESM-migration CommonJS test file (see
// vendorRoutes.endpoints.test.js for context). Assertions unchanged.
// This mocks ../services/orderService.js entirely — orderService.js's own
// real logic is exercised separately by orderService.test.js and
// orderTransitions.test.js.

let mockCurrentUser;

const initializePayment = jest.fn();
const autoKillExpiredPendingOrder = jest.fn((order) => Promise.resolve(order));
const completeDeliveredOrder = jest.fn();
const triggerOrderRefund = jest.fn(() => Promise.resolve({ success: true }));

await jest.unstable_mockModule("../middleware/auth.js", () => ({
  authenticateToken: (req, res, next) => {
    req.user = mockCurrentUser;
    next();
  },
  authorize:
    (...roles) =>
    (req, res, next) => {
      if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
        });
      }
      next();
    },
}));

await jest.unstable_mockModule("../middleware/rateLimiter.js", () => ({
  checkoutLimiter: (req, res, next) => next(),
}));

await jest.unstable_mockModule("../utils/paystack.js", () => ({
  initializePayment,
}));

await jest.unstable_mockModule("../services/orderService.js", () => ({
  CANCELLABLE_STATUSES: new Set(["PENDING"]),
  autoKillExpiredPendingOrder,
  completeDeliveredOrder,
  triggerOrderRefund,
}));

const { startTestServer } = await import("./startTestServer.js");
const orderRouter = (await import("../routes/orderRoutes.js")).default;

describe("orderRoutes", () => {
  let server;
  let prisma;

  beforeEach(async () => {
    mockCurrentUser = { userId: "user_1", role: "MEMBER" };
    prisma = {
      Order: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      User: {
        findUnique: jest.fn(),
      },
      Vendor: {
        findUnique: jest.fn(),
      },
      Product: {
        findUnique: jest.fn(),
      },
    };
    global.prisma = prisma;
    jest.clearAllMocks();
    server = await startTestServer(orderRouter);
  });

  afterEach(async () => {
    await server.close();
  });

  afterAll(() => {
    delete global.prisma;
  });

  it("returns the existing order for an idempotent checkout retry", async () => {
    prisma.Order.findUnique.mockResolvedValue({
      id: "ord_existing",
      userId: "user_1",
      paymentReference: "pay_ref_existing",
      paystackAccessCode: "access_existing",
      idempotencyKey: "idem_1",
      status: "UNPAID",
    });

    const response = await server.request("/", {
      method: "POST",
      headers: {
        "x-idempotency-key": "idem_1",
      },
      body: JSON.stringify({
        vendorId: "vendor_1",
        items: [{ productId: "prod_1", quantity: 1 }],
        deliveryAddress: "123 Test Street",
      }),
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "Existing order returned for idempotent request",
      orderId: "ord_existing",
      reference: "pay_ref_existing",
      paystackAccessCode: "access_existing",
      idempotencyKey: "idem_1",
      status: "UNPAID",
    });
    expect(initializePayment).not.toHaveBeenCalled();
    expect(prisma.Order.create).not.toHaveBeenCalled();
  });

  it("blocks completion when a vendor does not own the order", async () => {
    mockCurrentUser = { userId: "vendor_user_1", role: "VENDOR" };
    prisma.Order.findUnique.mockResolvedValue({
      id: "ord_2",
      vendorId: "vendor_other",
      status: "DELIVERED",
    });
    prisma.Vendor.findUnique.mockResolvedValue({
      id: "vendor_1",
      userId: "vendor_user_1",
    });

    const response = await server.request("/ord_2/complete", {
      method: "POST",
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      error: "Not authorized to complete this order",
    });
    expect(completeDeliveredOrder).not.toHaveBeenCalled();
  });

  it("completes a delivered order for the owning vendor", async () => {
    mockCurrentUser = { userId: "vendor_user_1", role: "VENDOR" };
    prisma.Order.findUnique.mockResolvedValue({
      id: "ord_3",
      vendorId: "vendor_1",
      status: "DELIVERED",
    });
    prisma.Vendor.findUnique.mockResolvedValue({
      id: "vendor_1",
      userId: "vendor_user_1",
    });
    completeDeliveredOrder.mockResolvedValue({
      success: true,
      order: {
        id: "ord_3",
        status: "COMPLETED",
      },
    });

    const response = await server.request("/ord_3/complete", {
      method: "POST",
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "Order completed successfully",
      orderId: "ord_3",
      status: "COMPLETED",
    });
    expect(completeDeliveredOrder).toHaveBeenCalledWith("ord_3");
  });

  it("returns a stable success response when accepting an already accepted order", async () => {
    mockCurrentUser = { userId: "vendor_user_2", role: "VENDOR" };
    prisma.Vendor.findUnique.mockResolvedValue({
      id: "vendor_2",
      userId: "vendor_user_2",
    });
    prisma.Order.findUnique.mockResolvedValue({
      id: "ord_4",
      vendorId: "vendor_2",
      status: "ACCEPTED",
    });
    autoKillExpiredPendingOrder.mockResolvedValue({
      id: "ord_4",
      vendorId: "vendor_2",
      status: "ACCEPTED",
    });

    const response = await server.request("/ord_4/accept", {
      method: "POST",
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "Order already accepted",
      orderId: "ord_4",
      status: "ACCEPTED",
    });
    expect(prisma.Order.update).not.toHaveBeenCalled();
  });

  it("surfaces refund initialization failure during vendor rejection", async () => {
    mockCurrentUser = { userId: "vendor_user_3", role: "VENDOR" };
    prisma.Vendor.findUnique.mockResolvedValue({
      id: "vendor_3",
      userId: "vendor_user_3",
    });
    // First findUnique: the order fetched before the atomic claim. Second:
    // the cancelled order re-fetched after the claim succeeds, passed to
    // triggerOrderRefund. The status transition itself is an atomic
    // updateMany claim, not a plain update (concurrency-safety refactor).
    prisma.Order.findUnique
      .mockResolvedValueOnce({
        id: "ord_5",
        vendorId: "vendor_3",
        status: "PENDING",
      })
      .mockResolvedValueOnce({
        id: "ord_5",
        vendorId: "vendor_3",
        status: "CANCELLED_VENDOR",
        totalAmount: 5000,
        paymentReference: "pay_ref_5",
      });
    autoKillExpiredPendingOrder.mockResolvedValue({
      id: "ord_5",
      vendorId: "vendor_3",
      status: "PENDING",
    });
    prisma.Order.updateMany.mockResolvedValue({ count: 1 });
    triggerOrderRefund.mockResolvedValue({
      success: false,
      error: "provider timeout",
    });

    const response = await server.request("/ord_5/reject", {
      method: "POST",
      body: JSON.stringify({ reason: "Out of stock" }),
    });

    expect(response.status).toBe(502);
    expect(response.body).toEqual({
      success: false,
      error: "Order rejected but refund failed to initialize",
      details: "provider timeout",
    });
  });

  it("surfaces refund initialization failure during customer cancellation", async () => {
    prisma.Order.findUnique
      .mockResolvedValueOnce({
        id: "ord_6",
        userId: "user_1",
        status: "PENDING",
      })
      .mockResolvedValueOnce({
        id: "ord_6",
        userId: "user_1",
        status: "CANCELLED_CUSTOMER",
        totalAmount: 2500,
        paymentReference: "pay_ref_6",
      });
    autoKillExpiredPendingOrder.mockResolvedValue({
      id: "ord_6",
      userId: "user_1",
      status: "PENDING",
    });
    prisma.Order.updateMany.mockResolvedValue({ count: 1 });
    triggerOrderRefund.mockResolvedValue({
      success: false,
      error: "refund unavailable",
    });

    const response = await server.request("/ord_6/cancel", {
      method: "POST",
      body: JSON.stringify({ reason: "Changed my mind" }),
    });

    expect(response.status).toBe(502);
    expect(response.body).toEqual({
      success: false,
      error: "Order cancelled but refund failed to initialize",
      details: "refund unavailable",
    });
  });
});
