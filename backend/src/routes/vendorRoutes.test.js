let mockCurrentUser;

jest.mock("../middleware/auth", () => ({
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

jest.mock("../utils/paystack", () => ({
  createSubAccount: jest.fn(),
}));

jest.mock("../utils/password", () => ({
  hashPassword: jest.fn(() => Promise.resolve("hashed_password")),
}));

jest.mock("../utils/location", () => ({
  findNearbyVendors: jest.fn(),
  getLGAFromCoordinates: jest.fn(() => "IKEJA"),
  isValidCoordinates: jest.fn(() => true),
}));

const { startTestServer } = require("../test/startTestServer");
const { createSubAccount } = require("../utils/paystack");
const { hashPassword } = require("../utils/password");
const {
  findNearbyVendors,
  getLGAFromCoordinates,
  isValidCoordinates,
} = require("../utils/location");
const vendorRouter = require("./vendorRoutes");

describe("vendorRoutes", () => {
  let server;
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
      },
    };
    global.prisma = prisma;
    jest.clearAllMocks();
    server = await startTestServer(vendorRouter);
  });

  afterEach(async () => {
    await server.close();
  });

  afterAll(() => {
    delete global.prisma;
  });

  it("requires coordinates for nearby vendor search", async () => {
    const response = await server.request("/nearby", {
      method: "GET",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: "Latitude and longitude required",
    });
  });

  it("returns filtered nearby vendors", async () => {
    prisma.Vendor.findMany.mockResolvedValue([{ id: "vendor_1" }]);
    findNearbyVendors.mockReturnValue([
      {
        id: "vendor_1",
        name: "Food Place",
        description: "Tasty food",
        phone: "+2348000000000",
        email: "food@example.com",
        latitude: 6.5,
        longitude: 3.3,
        lga: "IKEJA",
        address: "1 Food Street",
        serviceRadius: 5,
        isVerified: true,
        isActive: true,
        averageRating: 4.7,
        totalReviews: 30,
        logo: "logo.png",
        bannerImage: "banner.png",
        distance: 3.1415,
        metrics: {
          avgPreparationTime: 18,
        },
      },
    ]);

    const response = await server.request("/nearby?lat=6.5&lng=3.3&radius=4", {
      method: "GET",
    });

    expect(response.status).toBe(200);
    expect(isValidCoordinates).toHaveBeenCalledWith(6.5, 3.3);
    expect(findNearbyVendors).toHaveBeenCalledWith(
      [{ id: "vendor_1" }],
      6.5,
      3.3,
      4,
    );
    expect(response.body).toEqual({
      success: true,
      radius: 4,
      count: 1,
      vendors: [
        {
          id: "vendor_1",
          name: "Food Place",
          description: "Tasty food",
          phone: "+2348000000000",
          email: "food@example.com",
          latitude: 6.5,
          longitude: 3.3,
          lga: "IKEJA",
          address: "1 Food Street",
          serviceRadius: 5,
          isVerified: true,
          isActive: true,
          averageRating: 4.7,
          totalReviews: 30,
          logo: "logo.png",
          bannerImage: "banner.png",
          metrics: {
            avgPreparationTime: 18,
          },
          distanceKm: 3.14,
          estimatedDeliveryMinutes: 38,
        },
      ],
    });
  });

  it("returns vendor profile with catalog summary", async () => {
    prisma.Vendor.findUnique.mockResolvedValue({
      id: "vendor_1",
      products: [
        { id: "p1", isAvailable: true, stockQuantity: 4 },
        { id: "p2", isAvailable: false, stockQuantity: 0 },
      ],
      metrics: { meritScore: 80 },
    });

    const response = await server.request("/me", {
      method: "GET",
    });

    expect(response.status).toBe(200);
    expect(response.body.vendor.catalog).toEqual({
      totalProducts: 2,
      availableProducts: 1,
      outOfStockProducts: 1,
    });
  });

  it("sets up vendor payment successfully", async () => {
    prisma.Vendor.findUnique.mockResolvedValue({
      id: "vendor_2",
      userId: "vendor_user_1",
      name: "Food Place",
      email: "food@example.com",
      phone: "+2348000000000",
    });
    createSubAccount.mockResolvedValue({
      success: true,
      data: { subaccount_code: "SUB_123" },
    });
    prisma.Vendor.update.mockResolvedValue({
      id: "vendor_2",
      paystackSubcode: "SUB_123",
    });

    const response = await server.request("/payment-setup", {
      method: "PATCH",
      body: JSON.stringify({
        bankAccount: "1234567890",
        bankCode: "058",
      }),
    });

    expect(response.status).toBe(200);
    expect(createSubAccount).toHaveBeenCalled();
    expect(response.body.success).toBe(true);
  });

  it("returns a public vendor profile with grouped categories", async () => {
    prisma.Vendor.findUnique.mockResolvedValue({
      id: "vendor_10",
      name: "Vendor Ten",
      isActive: true,
      isVerified: true,
      products: [
        { id: "p1", name: "Jollof", category: "Rice", isAvailable: true },
        { id: "p2", name: "Coke", category: "Drinks", isAvailable: true },
      ],
      metrics: { meritScore: 88 },
    });

    const response = await server.request("/vendor_10", {
      method: "GET",
    });

    expect(response.status).toBe(200);
    expect(response.body.vendor.categories).toHaveLength(2);
  });

  it("returns vendor dashboard stats", async () => {
    prisma.Vendor.findUnique.mockResolvedValue({
      id: "vendor_20",
      name: "Vendor Twenty",
      isVerified: true,
      isActive: true,
      lga: "IKEJA",
      paystackSubcode: "SUB_123",
      metrics: { meritScore: 75 },
      products: [
        { id: "p1", isAvailable: true, stockQuantity: 3 },
        { id: "p2", isAvailable: false, stockQuantity: 0 },
      ],
    });
    prisma.Order.findMany
      .mockResolvedValueOnce([
        { id: "recent_1", status: "PENDING", totalAmount: 4000 },
      ])
      .mockResolvedValueOnce([
        { id: "o1", status: "PENDING", totalAmount: 4000, refundAmount: null },
        { id: "o2", status: "COMPLETED", totalAmount: 3500, refundAmount: null },
        { id: "o3", status: "REFUNDED", totalAmount: 2000, refundAmount: 2000 },
      ]);

    const response = await server.request("/dashboard/stats", {
      method: "GET",
    });

    expect(response.status).toBe(200);
    expect(response.body.orders).toEqual({
      totalOrders: 3,
      pendingOrders: 1,
      activeOrders: 0,
      completedOrders: 1,
      refundedOrders: 1,
      cancelledOrders: 0,
    });
    expect(response.body.earnings).toEqual({
      pendingRevenue: 4000,
      completedRevenue: 3500,
      refundedAmount: 2000,
      totalRevenue: 7500,
    });
  });

  it("rejects duplicate vendor registration", async () => {
    prisma.Vendor.findFirst.mockResolvedValue({ id: "existing_vendor" });

    const response = await server.request("/register", {
      method: "POST",
      body: JSON.stringify({
        name: "Dup Vendor",
        phone: "+2348000000000",
        latitude: 6.5,
        longitude: 3.3,
        email: "dup@example.com",
        password: "securePass123",
      }),
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Vendor with this phone or email already exists",
    });
    expect(hashPassword).not.toHaveBeenCalled();
  });

  it("registers a vendor with derived LGA", async () => {
    prisma.Vendor.findFirst.mockResolvedValue(null);
    prisma.User.findUnique.mockResolvedValue(null);
    prisma.User.create.mockResolvedValue({ id: "user_1" });
    prisma.Vendor.create.mockResolvedValue({
      id: "vendor_30",
      lga: "IKEJA",
    });

    const response = await server.request("/register", {
      method: "POST",
      body: JSON.stringify({
        name: "Fresh Meals",
        phone: "+2348011111111",
        latitude: 6.5,
        longitude: 3.3,
        email: "fresh@example.com",
        password: "securePass123",
      }),
    });

    expect(response.status).toBe(200);
    expect(getLGAFromCoordinates).toHaveBeenCalledWith(6.5, 3.3);
    expect(response.body.success).toBe(true);
  });
});
