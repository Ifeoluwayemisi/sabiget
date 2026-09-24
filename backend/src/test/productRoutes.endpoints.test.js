import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { S3Client } from "@aws-sdk/client-s3";
import { PRODUCT_IMAGE_MAX_BYTES } from "../services/mediaService.js";

// Restored from a pre-ESM-migration CommonJS test file (see
// vendorRoutes.endpoints.test.js for context). Assertions unchanged.

let mockCurrentUser;

await jest.unstable_mockModule("../middleware/auth.js", () => ({
  authenticateToken: (req, res, next) => {
    if (!mockCurrentUser) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
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

const originalEnv = { ...process.env };

const MEDIA_CONFIG = {
  MEDIA_BUCKET: "sabiget-media",
  MEDIA_REGION: "eu-west-1",
  MEDIA_ACCESS_KEY_ID: "test-access-key",
  MEDIA_SECRET_ACCESS_KEY: "test-secret-key",
  MEDIA_PUBLIC_BASE_URL: "https://cdn.example.com",
};

function setMediaConfig(partial = {}) {
  Object.entries({ ...MEDIA_CONFIG, ...partial }).forEach(
    ([key, value]) => (process.env[key] = value),
  );
}

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
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  afterAll(() => {
    delete global.prisma;
  });

  it("returns filtered products", async () => {
    prisma.Product.findMany.mockResolvedValue([{ id: "product_1" }]);

    const response = await server.request(
      "/?vendorId=vendor_1&category=Rice&search=jollof",
      {
        method: "GET",
      },
    );

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

  it("returns a presigned upload URL for an authenticated vendor", async () => {
    setMediaConfig();
    prisma.Vendor.findUnique.mockResolvedValue({ id: "vendor_1" });

    const response = await server.request("/image-upload", {
      method: "POST",
      body: JSON.stringify({ contentType: "image/jpeg", size: 1024 }),
    });

    expect(response.status).toBe(201);
    expect(response.body.upload.imageUrl).toMatch(
      /^https:\/\/cdn\.example\.com\/vendors\/vendor_1\/products\/.+\.jpg$/,
    );
    expect(response.body.upload.uploadUrl).toContain("X-Amz-Signature");
    expect(response.body.upload.expiresIn).toBe(600);
    expect(prisma.Vendor.findUnique).toHaveBeenCalledWith({
      where: { userId: "vendor_user_1" },
      select: { id: true },
    });
  });

  it("fails closed with 503 when media configuration is missing", async () => {
    prisma.Vendor.findUnique.mockResolvedValue({ id: "vendor_1" });

    const response = await server.request("/image-upload", {
      method: "POST",
      body: JSON.stringify({ contentType: "image/jpeg", size: 1024 }),
    });

    expect(response.status).toBe(503);
    expect(response.body.error).toMatch(/not configured/i);
  });

  it("denies image uploads to non-vendor roles", async () => {
    mockCurrentUser = { userId: "member_1", role: "MEMBER" };

    const response = await server.request("/image-upload", {
      method: "POST",
      body: JSON.stringify({ contentType: "image/jpeg", size: 1024 }),
    });

    expect(response.status).toBe(403);
    expect(prisma.Vendor.findUnique).not.toHaveBeenCalled();
  });

  it("denies image uploads when unauthenticated", async () => {
    mockCurrentUser = null;

    const response = await server.request("/image-upload", {
      method: "POST",
      body: JSON.stringify({ contentType: "image/jpeg", size: 1024 }),
    });

    expect(response.status).toBe(401);
    expect(prisma.Vendor.findUnique).not.toHaveBeenCalled();
  });

  it("rejects oversized product images before storage access", async () => {
    const response = await server.request("/image-upload", {
      method: "POST",
      body: JSON.stringify({
        contentType: "image/jpeg",
        size: PRODUCT_IMAGE_MAX_BYTES + 1,
      }),
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/5 MB/i);
    expect(prisma.Vendor.findUnique).not.toHaveBeenCalled();
  });

  it("deletes the previous managed object when a product image is replaced", async () => {
    setMediaConfig();
    prisma.Vendor.findUnique.mockResolvedValue({ id: "vendor_1" });
    prisma.Product.findUnique.mockResolvedValue({
      id: "product_9",
      vendorId: "vendor_1",
      imageUrl:
        "https://cdn.example.com/vendors/vendor_1/products/11111111-1111-4111-8111-111111111111.jpg",
    });
    prisma.Product.update.mockResolvedValue({
      id: "product_9",
      imageUrl:
        "https://cdn.example.com/vendors/vendor_1/products/22222222-2222-4222-8222-222222222222.jpg",
    });
    const send = jest
      .spyOn(S3Client.prototype, "send")
      .mockResolvedValue({});

    const response = await server.request("/product_9", {
      method: "PATCH",
      body: JSON.stringify({
        imageUrl:
          "https://cdn.example.com/vendors/vendor_1/products/22222222-2222-4222-8222-222222222222.jpg",
      }),
    });

    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
    const [command] = send.mock.calls[0];
    expect(command.input).toMatchObject({
      Bucket: "sabiget-media",
      Key: "vendors/vendor_1/products/11111111-1111-4111-8111-111111111111.jpg",
    });
  });

  it("deletes the managed object when a product image is removed", async () => {
    setMediaConfig();
    prisma.Vendor.findUnique.mockResolvedValue({ id: "vendor_1" });
    prisma.Product.findUnique.mockResolvedValue({
      id: "product_10",
      vendorId: "vendor_1",
      imageUrl:
        "https://cdn.example.com/vendors/vendor_1/products/33333333-3333-4333-8333-333333333333.jpg",
    });
    prisma.Product.update.mockResolvedValue({
      id: "product_10",
      imageUrl: null,
    });
    const send = jest
      .spyOn(S3Client.prototype, "send")
      .mockResolvedValue({});

    const response = await server.request("/product_10", {
      method: "PATCH",
      body: JSON.stringify({ imageUrl: null }),
    });

    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
    const [command] = send.mock.calls[0];
    expect(command.input).toMatchObject({
      Bucket: "sabiget-media",
      Key: "vendors/vendor_1/products/33333333-3333-4333-8333-333333333333.jpg",
    });
  });

  it("deletes the managed object when a product is deleted", async () => {
    setMediaConfig();
    prisma.Vendor.findUnique.mockResolvedValue({ id: "vendor_1" });
    prisma.Product.findUnique.mockResolvedValue({
      id: "product_11",
      vendorId: "vendor_1",
      imageUrl:
        "https://cdn.example.com/vendors/vendor_1/products/44444444-4444-4444-8444-444444444444.jpg",
    });
    prisma.Product.delete.mockResolvedValue({});
    const send = jest
      .spyOn(S3Client.prototype, "send")
      .mockResolvedValue({});

    const response = await server.request("/product_11", {
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
    const [command] = send.mock.calls[0];
    expect(command.input).toMatchObject({
      Bucket: "sabiget-media",
      Key: "vendors/vendor_1/products/44444444-4444-4444-8444-444444444444.jpg",
    });
  });

  it("never sends external HTTPS image URLs to S3 deletion", async () => {
    setMediaConfig();
    prisma.Vendor.findUnique.mockResolvedValue({ id: "vendor_1" });
    prisma.Product.findUnique.mockResolvedValue({
      id: "product_12",
      vendorId: "vendor_1",
      imageUrl: "https://example.com/images/food.jpg",
    });
    prisma.Product.update.mockResolvedValue({
      id: "product_12",
      imageUrl: null,
    });
    const send = jest
      .spyOn(S3Client.prototype, "send")
      .mockResolvedValue({});

    const response = await server.request("/product_12", {
      method: "PATCH",
      body: JSON.stringify({ imageUrl: null }),
    });

    expect(response.status).toBe(200);
    expect(send).not.toHaveBeenCalled();
  });

  it("cannot delete arbitrary managed-looking keys outside the owning vendor", async () => {
    setMediaConfig();
    prisma.Vendor.findUnique.mockResolvedValue({ id: "vendor_1" });
    prisma.Product.findUnique.mockResolvedValue({
      id: "product_13",
      vendorId: "vendor_1",
      imageUrl:
        "https://cdn.example.com/vendors/vendor_2/products/55555555-5555-4555-8555-555555555555.jpg",
    });
    prisma.Product.update.mockResolvedValue({
      id: "product_13",
      imageUrl: null,
    });
    const send = jest
      .spyOn(S3Client.prototype, "send")
      .mockResolvedValue({});

    const response = await server.request("/product_13", {
      method: "PATCH",
      body: JSON.stringify({ imageUrl: null }),
    });

    expect(response.status).toBe(200);
    expect(send).not.toHaveBeenCalled();
  });
});
