import { afterAll, afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

let mockCurrentUser;

const createSubAccount = jest.fn();
const hashPassword = jest.fn(() => Promise.resolve("hashed_password"));
const findNearbyVendors = jest.fn();
const getLGAFromCoordinates = jest.fn(() => "IKEJA");
const isValidCoordinates = jest.fn(() => true);
const triggerOrderRefund = jest.fn();

await jest.unstable_mockModule("../middleware/auth.js", () => ({
  authenticateToken: (req, res, next) => {
    req.user = mockCurrentUser;
    next();
  },
  optionalAuth: (req, res, next) => {
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

await jest.unstable_mockModule("../utils/paystack.js", () => ({
  createSubAccount,
}));

await jest.unstable_mockModule("../utils/password.js", () => ({
  hashPassword,
}));

await jest.unstable_mockModule("../utils/location.js", () => ({
  findNearbyVendors,
  getLGAFromCoordinates,
  isValidCoordinates,
}));

await jest.unstable_mockModule("../services/orderService.js", () => ({
  triggerOrderRefund,
}));

const { startTestServer } = await import("./startTestServer.js");
const vendorRouter = (await import("../routes/vendorRoutes.js")).default;
const adminRouter = (await import("../routes/adminRoutes.js")).default;

describe("vendor and admin endpoint verification", () => {
  let vendorServer;
  let adminServer;
  let prisma;

  beforeEach(async () => {
    mockCurrentUser = { userId: "vendor_user_1", role: "VENDOR" };
    prisma = {
      Vendor: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
      Product: {
        findMany: jest.fn(),
      },
      User: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      Order: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
        groupBy: jest.fn(),
      },
      DisputeReport: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      AuditLog: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };
    global.prisma = prisma;
    jest.clearAllMocks();
    vendorServer = await startTestServer(vendorRouter);
    adminServer = await startTestServer(adminRouter);
  });

  afterEach(async () => {
    await vendorServer.close();
    await adminServer.close();
  });

  afterAll(() => {
    delete global.prisma;
  });

  it("verifies vendor nearby, payment setup, register and dashboard", async () => {
    prisma.Vendor.findMany.mockResolvedValue([{ id: "vendor_1" }]);
    findNearbyVendors.mockReturnValue([{ id: "vendor_1", name: "Food", distance: 1.2, isVerified: true, isActive: true, metrics: { avgPreparationTime: 20 } }]);

    prisma.Vendor.findUnique.mockImplementation(async ({ where }) => {
      if (where.userId === "vendor_user_1") {
        return {
          id: "vendor_4",
          name: "Vendor Four",
          userId: "vendor_user_1",
          email: "food@example.com",
          phone: "+2348000000000",
          isVerified: true,
          isActive: true,
          lga: "IKEJA",
          paystackSubcode: "SUB_1",
          metrics: {},
          products: [{ id: "p1", isAvailable: true, stockQuantity: 1 }],
        };
      }

      if (where.id === "vendor_3") {
        return {
          id: "vendor_3",
          name: "Vendor Three",
          isActive: true,
          isVerified: true,
          products: [{ id: "p1", name: "Jollof", category: "Rice" }],
          metrics: {},
        };
      }

      return null;
    });
    prisma.Vendor.update.mockResolvedValue({ id: "vendor_2", paystackSubcode: "SUB_123" });
    prisma.Vendor.findFirst.mockResolvedValue(null);
    prisma.User.findUnique.mockResolvedValue(null);
    prisma.User.create.mockResolvedValue({ id: "user_1" });
    prisma.Vendor.create.mockResolvedValue({ id: "vendor_created", lga: "IKEJA" });
    prisma.Product.findMany.mockResolvedValue([{ id: "p1", name: "Jollof", category: "Rice" }]);
    prisma.Order.findMany.mockImplementation(async ({ take }) => {
      if (take === 10) {
        return [{ id: "recent_1", status: "PENDING", totalAmount: 4000 }];
      }

      return [{ id: "summary_1", status: "COMPLETED", totalAmount: 4000, refundAmount: null }];
    });
    createSubAccount.mockResolvedValue({ success: true, data: { subaccount_code: "SUB_123" } });

    const [
      nearbyResponse,
      meResponse,
      paymentSetupResponse,
      vendorProfileResponse,
      menuResponse,
      registerResponse,
      dashboardResponse,
    ] = await Promise.all([
      vendorServer.request("/nearby?lat=6.5&lng=3.3&radius=5", { method: "GET" }),
      vendorServer.request("/me", { method: "GET" }),
      vendorServer.request("/payment-setup", {
        method: "PATCH",
        body: JSON.stringify({ bankAccount: "1234567890", bankCode: "058" }),
      }),
      vendorServer.request("/vendor_3", { method: "GET" }),
      vendorServer.request("/vendor_3/menu", { method: "GET" }),
      vendorServer.request("/register", {
        method: "POST",
        body: JSON.stringify({
          name: "Fresh Meals",
          phone: "+2348011111111",
          latitude: 6.5,
          longitude: 3.3,
          email: "fresh@example.com",
          password: "securePass123",
        }),
      }),
      vendorServer.request("/dashboard/stats", { method: "GET" }),
    ]);

    expect(nearbyResponse.status).toBe(200);
    expect(meResponse.status).toBe(200);
    expect(paymentSetupResponse.status).toBe(200);
    expect(vendorProfileResponse.status).toBe(200);
    expect(menuResponse.status).toBe(200);
    expect(registerResponse.status).toBe(200);
    expect(dashboardResponse.status).toBe(200);
  });

  it("rejects vendor registration that would take over an existing non-guest account", async () => {
    prisma.Vendor.findFirst.mockResolvedValue(null);
    prisma.User.findUnique.mockResolvedValue({ id: "user_member", role: "MEMBER" });

    const response = await vendorServer.request("/register", {
      method: "POST",
      body: JSON.stringify({
        name: "Hijack Kitchen",
        phone: "+2348022222222",
        latitude: 6.5,
        longitude: 3.3,
        email: "hijack@example.com",
        password: "securePass123",
      }),
    });

    expect(response.status).toBe(409);
    expect(prisma.User.update).not.toHaveBeenCalled();
    expect(prisma.User.create).not.toHaveBeenCalled();
    expect(prisma.Vendor.create).not.toHaveBeenCalled();
  });

  it("elevates a passwordless GUEST shadow account during vendor onboarding", async () => {
    prisma.Vendor.findFirst.mockResolvedValue(null);
    prisma.User.findUnique.mockResolvedValue({ id: "user_guest", role: "GUEST" });
    prisma.User.update.mockResolvedValue({ id: "user_guest" });
    prisma.Vendor.create.mockResolvedValue({ id: "vendor_new", lga: "IKEJA" });

    const response = await vendorServer.request("/register", {
      method: "POST",
      body: JSON.stringify({
        name: "Guest Turned Vendor",
        phone: "+2348033333333",
        latitude: 6.5,
        longitude: 3.3,
        email: "guestvendor@example.com",
        password: "securePass123",
      }),
    });

    expect(response.status).toBe(200);
    expect(prisma.User.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user_guest" } }),
    );
    expect(prisma.User.create).not.toHaveBeenCalled();
  });

  it("verifies admin dashboard and moderation endpoints", async () => {
    mockCurrentUser = { userId: "admin_1", role: "ADMIN" };

    prisma.Order.aggregate.mockResolvedValue({ _sum: { totalAmount: 50000, platformFee: 3500 } });
    prisma.Vendor.count.mockResolvedValueOnce(12).mockResolvedValueOnce(9).mockResolvedValueOnce(1);
    prisma.Order.count.mockResolvedValueOnce(44).mockResolvedValueOnce(6).mockResolvedValueOnce(1);
    prisma.DisputeReport.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    prisma.Vendor.findMany.mockResolvedValue([{ id: "vendor_1", name: "Vendor One" }]);
    prisma.Vendor.findUnique.mockResolvedValueOnce({
      id: "vendor_1",
      isVerified: false,
      kybStatus: "PENDING",
      isActive: true,
    }).mockResolvedValueOnce({
      id: "vendor_2",
      isActive: true,
    });
    prisma.Vendor.update.mockResolvedValue({ id: "vendor_1", isVerified: true, kybStatus: "VERIFIED", isActive: true });
    prisma.Order.findMany.mockResolvedValue([{ id: "order_1", status: "PENDING" }]);
    prisma.Order.findUnique.mockResolvedValue({ id: "order_1", status: "PENDING", forceRefundedByAdmin: false, items: [], vendor: {}, user: {}, reviews: [], webhookLogs: [] });
    prisma.Order.update.mockResolvedValue({ id: "order_1", status: "REFUNDED", forceRefundedByAdmin: true });
    prisma.DisputeReport.findMany.mockResolvedValue([{ id: "dispute_1", status: "OPEN" }]);
    prisma.DisputeReport.findUnique.mockResolvedValue({ id: "dispute_1", status: "OPEN", resolution: null, orderId: "order_1" });
    prisma.DisputeReport.update.mockResolvedValue({ id: "dispute_1", status: "RESOLVED", resolution: "Resolved" });
    prisma.AuditLog.findMany.mockResolvedValue([{ id: "audit_1", action: "ORDER_FORCE_REFUND" }]);
    prisma.AuditLog.count.mockResolvedValue(1);
    prisma.Order.groupBy.mockResolvedValue([{ status: "PENDING", _count: { status: 2 } }]);
    triggerOrderRefund.mockResolvedValue({ success: true, alreadyRefunded: false });

    const responses = await Promise.all([
      adminServer.request("/dashboard", { method: "GET" }),
      adminServer.request("/vendors?status=active", { method: "GET" }),
      adminServer.request("/vendors/vendor_1/verify", {
        method: "PATCH",
        body: JSON.stringify({ approved: true, reason: "KYB cleared" }),
      }),
      adminServer.request("/vendors/vendor_2/deactivate", {
        method: "PATCH",
        body: JSON.stringify({ reason: "Policy breach" }),
      }),
      adminServer.request("/orders?status=pending", { method: "GET" }),
      adminServer.request("/orders/order_1", { method: "GET" }),
      adminServer.request("/orders/order_1/force-refund", {
        method: "POST",
        body: JSON.stringify({ reason: "Manual override" }),
      }),
      adminServer.request("/disputes?status=open", { method: "GET" }),
      adminServer.request("/disputes/dispute_1/resolve", {
        method: "POST",
        body: JSON.stringify({ resolution: "Resolved", refund: true }),
      }),
      adminServer.request("/audit-logs?action=ORDER_FORCE_REFUND&targetType=order", { method: "GET" }),
      adminServer.request("/analytics", { method: "GET" }),
    ]);

    responses.forEach((response) => expect(response.status).toBeLessThan(400));
  });
});
