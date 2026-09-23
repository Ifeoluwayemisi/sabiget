import { afterAll, afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

// Restored from a pre-ESM-migration CommonJS test file (see
// vendorRoutes.endpoints.test.js for context). Assertions unchanged.
// Complements (does not duplicate) customer.endpoints.test.js, which covers
// a different set of customerRoutes.js scenarios (reviews, RBAC, etc).

let mockCurrentUser;

const createMemberAccountService = jest.fn();
const findNearbyVendors = jest.fn();
const isValidCoordinates = jest.fn(() => true);

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

await jest.unstable_mockModule("../services/memberAuthService.js", () => ({
  createMemberAccountService,
}));

await jest.unstable_mockModule("../utils/location.js", () => ({
  findNearbyVendors,
  isValidCoordinates,
}));

// customerRoutes.js also imports customerService.js, which itself imports
// calculateDistance from utils/location.js — mocking that module wholesale
// (matching customer.endpoints.test.js's approach) avoids re-implementing
// its math here and keeps this suite focused on the route layer.
await jest.unstable_mockModule("../services/customerService.js", () => ({
  redeemLoyaltyPoints: jest.fn(),
  getLoyaltyTier: (orderCount) => (orderCount >= 4 ? "LOYAL" : "STANDARD"),
  getPointsEarningRate: (orderCount) => (orderCount < 3 ? 0.05 : 0.02),
  getCustomerInsights: jest.fn(),
  getRecommendedVendors: jest.fn(),
}));

const { startTestServer } = await import("./startTestServer.js");
const customerRouter = (await import("../routes/customerRoutes.js")).default;

describe("customerRoutes (legacy suite)", () => {
  let server;
  let prisma;

  beforeEach(async () => {
    mockCurrentUser = { userId: "user_1", role: "MEMBER" };
    prisma = {
      Vendor: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      Order: {
        findUnique: jest.fn(),
      },
      User: {
        findUnique: jest.fn(),
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

  it("requires coordinates for nearby vendors", async () => {
    const response = await server.request("/nearby-vendors", {
      method: "GET",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      message: "Latitude and longitude required",
    });
  });

  it("returns nearby vendors using location filtering", async () => {
    prisma.Vendor.findMany.mockResolvedValue([
      {
        id: "vendor_1",
        name: "Food Place",
        description: "Tasty meals",
        logo: "logo.png",
        bannerImage: "banner.png",
        lga: "IKEJA",
        address: "1 Food Street",
        averageRating: 4.5,
        totalReviews: 12,
        serviceRadius: 5,
        metrics: {
          acceptanceRate: 90,
          avgPreparationTime: 20,
          meritScore: 80,
        },
      },
    ]);
    findNearbyVendors.mockReturnValue([
      {
        id: "vendor_1",
        name: "Food Place",
        description: "Tasty meals",
        logo: "logo.png",
        bannerImage: "banner.png",
        lga: "IKEJA",
        address: "1 Food Street",
        averageRating: 4.5,
        totalReviews: 12,
        serviceRadius: 5,
        distance: 2.345,
        metrics: {
          acceptanceRate: 90,
          avgPreparationTime: 20,
          meritScore: 80,
        },
      },
    ]);

    const response = await server.request(
      "/nearby-vendors?latitude=6.5&longitude=3.3&radius=5",
      {
        method: "GET",
      },
    );

    expect(response.status).toBe(200);
    expect(isValidCoordinates).toHaveBeenCalledWith(6.5, 3.3);
    expect(response.body.count).toBe(1);
    expect(response.body.vendors[0]).toEqual({
      id: "vendor_1",
      name: "Food Place",
      description: "Tasty meals",
      logo: "logo.png",
      bannerImage: "banner.png",
      lga: "IKEJA",
      address: "1 Food Street",
      averageRating: 4.5,
      totalReviews: 12,
      serviceRadius: 5,
      distanceKm: 2.35,
      estimatedDeliveryMinutes: 40,
      metrics: {
        acceptanceRate: 90,
        avgPreparationTime: 20,
        meritScore: 80,
      },
    });
  });

  it("returns grouped vendor menu data", async () => {
    prisma.Vendor.findUnique.mockResolvedValue({
      id: "vendor_2",
      name: "Vendor Two",
      description: "Menu vendor",
      logo: "logo.png",
      bannerImage: "banner.png",
      averageRating: 4.2,
      totalReviews: 8,
      lga: "YABA",
      isActive: true,
      isVerified: true,
      metrics: {
        avgPreparationTime: 18,
      },
      products: [
        {
          id: "product_1",
          name: "Jollof Rice",
          description: "Smoky",
          price: 2500,
          imageUrl: "jollof.png",
          preparationTime: 20,
          stockQuantity: null,
          tags: ["rice"],
          category: "Rice",
        },
        {
          id: "product_2",
          name: "Coke",
          description: "Cold",
          price: 500,
          imageUrl: "coke.png",
          preparationTime: 2,
          stockQuantity: 10,
          tags: ["drink"],
          category: "Drinks",
        },
      ],
    });

    const response = await server.request("/vendors/vendor_2/menu", {
      method: "GET",
    });

    expect(response.status).toBe(200);
    expect(response.body.vendor.name).toBe("Vendor Two");
    expect(response.body.vendor.categories).toHaveLength(2);
  });

  it("returns customer order tracking details", async () => {
    prisma.Order.findUnique.mockResolvedValue({
      id: "order_1",
      userId: "user_1",
      status: "OUT_FOR_DELIVERY",
      foodCost: 3000,
      serviceFee: 500,
      platformFee: 0,
      totalAmount: 3500,
      paymentReference: "pay_ref_1",
      deliveryAddress: "123 Street",
      deliveryLat: 6.5,
      deliveryLng: 3.3,
      createdAt: "2026-05-01T00:00:00.000Z",
      acceptedAt: null,
      preparedAt: null,
      deliveredAt: null,
      completedAt: null,
      cancelledAt: null,
      dvcEnteredAt: null,
      hasDispute: false,
      disputeReason: null,
      disputeResolvedAt: null,
      vendor: {
        id: "vendor_3",
        name: "Vendor Three",
        phone: "+2348000000000",
        averageRating: 4.6,
        logo: "logo.png",
        bannerImage: "banner.png",
      },
      items: [
        {
          id: "item_1",
          quantity: 1,
          pricePerUnit: 3000,
          totalPrice: 3000,
          specialRequests: "No onions",
          product: {
            id: "product_3",
            name: "Burger",
            imageUrl: "burger.png",
            preparationTime: 15,
          },
        },
      ],
      reviews: [],
    });

    const response = await server.request("/orders/order_1", {
      method: "GET",
    });

    expect(response.status).toBe(200);
    expect(response.body.order.id).toBe("order_1");
    expect(response.body.order.estimatedDeliveryMinutes).toBe(35);
    expect(response.body.order.items).toHaveLength(1);
  });

  it("returns real loyalty point data", async () => {
    prisma.User.findUnique.mockResolvedValue({
      loyaltyPoints: 200,
      pointsEarned: 500,
      pointsRedeemed: 300,
      orderCount: 4,
      role: "MEMBER",
    });

    const response = await server.request("/loyalty-points", {
      method: "GET",
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      points: 200,
      pointsEarned: 500,
      pointsRedeemed: 300,
      orderCount: 4,
      tier: "LOYAL",
      earningRate: 0.02,
      canRedeem: true,
    });
  });

  it("creates a customer account through the shared member account service", async () => {
    createMemberAccountService.mockResolvedValue({
      success: true,
      message: "Account created successfully",
      user: { id: "user_1", role: "MEMBER" },
      tokens: {
        accessToken: "access_token",
        refreshToken: "refresh_token",
      },
    });

    const response = await server.request("/create-account", {
      method: "POST",
      body: JSON.stringify({
        email: "user@example.com",
        password: "securePass123",
        name: "Ada",
      }),
    });

    expect(response.status).toBe(200);
    expect(createMemberAccountService).toHaveBeenCalledWith({
      userId: "user_1",
      password: "securePass123",
      name: "Ada",
      email: "user@example.com",
    });
    expect(response.body.success).toBe(true);
  });
});
