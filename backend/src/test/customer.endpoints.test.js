import { afterAll, afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

let mockCurrentUser;

const createMemberAccountService = jest.fn();
const findNearbyVendors = jest.fn();
const isValidCoordinates = jest.fn(() => true);
const redeemLoyaltyPoints = jest.fn();
const getCustomerInsights = jest.fn();
const getRecommendedVendors = jest.fn();

await jest.unstable_mockModule("../middleware/auth.js", () => ({
  authenticateToken: (req, res, next) => {
    req.user = mockCurrentUser;
    next();
  },
  optionalAuth: (req, res, next) => {
    req.user = mockCurrentUser;
    next();
  },
  authorize: (...allowedRoles) => (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required roles: ${allowedRoles.join(", ")}`,
      });
    }
    next();
  },
}));

await jest.unstable_mockModule("../services/memberAuthService.js", () => ({
  createMemberAccountService,
}));

await jest.unstable_mockModule("../utils/location.js", () => ({
  findNearbyVendors,
  isValidCoordinates,
}));

await jest.unstable_mockModule("../services/customerService.js", () => ({
  redeemLoyaltyPoints,
  getLoyaltyTier: (orderCount) => (orderCount >= 4 ? "LOYAL" : "STANDARD"),
  getPointsEarningRate: (orderCount) => (orderCount < 3 ? 0.05 : 0.02),
  getCustomerInsights,
  getRecommendedVendors,
}));

const { startTestServer } = await import("./startTestServer.js");
const customerRouter = (await import("../routes/customerRoutes.js")).default;

describe("customer endpoint verification", () => {
  let server;
  let prisma;

  beforeEach(async () => {
    mockCurrentUser = { userId: "user_1", role: "MEMBER" };
    prisma = {
      Vendor: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      Order: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
      },
      User: {
        findUnique: jest.fn(),
      },
      Review: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };
    global.prisma = prisma;
    jest.clearAllMocks();
    server = await startTestServer(customerRouter);
  });

  afterEach(async () => {
    await server.close();
  });

  afterAll(() => {
    delete global.prisma;
  });

  it("returns nearby vendors", async () => {
    prisma.Vendor.findMany.mockResolvedValue([{ id: "vendor_1" }]);
    findNearbyVendors.mockReturnValue([
      {
        id: "vendor_1",
        name: "Food Place",
        distance: 1.234,
        serviceRadius: 5,
        averageRating: 4.5,
        totalReviews: 10,
        metrics: { acceptanceRate: 90, avgPreparationTime: 20, meritScore: 70 },
      },
    ]);

    const response = await server.request(
      "/nearby-vendors?latitude=6.5&longitude=3.3&radius=5",
      { method: "GET" },
    );

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(1);
  });

  it("returns vendor menu", async () => {
    prisma.Vendor.findUnique.mockResolvedValue({
      id: "vendor_1",
      name: "Food Place",
      isActive: true,
      metrics: { avgPreparationTime: 15 },
      products: [
        { id: "p1", name: "Jollof", category: "Rice", price: 2500, tags: [] },
      ],
    });

    const response = await server.request("/vendors/vendor_1/menu", { method: "GET" });

    expect(response.status).toBe(200);
    expect(response.body.vendor.categories).toHaveLength(1);
  });

  it("returns order detail", async () => {
    prisma.Order.findUnique.mockResolvedValue({
      id: "order_1",
      userId: "user_1",
      status: "OUT_FOR_DELIVERY",
      foodCost: 2000,
      serviceFee: 500,
      platformFee: 0,
      totalAmount: 2500,
      paymentReference: "ref_1",
      deliveryAddress: "Street",
      deliveryLat: 6.5,
      deliveryLng: 3.3,
      hasDispute: false,
      vendor: { id: "vendor_1", name: "Food Place" },
      items: [{ id: "item_1", quantity: 1, pricePerUnit: 2000, totalPrice: 2000, product: { id: "p1", name: "Jollof", imageUrl: "img", preparationTime: 15 } }],
      reviews: [],
    });

    const response = await server.request("/orders/order_1", { method: "GET" });

    expect(response.status).toBe(200);
    expect(response.body.order.id).toBe("order_1");
  });

  it("returns loyalty points", async () => {
    prisma.User.findUnique.mockResolvedValue({
      loyaltyPoints: 200,
      pointsEarned: 250,
      pointsRedeemed: 50,
      orderCount: 4,
      role: "MEMBER",
    });

    const response = await server.request("/loyalty-points", { method: "GET" });

    expect(response.status).toBe(200);
    expect(response.body.tier).toBe("LOYAL");
  });

  it("returns order history", async () => {
    prisma.Order.findMany.mockResolvedValue([
      {
        id: "order_1",
        status: "COMPLETED",
        totalAmount: 4000,
        createdAt: "2026-05-11T00:00:00.000Z",
        completedAt: "2026-05-11T00:10:00.000Z",
        vendor: { id: "vendor_1", name: "Food Place", logo: "logo" },
        items: [{ id: "item_1" }],
        reviews: [{ id: "review_1", rating: 5 }],
      },
    ]);
    prisma.Order.count.mockResolvedValue(1);

    const response = await server.request("/order-history?page=1&limit=10", { method: "GET" });

    expect(response.status).toBe(200);
    expect(response.body.orders).toHaveLength(1);
  });

  it("submits review for completed order", async () => {
    prisma.Order.findUnique.mockResolvedValue({
      id: "order_1",
      userId: "user_1",
      vendorId: "vendor_1",
      status: "COMPLETED",
      vendor: { id: "vendor_1" },
    });
    prisma.Review.findFirst.mockResolvedValue(null);
    prisma.Review.create.mockResolvedValue({
      id: "review_1",
      rating: 5,
      comment: "Great",
      createdAt: "2026-05-11T00:00:00.000Z",
    });
    prisma.Review.findMany.mockResolvedValue([{ rating: 5 }]);

    const response = await server.request("/orders/order_1/review", {
      method: "POST",
      body: JSON.stringify({ rating: 5, comment: "Great" }),
    });

    expect(response.status).toBe(201);
    expect(response.body.review.id).toBe("review_1");
  });

  it("lists vendor reviews", async () => {
    prisma.Vendor.findUnique.mockResolvedValue({
      id: "vendor_1",
      name: "Food Place",
      averageRating: 4.8,
      totalReviews: 2,
    });
    prisma.Review.findMany.mockResolvedValue([
      { id: "review_1", rating: 5, comment: "Great", user: { id: "user_1", name: "Ada" }, createdAt: "2026-05-11T00:00:00.000Z" },
    ]);
    prisma.Review.count.mockResolvedValue(1);

    const response = await server.request("/vendors/vendor_1/reviews?page=1&limit=10", {
      method: "GET",
    });

    expect(response.status).toBe(200);
    expect(response.body.reviews).toHaveLength(1);
  });

  it("returns customer insights and recommendations", async () => {
    getCustomerInsights.mockResolvedValue({
      success: true,
      insights: { totalOrders: 3, totalSpent: 12000 },
    });
    getRecommendedVendors.mockResolvedValue({
      success: true,
      recommendations: [{ id: "vendor_1", name: "Food Place" }],
    });

    const [insightsResponse, recommendationsResponse] = await Promise.all([
      server.request("/insights", { method: "GET" }),
      server.request("/recommendations?latitude=6.5&longitude=3.3&radius=5", { method: "GET" }),
    ]);

    expect(insightsResponse.status).toBe(200);
    expect(recommendationsResponse.status).toBe(200);
  });
});

describe("customer-only routes RBAC", () => {
  let server;
  let prisma;

  const protectedRequests = [
    ["GET", "/orders/order_1"],
    ["GET", "/loyalty-points"],
    ["GET", "/order-history"],
    ["POST", "/orders/order_1/review", { rating: 5 }],
    ["GET", "/orders/order_1/review"],
    ["POST", "/loyalty-points/redeem", { pointsToRedeem: 100 }],
    ["GET", "/insights"],
    ["GET", "/recommendations?latitude=6.5&longitude=3.3&radius=5"],
    ["POST", "/create-account", { email: "a@b.com" }],
  ];

  async function call(route, options = {}) {
    const [method, path, body] = route;
    return server.request(path, {
      method,
      ...(body ? { body: JSON.stringify(body) } : {}),
      ...options,
    });
  }

  beforeEach(async () => {
    prisma = {
      Vendor: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      Order: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
      },
      User: {
        findUnique: jest.fn(),
      },
      Review: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };
    global.prisma = prisma;
    jest.clearAllMocks();
    mockCurrentUser = { userId: "user_1", role: "MEMBER" };
    server = await startTestServer(customerRouter);
  });

  afterEach(async () => {
    await server.close();
  });

  afterAll(() => {
    delete global.prisma;
  });

  for (const [method, path, body] of protectedRequests) {
    it(`blocks VENDOR from customer-only ${method} ${path} with 403`, async () => {
      mockCurrentUser = { userId: "user_1", role: "VENDOR" };
      const response = await call([method, path, body]);
      expect(response.status).toBe(403);
    });
  }

  for (const [method, path, body] of protectedRequests) {
    it(`blocks ADMIN from customer-only ${method} ${path} with 403`, async () => {
      mockCurrentUser = { userId: "user_1", role: "ADMIN" };
      const response = await call([method, path, body]);
      expect(response.status).toBe(403);
    });
  }

  for (const [method, path, body] of protectedRequests) {
    it(`blocks SUPER_ADMIN from customer-only ${method} ${path} with 403`, async () => {
      mockCurrentUser = { userId: "user_1", role: "SUPER_ADMIN" };
      const response = await call([method, path, body]);
      expect(response.status).toBe(403);
    });
  }

  for (const [method, path, body] of protectedRequests) {
    it(`returns 401 for unauthenticated request to customer-only ${method} ${path}`, async () => {
      mockCurrentUser = null;
      const response = await call([method, path, body]);
      expect(response.status).toBe(401);
    });
  }

  it("allows GUEST on customer-only routes where appropriate", async () => {
    mockCurrentUser = { userId: "user_1", role: "GUEST" };
    prisma.User.findUnique.mockResolvedValue({
      loyaltyPoints: 100,
      pointsEarned: 100,
      pointsRedeemed: 0,
      orderCount: 1,
      role: "GUEST",
    });
    prisma.Order.findMany.mockResolvedValue([]);
    prisma.Order.count.mockResolvedValue(0);
    getCustomerInsights.mockResolvedValue({
      success: true,
      insights: { totalOrders: 0, totalSpent: 0 },
    });

    const [loyalty, history, insights] = await Promise.all([
      server.request("/loyalty-points", { method: "GET" }),
      server.request("/order-history", { method: "GET" }),
      server.request("/insights", { method: "GET" }),
    ]);

    expect(loyalty.status).toBe(200);
    expect(history.status).toBe(200);
    expect(insights.status).toBe(200);
  });

  it("allows MEMBER on customer-only routes", async () => {
    mockCurrentUser = { userId: "user_1", role: "MEMBER" };
    prisma.User.findUnique.mockResolvedValue({
      loyaltyPoints: 200,
      pointsEarned: 250,
      pointsRedeemed: 50,
      orderCount: 4,
      role: "MEMBER",
    });
    prisma.Order.findMany.mockResolvedValue([]);
    prisma.Order.count.mockResolvedValue(0);
    getCustomerInsights.mockResolvedValue({
      success: true,
      insights: { totalOrders: 3, totalSpent: 12000 },
    });

    const [loyalty, history, insights] = await Promise.all([
      server.request("/loyalty-points", { method: "GET" }),
      server.request("/order-history", { method: "GET" }),
      server.request("/insights", { method: "GET" }),
    ]);

    expect(loyalty.status).toBe(200);
    expect(history.status).toBe(200);
    expect(insights.status).toBe(200);
  });

  it("keeps public/non-customer routes reachable by any authenticated role", async () => {
    prisma.Vendor.findMany.mockResolvedValue([]);
    findNearbyVendors.mockReturnValue([]);
    prisma.Vendor.findUnique.mockResolvedValue({
      id: "vendor_1",
      name: "Food Place",
      isActive: true,
      metrics: { avgPreparationTime: 15 },
      products: [],
    });

    mockCurrentUser = { userId: "user_1", role: "VENDOR" };
    const nearby = await server.request(
      "/nearby-vendors?latitude=6.5&longitude=3.3&radius=5",
      { method: "GET" },
    );
    expect(nearby.status).toBe(200);

    const menu = await server.request("/vendors/vendor_1/menu", {
      method: "GET",
    });
    expect(menu.status).toBe(200);
  });
});
