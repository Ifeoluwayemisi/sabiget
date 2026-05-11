import { afterAll, afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

let mockCurrentUser;

const initializePayment = jest.fn();
const verifyWebhookSignature = jest.fn();
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
  initializePayment,
  verifyWebhookSignature,
  initiateRefund,
  createSubAccount: jest.fn(),
  createPaymentSplit: jest.fn(),
  verifyPayment: jest.fn(),
  generatePaystackReference: jest.fn(() => "pay_ref_test"),
}));

const { startTestServer } = await import("./startTestServer.js");
const productRouter = (await import("../routes/productRoutes.js")).default;
const orderRouter = (await import("../routes/orderRoutes.js")).default;
const webhookRouter = (await import("../routes/webhookRoutes.js")).default;

describe("product, order, and webhook endpoint verification", () => {
  let productServer;
  let orderServer;
  let webhookServer;
  let prisma;

  beforeEach(async () => {
    mockCurrentUser = { userId: "user_1", role: "MEMBER" };
    prisma = {
      Product: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      Vendor: {
        findUnique: jest.fn(),
      },
      User: {
        findUnique: jest.fn(),
      },
      Order: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      RefreshToken: {
        findUnique: jest.fn(),
      },
      WebhookLog: {
        create: jest.fn(),
        update: jest.fn(),
      },
      Review: {
        count: jest.fn(),
      },
    };
    global.prisma = prisma;
    global.io = { to: jest.fn(() => ({ emit: jest.fn() })) };
    jest.clearAllMocks();
    productServer = await startTestServer(productRouter);
    orderServer = await startTestServer(orderRouter);
    webhookServer = await startTestServer(webhookRouter, { withRawBody: true });
  });

  afterEach(async () => {
    await productServer.close();
    await orderServer.close();
    await webhookServer.close();
  });

  afterAll(() => {
    delete global.prisma;
    delete global.io;
  });

  it("verifies product endpoints", async () => {
    mockCurrentUser = { userId: "user_1", role: "VENDOR" };
    prisma.Product.findMany.mockResolvedValue([{ id: "p1" }]);
    prisma.Product.findUnique
      .mockResolvedValueOnce({ id: "p1", vendor: { id: "v1" } })
      .mockResolvedValueOnce({ id: "p1", vendorId: "vendor_1" })
      .mockResolvedValueOnce({ id: "p1", vendorId: "vendor_1" });
    prisma.Vendor.findUnique.mockResolvedValue({ id: "vendor_1", userId: "user_1" });
    prisma.Product.create.mockResolvedValue({ id: "p_new" });
    prisma.Product.update.mockResolvedValue({ id: "p1", name: "Updated" });
    prisma.Product.delete.mockResolvedValue({ id: "p1" });

    const responses = await Promise.all([
      productServer.request("/", { method: "GET" }),
      productServer.request("/p1", { method: "GET" }),
      productServer.request("/", {
        method: "POST",
        body: JSON.stringify({ name: "Jollof", price: 2500 }),
      }),
      productServer.request("/p1", {
        method: "PATCH",
        body: JSON.stringify({ name: "Updated" }),
      }),
      productServer.request("/p1", { method: "DELETE" }),
    ]);

    responses.forEach((response) => expect(response.status).toBeLessThan(400));
  });

  it("verifies order lifecycle endpoints", async () => {
    prisma.Order.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "order_1",
        userId: "user_1",
        vendorId: "vendor_1",
        status: "UNPAID",
        paymentReference: "ref_1",
        paystackAccessCode: "acc_1",
        idempotencyKey: "key_1",
      })
      .mockResolvedValueOnce({
        id: "order_2",
        userId: "user_1",
        vendorId: "vendor_1",
        status: "DELIVERED",
      });
    prisma.User.findUnique.mockResolvedValue({ id: "user_1", email: "user@example.com" });
    prisma.Vendor.findUnique.mockResolvedValue({ id: "vendor_1", paystackSubcode: "SUB_1", userId: "vendor_user_1" });
    prisma.Product.findUnique.mockResolvedValue({ id: "p1", vendorId: "vendor_1", isAvailable: true, price: 2000 });
    prisma.Order.create.mockResolvedValue({ id: "order_new" });
    prisma.Order.update.mockResolvedValue({ id: "order_new", paystackAccessCode: "acc_1" });
    prisma.Order.findMany.mockResolvedValue([{ id: "order_1", status: "PENDING" }]);
    initializePayment.mockResolvedValue({
      success: true,
      data: { authorization_url: "https://pay", access_code: "acc_1" },
    });

    const createResponse = await orderServer.request("/", {
      method: "POST",
      headers: { "x-idempotency-key": "key_1" },
      body: JSON.stringify({
        vendorId: "vendor_1",
        items: [{ productId: "p1", quantity: 1 }],
        deliveryAddress: "123 Street",
        deliveryLat: 6.5,
        deliveryLng: 3.3,
      }),
    });

    mockCurrentUser = { userId: "user_1", role: "MEMBER" };
    const listResponse = await orderServer.request("/", { method: "GET" });

    expect(createResponse.status).toBe(201);
    expect(listResponse.status).toBe(200);
  });

  it("verifies webhook processing paths", async () => {
    verifyWebhookSignature.mockReturnValue(true);
    prisma.WebhookLog.create.mockResolvedValue({ id: "webhook_1" });
    prisma.Order.findUnique
      .mockResolvedValueOnce({
        id: "ord_1",
        vendorId: "vendor_1",
        user: { id: "user_1", name: "Ada", phone: "+234" },
        items: [],
        paymentReference: "ref_1",
        totalAmount: 4500,
        status: "UNPAID",
      })
      .mockResolvedValueOnce({
        id: "ord_2",
        paymentReference: "ref_2",
        status: "UNPAID",
      });
    prisma.Order.update
      .mockResolvedValueOnce({
        id: "ord_1",
        vendorId: "vendor_1",
        user: { id: "user_1", name: "Ada", phone: "+234" },
        items: [],
        totalAmount: 4500,
        status: "PENDING",
        acceptanceDeadline: new Date(),
      })
      .mockResolvedValueOnce({
        id: "ord_2",
        status: "CANCELLED_CUSTOMER",
      });

    const successResponse = await webhookServer.request("/paystack", {
      method: "POST",
      headers: { "x-paystack-signature": "valid" },
      body: JSON.stringify({
        event: "charge.success",
        data: {
          reference: "ref_1",
          amount: 450000,
          metadata: { orderId: "ord_1" },
        },
      }),
    });

    const failedResponse = await webhookServer.request("/paystack", {
      method: "POST",
      headers: { "x-paystack-signature": "valid" },
      body: JSON.stringify({
        event: "charge.failed",
        data: {
          reference: "ref_2",
          metadata: { orderId: "ord_2" },
        },
      }),
    });

    expect(successResponse.status).toBe(200);
    expect(failedResponse.status).toBe(200);
  });
});
