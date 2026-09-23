import { afterAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { getLGAFromCoordinates } from "../utils/location.js";

// Endpoint tests for store setup / vendor onboarding (MVP Item 3):
// PATCH /vendors/profile validates business info + location, always derives
// identity from the bearer token (never a body vendorId), and incomplete
// (location-less) or unverified vendors must never surface in discovery.

let mockCurrentUser;

const createSubAccount = jest.fn();
const resolveAccountNumber = jest.fn();

await jest.unstable_mockModule("../middleware/auth.js", () => ({
  authenticateToken: (req, res, next) => {
    if (mockCurrentUser === "UNAUTHENTICATED") {
      return res.status(401).json({ error: "Not authenticated" });
    }
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

const { startTestServer } = await import("./startTestServer.js");
const vendorRouter = (await import("../routes/vendorRoutes.js")).default;

describe("vendor store setup: business info + location + discoverability", () => {
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

  // A freshly registered vendor: coordinates unset (nullable), nothing faked.
  const vendorRecord = {
    id: "vendor_1",
    userId: "vendor_user_1",
    name: "Fresh Kitchen",
    description: null,
    phone: "+2348000000000",
    email: "fresh@example.com",
    address: null,
    latitude: null,
    longitude: null,
    lga: null,
    serviceRadius: 5,
    isVerified: false,
    isActive: true,
  };

  // ---- PATCH /vendors/profile ----------------------------------------------

  it("requires vendor authentication", async () => {
    mockCurrentUser = "UNAUTHENTICATED";
    const response = await server.request("/profile", {
      method: "PATCH",
      body: JSON.stringify({ name: "Renamed" }),
    });
    expect(response.status).toBe(401);
  });

  it("updates business name and description", async () => {
    prisma.Vendor.findUnique.mockResolvedValue(vendorRecord);
    prisma.Vendor.update.mockResolvedValue({
      ...vendorRecord,
      name: "Tasty Rolls",
      description: "Hot snacks on the go",
    });

    const response = await server.request("/profile", {
      method: "PATCH",
      body: JSON.stringify({
        name: "Tasty Rolls",
        description: "Hot snacks on the go",
      }),
    });

    expect(response.status).toBe(200);
    expect(prisma.Vendor.update).toHaveBeenCalledWith({
      where: { id: "vendor_1" },
      data: { name: "Tasty Rolls", description: "Hot snacks on the go" },
    });
    expect(response.body.vendor.name).toBe("Tasty Rolls");
  });

  it("rejects an empty business name", async () => {
    prisma.Vendor.findUnique.mockResolvedValue(vendorRecord);
    const response = await server.request("/profile", {
      method: "PATCH",
      body: JSON.stringify({ name: "   " }),
    });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Business name cannot be empty");
  });

  it("rejects an invalid Nigerian phone number", async () => {
    prisma.Vendor.findUnique.mockResolvedValue(vendorRecord);
    const response = await server.request("/profile", {
      method: "PATCH",
      body: JSON.stringify({ phone: "123456" }),
    });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid Nigerian phone number");
  });

  it("rejects an invalid email", async () => {
    prisma.Vendor.findUnique.mockResolvedValue(vendorRecord);
    const response = await server.request("/profile", {
      method: "PATCH",
      body: JSON.stringify({ email: "not-an-email" }),
    });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid email address");
  });

  it("requires latitude and longitude to be provided together", async () => {
    prisma.Vendor.findUnique.mockResolvedValue(vendorRecord);
    const response = await server.request("/profile", {
      method: "PATCH",
      body: JSON.stringify({ latitude: 6.45 }),
    });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "Latitude and longitude must be provided together",
    );
  });

  it("rejects out-of-range coordinates", async () => {
    prisma.Vendor.findUnique.mockResolvedValue(vendorRecord);
    const response = await server.request("/profile", {
      method: "PATCH",
      body: JSON.stringify({ latitude: 95, longitude: 3.42 }),
    });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "Valid coordinates (latitude and longitude) are required",
    );
  });

  // Location validation is deliberately country-agnostic: only universal
  // coordinate ranges are enforced. Vendors anywhere in the world must be able
  // to save a store location. LGA is a Nigeria-specific label that simply
  // resolves to "UNKNOWN" for other countries (server-derived, never trusted).
  const GLOBAL_REGIONS = [
    { name: "Lagos, Nigeria", latitude: 6.5244, longitude: 3.3792 },
    { name: "London, UK", latitude: 51.5074, longitude: -0.1278 },
    { name: "New York, USA", latitude: 40.7128, longitude: -74.006 },
    { name: "Tokyo, Japan", latitude: 35.6895, longitude: 139.6917 },
    { name: "Sydney, Australia", latitude: -33.8688, longitude: 151.2093 },
  ];

  it.each(GLOBAL_REGIONS)(
    "accepts coordinates from $name and never falls back",
    async ({ latitude, longitude }) => {
      prisma.Vendor.findUnique.mockResolvedValue(vendorRecord);
      const expectedLga = getLGAFromCoordinates(latitude, longitude);
      prisma.Vendor.update.mockResolvedValue({
        ...vendorRecord,
        latitude,
        longitude,
        lga: expectedLga,
      });

      const response = await server.request("/profile", {
        method: "PATCH",
        body: JSON.stringify({ latitude, longitude }),
      });

      expect(response.status).toBe(200);
      expect(prisma.Vendor.update).toHaveBeenCalledWith({
        where: { id: "vendor_1" },
        data: { latitude, longitude, lga: expectedLga },
      });
      expect(response.body.vendor.latitude).toBe(latitude);
      expect(response.body.vendor.longitude).toBe(longitude);
      expect(response.body.vendor.lga).toBe(expectedLga);
    },
  );

  it("saves location and computes the LGA server-side", async () => {
    prisma.Vendor.findUnique.mockResolvedValue(vendorRecord);
    const expectedLga = getLGAFromCoordinates(6.45, 3.42);
    prisma.Vendor.update.mockResolvedValue({
      ...vendorRecord,
      latitude: 6.45,
      longitude: 3.42,
      lga: expectedLga,
    });

    const response = await server.request("/profile", {
      method: "PATCH",
      body: JSON.stringify({ latitude: 6.45, longitude: 3.42 }),
    });

    expect(response.status).toBe(200);
    expect(prisma.Vendor.update).toHaveBeenCalledWith({
      where: { id: "vendor_1" },
      data: { latitude: 6.45, longitude: 3.42, lga: expectedLga },
    });
    expect(response.body.vendor.lga).toBe(expectedLga);
  });

  it("saves a service radius", async () => {
    prisma.Vendor.findUnique.mockResolvedValue(vendorRecord);
    prisma.Vendor.update.mockResolvedValue({ ...vendorRecord, serviceRadius: 8 });

    const response = await server.request("/profile", {
      method: "PATCH",
      body: JSON.stringify({ serviceRadius: 8 }),
    });

    expect(response.status).toBe(200);
    expect(prisma.Vendor.update).toHaveBeenCalledWith({
      where: { id: "vendor_1" },
      data: { serviceRadius: 8 },
    });
  });

  it("rejects an unreasonable service radius", async () => {
    prisma.Vendor.findUnique.mockResolvedValue(vendorRecord);
    const response = await server.request("/profile", {
      method: "PATCH",
      body: JSON.stringify({ serviceRadius: 500 }),
    });
    expect(response.status).toBe(400);
    expect(prisma.Vendor.update).not.toHaveBeenCalled();
  });

  it("always updates the token-owned vendor and ignores a body vendorId", async () => {
    prisma.Vendor.findUnique.mockResolvedValue(vendorRecord);
    prisma.Vendor.update.mockResolvedValue({ ...vendorRecord, name: "Owned Name" });

    const response = await server.request("/profile", {
      method: "PATCH",
      body: JSON.stringify({ vendorId: "someone_else", name: "Owned Name" }),
    });

    expect(response.status).toBe(200);
    expect(prisma.Vendor.update).toHaveBeenCalledWith({
      where: { id: "vendor_1" },
      data: { name: "Owned Name" },
    });
  });

  it("returns 404 when the authenticated user has no vendor profile", async () => {
    prisma.Vendor.findUnique.mockResolvedValue(null);
    const response = await server.request("/profile", {
      method: "PATCH",
      body: JSON.stringify({ name: "Ghost Kitchen" }),
    });
    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Vendor profile not found");
  });

  it("rejects a phone or email already used by another vendor", async () => {
    prisma.Vendor.findUnique.mockResolvedValue(vendorRecord);
    prisma.Vendor.findFirst.mockResolvedValue({ id: "vendor_other" });

    const response = await server.request("/profile", {
      method: "PATCH",
      body: JSON.stringify({ phone: "+2349012345678" }),
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "Another vendor already uses this phone or email",
    );
  });

  it("rejects updating when the duplicate-account check trips the conflict pre-check", async () => {
    prisma.Vendor.findUnique.mockResolvedValue(vendorRecord);
    prisma.Vendor.findFirst.mockResolvedValue(null);
    prisma.Vendor.update.mockResolvedValue(vendorRecord);

    const response = await server.request("/profile", {
      method: "PATCH",
      body: JSON.stringify({ email: "fresh@example.com" }),
    });

    expect(response.status).toBe(200);
    expect(prisma.Vendor.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          NOT: { id: "vendor_1" },
          OR: [{ email: "fresh@example.com" }],
        },
      }),
    );
  });

  it("rejects an empty update", async () => {
    prisma.Vendor.findUnique.mockResolvedValue(vendorRecord);
    const response = await server.request("/profile", {
      method: "PATCH",
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Nothing to update");
  });

  // ---- Discovery guard ------------------------------------------------------

  it("never surfaces an incomplete (location-less) vendor in discovery", async () => {
    prisma.Vendor.findMany.mockResolvedValue([
      {
        id: "no_location",
        name: "Incomplete Kitchen",
        latitude: null,
        longitude: null,
        lga: null,
        isActive: true,
        isVerified: true,
        metrics: null,
      },
      {
        id: "ready",
        name: "Ready Kitchen",
        latitude: 6.5,
        longitude: 3.35,
        lga: "UNKNOWN",
        isActive: true,
        isVerified: true,
        metrics: { avgPreparationTime: 15 },
      },
      {
        id: "too_far",
        name: "Far Kitchen",
        latitude: 9.0,
        longitude: 7.0,
        lga: "UNKNOWN",
        isActive: true,
        isVerified: true,
        metrics: null,
      },
    ]);

    const response = await server.request("/nearby?lat=6.5&lng=3.35&radius=5", {
      method: "GET",
    });

    expect(response.status).toBe(200);
    expect(response.body.vendors.map((vendor) => vendor.id)).toEqual(["ready"]);
  });

  it("routes discovery to active, verified vendors server-side only", async () => {
    prisma.Vendor.findMany.mockResolvedValue([]);
    await server.request("/nearby?lat=6.5&lng=3.35&radius=5", {
      method: "GET",
    });
    expect(prisma.Vendor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, isVerified: true },
      }),
    );
  });

  // ---- GET /:id and /:id/menu — a direct/shared link must not bypass the
  // same "unverified = not live" rule enforced by discovery above. ----------

  const verifiedActiveVendor = {
    id: "vendor_1",
    name: "Ready Kitchen",
    description: "Local favorite",
    phone: "+2348000000000",
    email: "ready@example.com",
    latitude: 6.5,
    longitude: 3.35,
    isActive: true,
    isVerified: true,
    metrics: { avgPreparationTime: 15 },
    products: [{ id: "p1", name: "Jollof", category: "Rice" }],
  };

  it("GET /:id returns an active, verified vendor's public profile", async () => {
    prisma.Vendor.findUnique.mockResolvedValue(verifiedActiveVendor);

    const response = await server.request("/vendor_1", { method: "GET" });

    expect(response.status).toBe(200);
    expect(response.body.vendor.id).toBe("vendor_1");
    expect(response.body.vendor.categories).toHaveLength(1);
  });

  it("GET /:id hides an active but unverified vendor", async () => {
    prisma.Vendor.findUnique.mockResolvedValue({
      ...verifiedActiveVendor,
      isVerified: false,
    });

    const response = await server.request("/vendor_1", { method: "GET" });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  it("GET /:id hides an inactive vendor even if verified", async () => {
    prisma.Vendor.findUnique.mockResolvedValue({
      ...verifiedActiveVendor,
      isActive: false,
    });

    const response = await server.request("/vendor_1", { method: "GET" });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  it("GET /:id/menu returns the menu for an active, verified vendor", async () => {
    prisma.Vendor.findUnique.mockResolvedValue({
      id: "vendor_1",
      name: "Ready Kitchen",
      isActive: true,
      isVerified: true,
    });
    prisma.Product.findMany.mockResolvedValue([
      { id: "p1", name: "Jollof", category: "Rice" },
    ]);

    const response = await server.request("/vendor_1/menu", { method: "GET" });

    expect(response.status).toBe(200);
    expect(response.body.menu).toHaveLength(1);
  });

  it("GET /:id/menu hides an active but unverified vendor's menu", async () => {
    prisma.Vendor.findUnique.mockResolvedValue({
      id: "vendor_1",
      name: "Ready Kitchen",
      isActive: true,
      isVerified: false,
    });

    const response = await server.request("/vendor_1/menu", { method: "GET" });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  it("GET /:id/menu hides an inactive vendor's menu even if verified", async () => {
    prisma.Vendor.findUnique.mockResolvedValue({
      id: "vendor_1",
      name: "Ready Kitchen",
      isActive: false,
      isVerified: true,
    });

    const response = await server.request("/vendor_1/menu", { method: "GET" });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });
});