import { afterAll, afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

process.env.JWT_ACCESS_SECRET ||= "test-access-secret";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret";

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
        create: jest.fn(),
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

  it("creates a guest checkout order and returns Paystack authorization data", async () => {
    prisma.User.findUnique.mockResolvedValue(null);
    prisma.User.create.mockResolvedValue({ id: "guest_1", email: null });
    prisma.Vendor.findUnique.mockResolvedValue({
      id: "vendor_1",
      paystackSubcode: "SUB_1",
    });
    prisma.Product.findUnique.mockResolvedValue({
      id: "p1",
      vendorId: "vendor_1",
      isAvailable: true,
      price: 2000,
    });
    prisma.Order.create.mockResolvedValue({ id: "order_guest" });
    prisma.Order.update.mockResolvedValue({ id: "order_guest" });
    initializePayment.mockResolvedValue({
      success: true,
      data: { authorization_url: "https://pay", access_code: "acc_guest" },
    });

    const response = await orderServer.request("/guest-checkout", {
      method: "POST",
      body: JSON.stringify({
        phone: "+2348123456789",
        vendorId: "vendor_1",
        items: [{ productId: "p1", quantity: 2 }],
        deliveryAddress: "1 Guest Road",
        deliveryLat: 6.5,
        deliveryLng: 3.3,
      }),
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.authorizationUrl).toBe("https://pay");
    expect(response.body.paystackAccessCode).toBe("acc_guest");
    expect(typeof response.body.guestOrderToken).toBe("string");
    expect(prisma.Order.update).toHaveBeenCalledWith({
      where: { id: "order_guest" },
      data: { paystackAccessCode: "acc_guest" },
    });
  });

  it("persists the request idempotency key on a guest checkout order", async () => {
    prisma.User.findUnique.mockResolvedValue(null);
    prisma.User.create.mockResolvedValue({ id: "guest_key", email: null });
    prisma.Order.findUnique.mockResolvedValue(null);
    prisma.Vendor.findUnique.mockResolvedValue({
      id: "vendor_1",
      paystackSubcode: "SUB_1",
    });
    prisma.Product.findUnique.mockResolvedValue({
      id: "p1",
      vendorId: "vendor_1",
      isAvailable: true,
      price: 2000,
    });
    prisma.Order.create.mockResolvedValue({ id: "order_guest_key" });
    prisma.Order.update.mockResolvedValue({ id: "order_guest_key" });
    initializePayment.mockResolvedValue({
      success: true,
      data: { authorization_url: "https://pay", access_code: "acc_key" },
    });

    const response = await orderServer.request("/guest-checkout", {
      method: "POST",
      headers: { "x-idempotency-key": "idem_g1" },
      body: JSON.stringify({
        phone: "+2348123456789",
        vendorId: "vendor_1",
        items: [{ productId: "p1", quantity: 1 }],
        deliveryAddress: "1 Guest Road",
      }),
    });

    expect(response.status).toBe(201);
    expect(prisma.Order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ idempotencyKey: "idem_g1" }),
      }),
    );
    expect(initializePayment).toHaveBeenCalledTimes(1);
  });

  it("returns the existing order for an idempotent guest checkout retry", async () => {
    prisma.User.findUnique.mockResolvedValue({
      id: "guest_1",
      email: null,
      role: "GUEST",
    });
    prisma.Order.findUnique.mockResolvedValue({
      id: "order_existing",
      userId: "guest_1",
      paymentReference: "ref_existing",
      paystackAccessCode: "acc_existing",
      idempotencyKey: "idem_g1",
      status: "UNPAID",
    });

    const response = await orderServer.request("/guest-checkout", {
      method: "POST",
      headers: { "x-idempotency-key": "idem_g1" },
      body: JSON.stringify({
        phone: "+2348123456789",
        vendorId: "vendor_1",
        items: [{ productId: "p1", quantity: 1 }],
        deliveryAddress: "1 Guest Road",
      }),
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: true,
        message: "Existing order returned for idempotent request",
        orderId: "order_existing",
        reference: "ref_existing",
        paystackAccessCode: "acc_existing",
        idempotencyKey: "idem_g1",
        status: "UNPAID",
      }),
    );
    expect(typeof response.body.guestOrderToken).toBe("string");
    expect(prisma.Order.create).not.toHaveBeenCalled();
    expect(initializePayment).not.toHaveBeenCalled();
  });

  it("returns 409 when an idempotency key is reused by a different guest phone", async () => {
    prisma.User.findUnique.mockResolvedValue({
      id: "guest_1",
      email: null,
      role: "GUEST",
    });
    prisma.Order.findUnique.mockResolvedValue({
      id: "order_existing",
      userId: "guest_other",
      paymentReference: "ref_existing",
      paystackAccessCode: null,
      idempotencyKey: "idem_shared",
      status: "UNPAID",
    });

    const response = await orderServer.request("/guest-checkout", {
      method: "POST",
      headers: { "x-idempotency-key": "idem_shared" },
      body: JSON.stringify({
        phone: "+2348123456789",
        vendorId: "vendor_1",
        items: [{ productId: "p1", quantity: 1 }],
        deliveryAddress: "1 Guest Road",
      }),
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      success: false,
      error: "Idempotency key already used by another user",
    });
    expect(prisma.Order.create).not.toHaveBeenCalled();
    expect(initializePayment).not.toHaveBeenCalled();
  });

  it("lets a guest track their own paid order with the limited-scope token", async () => {
    prisma.Order.findUnique.mockResolvedValue({
      id: "order_guest",
      userId: "guest_1",
      vendorId: "vendor_1",
      status: "PENDING",
      totalAmount: 4500,
      paymentReference: "SG-ORD-1",
      items: [],
      vendor: { id: "vendor_1", name: "Test Kitchen", phone: "+234", email: null },
      user: { id: "guest_1", name: null, phone: "+2348123456789", email: null },
    });

    const { generateGuestOrderToken } = await import("../utils/jwt.js");
    const token = generateGuestOrderToken("order_guest");

    const response = await orderServer.request("/order_guest/guest-status", {
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.order.id).toBe("order_guest");
  });

  it("rejects guest tracking without a token, with a foreign token, or with a session token", async () => {
    const { generateGuestOrderToken, generateAccessToken } = await import(
      "../utils/jwt.js"
    );

    // A token minted for another order must be refused before any DB lookup.
    const foreignToken = generateGuestOrderToken("order_other");
    const mismatched = await orderServer.request("/order_guest/guest-status", {
      headers: { authorization: `Bearer ${foreignToken}` },
    });
    expect(mismatched.status).toBe(403);
    expect(prisma.Order.findUnique).not.toHaveBeenCalled();

    // Regular access tokens carry no order scope and must not unlock tracking.
    const memberToken = generateAccessToken("user_1", "MEMBER");
    const sessionTokenAttempt = await orderServer.request(
      "/order_guest/guest-status",
      { headers: { authorization: `Bearer ${memberToken}` } },
    );
    expect(sessionTokenAttempt.status).toBe(403);

    const unauthenticated = await orderServer.request(
      "/order_guest/guest-status",
    );
    expect(unauthenticated.status).toBe(401);
  });

  it("returns 500 and does not persist an access code when guest payment initialization fails", async () => {
    prisma.User.findUnique.mockResolvedValue(null);
    prisma.User.create.mockResolvedValue({ id: "guest_2", email: null });
    prisma.Vendor.findUnique.mockResolvedValue({
      id: "vendor_1",
      paystackSubcode: "SUB_1",
    });
    prisma.Product.findUnique.mockResolvedValue({
      id: "p1",
      vendorId: "vendor_1",
      isAvailable: true,
      price: 2000,
    });
    prisma.Order.create.mockResolvedValue({ id: "order_guest_fail" });
    initializePayment.mockResolvedValue({
      success: false,
      error: "Paystack unreachable",
    });

    const response = await orderServer.request("/guest-checkout", {
      method: "POST",
      body: JSON.stringify({
        phone: "+2348123456789",
        vendorId: "vendor_1",
        items: [{ productId: "p1", quantity: 1 }],
        deliveryAddress: "1 Guest Road",
      }),
    });

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Payment initialization failed");
    expect(prisma.Order.update).not.toHaveBeenCalled();
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
