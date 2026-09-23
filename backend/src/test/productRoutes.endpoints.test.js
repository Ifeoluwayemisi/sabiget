import { afterAll, afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

// Restored from a pre-ESM-migration CommonJS test file (see
// vendorRoutes.endpoints.test.js for context). Assertions unchanged.

let mockCurrentUser;

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

const { startTestServer } = await import("./startTestServer.js");
const productRouter = (await import("../routes/productRoutes.js")).default;

describe("productRoutes", () => {
  let server;
  let prisma;

  beforeEach(async () => {
    mockCurrentUser = { userId: "vendor_user_1", role: "VENDOR" };
    prisma = {
      Product: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      Vendor: {
        findUnique: jest.fn(),
      },
    };
    global.prisma = prisma;
    jest.clearAllMocks();
    server = await startTestServer(productRouter);
  });

  afterEach(async () => {
    await server.close();
  });

  afterAll(() => {
    delete global.prisma;
  });

  it("returns filtered products", async () => {
    prisma.Product.findMany.mockResolvedValue([{ id: "product_1" }]);

    const response = await server.request("/?vendorId=vendor_1&category=Rice&search=jollof", {
      method: "GET",
    });

    expect(response.status).toBe(200);
    expect(prisma.Product.findMany).toHaveBeenCalledWith({
      where: {
        isAvailable: true,
        vendor: { isActive: true, isVerified: true },
        vendorId: "vendor_1",
        category: "Rice",
        OR: [
          { name: { contains: "jollof", mode: "insensitive" } },
          { description: { contains: "jollof", mode: "insensitive" } },
        ],
      },
      include: { vendor: { select: { name: true, lga: true } } },
    });
  });

  it("creates a product for a vendor", async () => {
    prisma.Vendor.findUnique.mockResolvedValue({ id: "vendor_1" });
    prisma.Product.create.mockResolvedValue({ id: "product_2" });

    const response = await server.request("/", {
      method: "POST",
      body: JSON.stringify({
        name: "Jollof Rice",
        price: "2500",
      }),
    });

    expect(response.status).toBe(201);
    expect(prisma.Product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        vendorId: "vendor_1",
        name: "Jollof Rice",
        price: 2500,
      }),
    });
  });

  it("rejects malformed product values at the backend boundary", async () => {
    prisma.Vendor.findUnique.mockResolvedValue({ id: "vendor_1" });

    const response = await server.request("/", {
      method: "POST",
      body: JSON.stringify({
        name: "Jollof Rice",
        price: "not-a-number",
        stockQuantity: -1,
      }),
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/price/i);
    expect(prisma.Product.create).not.toHaveBeenCalled();
  });

  it("does not expose unavailable products through direct product reads", async () => {
    prisma.Product.findFirst.mockResolvedValue(null);

    const response = await server.request("/product_hidden", {
      method: "GET",
    });

    expect(response.status).toBe(404);
    expect(prisma.Product.findFirst).toHaveBeenCalledWith({
      where: {
        id: "product_hidden",
        isAvailable: true,
        vendor: { isActive: true, isVerified: true },
      },
      include: { vendor: { select: { name: true, id: true, lga: true } } },
    });
  });

  it("rejects unsupported product image types before storage access", async () => {
    const response = await server.request("/image-upload", {
      method: "POST",
      body: JSON.stringify({ contentType: "application/pdf", size: 1024 }),
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/JPEG, PNG, or WebP/i);
    expect(prisma.Vendor.findUnique).not.toHaveBeenCalled();
  });

  it("blocks product updates from non-owning vendors", async () => {
    prisma.Vendor.findUnique.mockResolvedValue({ id: "vendor_1" });
    prisma.Product.findUnique.mockResolvedValue({
      id: "product_3",
      vendorId: "vendor_other",
    });

    const response = await server.request("/product_3", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated Name" }),
    });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      error: "Not authorized to update this product",
    });
  });

  it("deletes a product owned by the vendor", async () => {
    prisma.Vendor.findUnique.mockResolvedValue({ id: "vendor_1" });
    prisma.Product.findUnique.mockResolvedValue({
      id: "product_4",
      vendorId: "vendor_1",
    });
    prisma.Product.delete.mockResolvedValue({});

    const response = await server.request("/product_4", {
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    expect(prisma.Product.delete).toHaveBeenCalledWith({
      where: { id: "product_4" },
    });
  });
});
