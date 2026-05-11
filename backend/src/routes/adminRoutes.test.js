let mockCurrentUser;

jest.mock("../middleware/auth", () => ({
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

jest.mock("../services/orderService", () => ({
  triggerOrderRefund: jest.fn(),
}));

const { startTestServer } = require("../test/startTestServer");
const { triggerOrderRefund } = require("../services/orderService");
const adminRouter = require("./adminRoutes");

describe("adminRoutes", () => {
  let server;
  let prisma;

  beforeEach(async () => {
    mockCurrentUser = { userId: "admin_1", role: "ADMIN" };
    prisma = {
      Vendor: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      Order: {
        aggregate: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        groupBy: jest.fn(),
      },
      DisputeReport: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      AuditLog: {
        create: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
    };
    global.prisma = prisma;
    jest.clearAllMocks();
    server = await startTestServer(adminRouter);
  });

  afterEach(async () => {
    await server.close();
  });

  afterAll(() => {
    delete global.prisma;
  });

  it("returns real dashboard metrics for admins", async () => {
    prisma.Order.aggregate.mockResolvedValue({
      _sum: {
        totalAmount: 50000,
        platformFee: 3500,
      },
    });
    prisma.Vendor.count
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(9);
    prisma.Order.count
      .mockResolvedValueOnce(44)
      .mockResolvedValueOnce(6);
    prisma.DisputeReport.count.mockResolvedValue(3);

    const response = await server.request("/dashboard", {
      method: "GET",
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "Admin dashboard data fetched",
      metrics: {
        gmv: 50000,
        netRevenue: 3500,
        vendorCount: 12,
        activeVendorCount: 9,
        orderCount: 44,
        pendingOrderCount: 6,
        openDisputeCount: 3,
      },
    });
  });

  it("lists vendors with pagination and filters", async () => {
    prisma.Vendor.findMany.mockResolvedValue([
      {
        id: "vendor_1",
        name: "Vendor One",
        isActive: true,
      },
    ]);
    prisma.Vendor.count.mockResolvedValue(1);

    const response = await server.request(
      "/vendors?status=active&search=ven&page=2&limit=5",
      {
        method: "GET",
      },
    );

    expect(response.status).toBe(200);
    expect(prisma.Vendor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
        }),
        skip: 5,
        take: 5,
      }),
    );
    expect(response.body.pagination).toEqual({
      page: 2,
      limit: 5,
      total: 1,
      totalPages: 1,
    });
  });

  it("verifies a vendor and writes an audit log", async () => {
    prisma.Vendor.findUnique.mockResolvedValue({
      id: "vendor_1",
      isVerified: false,
      kybStatus: "PENDING",
      isActive: true,
    });
    prisma.Vendor.update.mockResolvedValue({
      id: "vendor_1",
      isVerified: true,
      kybStatus: "VERIFIED",
      isActive: true,
    });

    const response = await server.request("/vendors/vendor_1/verify", {
      method: "PATCH",
      body: JSON.stringify({ approved: true, reason: "KYB cleared" }),
    });

    expect(response.status).toBe(200);
    expect(prisma.AuditLog.create).toHaveBeenCalled();
    expect(response.body.success).toBe(true);
    expect(response.body.vendor.kybStatus).toBe("VERIFIED");
  });

  it("deactivates a vendor with a required reason", async () => {
    prisma.Vendor.findUnique.mockResolvedValue({
      id: "vendor_2",
      isActive: true,
    });
    prisma.Vendor.update.mockResolvedValue({
      id: "vendor_2",
      isActive: false,
    });

    const response = await server.request("/vendors/vendor_2/deactivate", {
      method: "PATCH",
      body: JSON.stringify({ reason: "Policy breach" }),
    });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Vendor deactivated");
    expect(prisma.AuditLog.create).toHaveBeenCalled();
  });

  it("lists orders for admin investigation", async () => {
    prisma.Order.findMany.mockResolvedValue([
      {
        id: "order_1",
        status: "PENDING",
      },
    ]);
    prisma.Order.count.mockResolvedValue(1);

    const response = await server.request("/orders?status=pending", {
      method: "GET",
    });

    expect(response.status).toBe(200);
    expect(response.body.orders).toHaveLength(1);
    expect(prisma.Order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "PENDING" },
      }),
    );
  });

  it("returns order details with audit trail", async () => {
    prisma.Order.findUnique.mockResolvedValue({
      id: "order_1",
      items: [],
      vendor: { id: "vendor_1" },
      user: { id: "user_1" },
      reviews: [],
      webhookLogs: [],
    });
    prisma.AuditLog.findMany.mockResolvedValue([
      { id: "audit_1", action: "ORDER_FORCE_REFUND" },
    ]);

    const response = await server.request("/orders/order_1", {
      method: "GET",
    });

    expect(response.status).toBe(200);
    expect(response.body.order.id).toBe("order_1");
    expect(response.body.auditLogs).toHaveLength(1);
  });

  it("force refunds an order idempotently and logs the action", async () => {
    prisma.Order.findUnique.mockResolvedValue({
      id: "order_1",
      status: "PENDING",
      forceRefundedByAdmin: false,
    });
    triggerOrderRefund.mockResolvedValue({
      success: true,
      alreadyRefunded: false,
    });
    prisma.Order.update.mockResolvedValue({
      id: "order_1",
      status: "REFUNDED",
      forceRefundedByAdmin: true,
    });

    const response = await server.request("/orders/order_1/force-refund", {
      method: "POST",
      body: JSON.stringify({ reason: "Manual override" }),
    });

    expect(response.status).toBe(200);
    expect(triggerOrderRefund).toHaveBeenCalledWith(
      expect.objectContaining({ id: "order_1" }),
      "Admin force refund: Manual override",
    );
    expect(response.body.message).toBe("Order force refunded");
  });

  it("lists disputes with pagination", async () => {
    prisma.DisputeReport.findMany.mockResolvedValue([
      { id: "dispute_1", status: "OPEN" },
    ]);
    prisma.DisputeReport.count.mockResolvedValue(1);

    const response = await server.request("/disputes?status=open", {
      method: "GET",
    });

    expect(response.status).toBe(200);
    expect(response.body.disputes).toHaveLength(1);
    expect(prisma.DisputeReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "OPEN" },
      }),
    );
  });

  it("resolves a dispute and optionally triggers refund", async () => {
    prisma.DisputeReport.findUnique.mockResolvedValue({
      id: "dispute_1",
      status: "OPEN",
      resolution: null,
      orderId: "order_1",
    });
    prisma.Order.findUnique.mockResolvedValue({
      id: "order_1",
      status: "DELIVERED",
    });
    triggerOrderRefund.mockResolvedValue({
      success: true,
      alreadyRefunded: false,
    });
    prisma.DisputeReport.update.mockResolvedValue({
      id: "dispute_1",
      status: "RESOLVED",
      resolution: "Refund approved",
    });
    prisma.Order.update.mockResolvedValue({
      id: "order_1",
      hasDispute: false,
    });

    const response = await server.request("/disputes/dispute_1/resolve", {
      method: "POST",
      body: JSON.stringify({
        resolution: "Refund approved",
        refund: true,
      }),
    });

    expect(response.status).toBe(200);
    expect(triggerOrderRefund).toHaveBeenCalled();
    expect(response.body.refundTriggered).toBe(true);
  });

  it("lists audit logs with filters", async () => {
    prisma.AuditLog.findMany.mockResolvedValue([
      { id: "audit_1", action: "VENDOR_DEACTIVATED" },
    ]);
    prisma.AuditLog.count.mockResolvedValue(1);

    const response = await server.request(
      "/audit-logs?action=VENDOR_DEACTIVATED&targetType=vendor",
      {
        method: "GET",
      },
    );

    expect(response.status).toBe(200);
    expect(response.body.logs).toHaveLength(1);
    expect(prisma.AuditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          action: "VENDOR_DEACTIVATED",
          targetType: "VENDOR",
        },
      }),
    );
  });

  it("returns analytics data for admins", async () => {
    prisma.Order.groupBy.mockResolvedValue([
      { status: "PENDING", _count: { status: 2 } },
    ]);
    prisma.Vendor.findMany.mockResolvedValue([
      { id: "vendor_1", metrics: { meritScore: 90 } },
    ]);
    prisma.Order.findMany.mockResolvedValueOnce([
      {
        id: "order_1",
        status: "PENDING",
        totalAmount: 4500,
        createdAt: "2026-05-10T00:00:00.000Z",
        vendorId: "vendor_1",
      },
    ]);

    const response = await server.request("/analytics", {
      method: "GET",
    });

    expect(response.status).toBe(200);
    expect(response.body.orderStatusBreakdown).toEqual([
      { status: "PENDING", count: 2 },
    ]);
    expect(response.body.topVendors).toHaveLength(1);
    expect(response.body.recentOrders).toHaveLength(1);
  });
});
