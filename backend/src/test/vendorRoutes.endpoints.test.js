import { afterAll, afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

// Restored from a pre-ESM-migration CommonJS test file (was excluded from
// the run entirely because `require`/`jest.mock` fail under native-ESM
// Jest). Converted to the same jest.unstable_mockModule + dynamic-import
// pattern used by storeSetup.endpoints.test.js; assertions are unchanged.

let mockCurrentUser;

const createSubAccount = jest.fn();
const resolveAccountNumber = jest.fn();
const hashPassword = jest.fn(() => Promise.resolve("hashed_password"));
const findNearbyVendors = jest.fn();
const getLGAFromCoordinates = jest.fn(() => "IKEJA");
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

await jest.unstable_mockModule("../utils/paystack.js", () => ({
  createSubAccount,
  resolveAccountNumber,
}));

await jest.unstable_mockModule("../utils/password.js", () => ({
  hashPassword,
}));

await jest.unstable_mockModule("../utils/location.js", () => ({
  findNearbyVendors,
  getLGAFromCoordinates,
  isValidCoordinates,
}));

const { startTestServer } = await import("./startTestServer.js");
const vendorRouter = (await import("../routes/vendorRoutes.js")).default;

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
        updateMany: jest.fn(),
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

  it("returns verified active vendors for a manual area match (area mode)", async () => {
    const ikejaVendor = {
      id: "vendor_ikeja",
      name: "Ikeja Kitchen",
      description: "Tasty food",
      phone: "+2348000000000",
      email: "ikeja@example.com",
      latitude: 6.6018,
      longitude: 3.3515,
      lga: "IKEJA",
      address: "1 Allen Avenue, Ikeja",
      serviceRadius: 5,
      isVerified: true,
      isActive: true,
      averageRating: 4.6,
      totalReviews: 40,
      logo: "logo.png",
      bannerImage: "banner.png",
      metrics: { avgPreparationTime: 20 },
    };
    prisma.Vendor.findMany.mockResolvedValue([ikejaVendor]);

    const response = await server.request("/nearby?area=Ikeja", {
      method: "GET",
    });

    expect(response.status).toBe(200);
    expect(prisma.Vendor.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        isVerified: true,
        OR: [
          { lga: { contains: "Ikeja", mode: "insensitive" } },
          { address: { contains: "Ikeja", mode: "insensitive" } },
        ],
      },
      orderBy: { name: "asc" },
      include: { metrics: true },
    });
    // Area mode must never use the coordinate/Haversine path.
    expect(findNearbyVendors).not.toHaveBeenCalled();
    expect(isValidCoordinates).not.toHaveBeenCalled();
    expect(response.body).toEqual({
      success: true,
      area: "Ikeja",
      count: 1,
      vendors: [
        {
          ...ikejaVendor,
          distanceKm: null,
          estimatedDeliveryMinutes: null,
        },
      ],
    });
  });

  it("area search for Abuja, Ibadan, Port Harcourt is not anchored to Lagos coordinates", async () => {
    // These vendors live in other cities; area mode must search around the
    // typed area's LGA/address, never a fixed Lagos coordinate.
    const cases = [
      ["Abuja", "ABUJA", "Wuse 2, Abuja", "vendor_abuja", 9.0765, 7.3986],
      ["Ibadan", "IBADAN", "Bodija, Ibadan", "vendor_ibadan", 7.3775, 3.947],
      [
        "Port Harcourt",
        "PORT HARCOURT",
        "GRA, Port Harcourt",
        "vendor_ph",
        4.8156,
        7.0498,
      ],
    ];

    for (const [area, lga, address, id, latitude, longitude] of cases) {
      prisma.Vendor.findMany.mockClear();
      prisma.Vendor.findMany.mockResolvedValue([
        {
          id,
          name: `${area} Foods`,
          lga,
          address,
          isVerified: true,
          isActive: true,
          latitude,
          longitude,
          serviceRadius: 10,
        },
      ]);

      const response = await server.request(`/nearby?area=${encodeURIComponent(area)}`, {
        method: "GET",
      });

      expect(response.status).toBe(200);
      expect(response.body.vendors).toHaveLength(1);
      expect(response.body.vendors[0].id).toBe(id);
      expect(response.body.vendors[0].distanceKm).toBeNull();
      expect(response.body.vendors[0].estimatedDeliveryMinutes).toBeNull();

      const callArgs = prisma.Vendor.findMany.mock.calls[0][0];
      expect(callArgs.where.OR).toEqual([
        { lga: { contains: area, mode: "insensitive" } },
        { address: { contains: area, mode: "insensitive" } },
      ]);
    }

    // The coordinate/radius path was never invoked for any area search.
    expect(isValidCoordinates).not.toHaveBeenCalled();
    expect(findNearbyVendors).not.toHaveBeenCalled();
  });

  it("area search excludes unverified and inactive vendors", async () => {
    prisma.Vendor.findMany.mockResolvedValue([]);

    await server.request("/nearby?area=Ikeja", { method: "GET" });

    const callArgs = prisma.Vendor.findMany.mock.calls[0][0];
    expect(callArgs.where.isActive).toBe(true);
    expect(callArgs.where.isVerified).toBe(true);
  });

  it("area search never matches vendor name alone", async () => {
    // A vendor whose NAME mentions the area but whose LGA/address do not
    // match must never be returned. The real DB enforces the where clause;
    // this asserts the query never contains a name-based OR clause.
    prisma.Vendor.findMany.mockResolvedValue([]);

    await server.request("/nearby?area=Ikeja", { method: "GET" });

    const callArgs = prisma.Vendor.findMany.mock.calls[0][0];
    expect(callArgs.where.OR).toEqual([
      { lga: { contains: "Ikeja", mode: "insensitive" } },
      { address: { contains: "Ikeja", mode: "insensitive" } },
    ]);
    expect(callArgs.where.OR.some((clause) => "name" in clause)).toBe(false);
  });

  it("treats empty or whitespace-only area as absent", async () => {
    prisma.Vendor.findMany.mockResolvedValue([]);

    const response = await server.request("/nearby?area=%20%20", {
      method: "GET",
    });

    // Whitespace-only area falls through to the coordinate-required path.
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: "Latitude and longitude required",
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
    // The subaccount write is an atomic updateMany claim (concurrency-safety
    // refactor: two concurrent setup requests must never both persist a
    // subaccount), followed by a re-read.
    prisma.Vendor.findUnique
      .mockResolvedValueOnce({
        id: "vendor_2",
        userId: "vendor_user_1",
        name: "Food Place",
        email: "food@example.com",
        phone: "+2348000000000",
        paystackSubcode: null,
      })
      .mockResolvedValueOnce({
        id: "vendor_2",
        paystackSubcode: "SUB_123",
      });
    createSubAccount.mockResolvedValue({
      success: true,
      data: { subaccount_code: "SUB_123" },
    });
    prisma.Vendor.updateMany.mockResolvedValue({ count: 1 });

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
