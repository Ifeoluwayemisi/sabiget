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

const { startTestServer } = require("../test/startTestServer");
const productRouter = require("./productRoutes");

describe("productRoutes", () => {
  let server;
  let prisma;

  beforeEach(async () => {
    mockCurrentUser = { userId: "vendor_user_1", role: "VENDOR" };
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
