// Product Routes - Menu management
import express from "express";
import { authenticateToken, authorize } from "../middleware/auth.js";
import {
  createProductImageUpload,
  deleteManagedProductImage,
  validateProductImage,
} from "../services/mediaService.js";

const router = express.Router();

/**
 * Best-effort cleanup of a previously referenced managed product image.
 * Only objects proven to be SabiGet-managed and owned by `vendorId` are
 * deleted; storage failures or missing config never fail the product update.
 */
async function cleanupPreviousManagedImage({
  previousImageUrl,
  vendorId,
  productId,
  operation,
}) {
  if (!previousImageUrl) return;
  try {
    const result = await deleteManagedProductImage({
      imageUrl: previousImageUrl,
      vendorId,
    });
    if (!result.deleted && result.reason === "not-configured") {
      console.error(
        `[Products] Media cleanup skipped after ${operation} for product ${productId} (storage not configured)`,
      );
    }
  } catch (error) {
    console.error(
      `[Products] Media cleanup failed after ${operation} for product ${productId}:`,
      error.message,
    );
  }
}

/**
 * GET /api/products
 * Get all products (with optional filtering)
 * Query params: vendorId, category, search
 */
router.get("/", async (req, res) => {
  try {
    const { vendorId, category, search } = req.query;

    const where = {
      isAvailable: true,
      vendor: { isActive: true, isVerified: true },
    };
    if (vendorId) where.vendorId = vendorId;
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const products = await global.prisma.Product.findMany({
      where,
      include: { vendor: { select: { name: true, lga: true } } },
    });

    res.json({ success: true, products });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/products/:id
 * Get product details
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const product = await global.prisma.Product.findFirst({
      where: {
        id,
        isAvailable: true,
        vendor: { isActive: true, isVerified: true },
      },
      include: { vendor: { select: { name: true, id: true, lga: true } } },
    });

    if (!product)
      return res
        .status(404)
        .json({ success: false, error: "Product not found" });

    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/products/image-upload
 * Create a short-lived vendor-owned direct-upload URL. The API never accepts
 * image bytes or client-controlled storage keys.
 */
router.post(
  "/image-upload",
  authenticateToken,
  authorize("VENDOR"),
  async (req, res) => {
    try {
      const { contentType, size } = req.body || {};
      const validation = validateProductImage({ contentType, size });
      if (!validation.valid) {
        return res
          .status(400)
          .json({ success: false, error: validation.error });
      }

      const vendor = await global.prisma.Vendor.findUnique({
        where: { userId: req.user.userId },
        select: { id: true },
      });
      if (!vendor) {
        return res.status(403).json({
          success: false,
          error: "Vendor profile not found",
        });
      }

      const upload = await createProductImageUpload({
        vendorId: vendor.id,
        contentType,
      });
      return res.status(201).json({ success: true, upload });
    } catch (error) {
      if (error.code === "MEDIA_NOT_CONFIGURED") {
        return res.status(503).json({
          success: false,
          error: "Product image storage is not configured.",
        });
      }
      return res.status(500).json({
        success: false,
        error: "Unable to prepare product image upload.",
      });
    }
  },
);

function parseProductInput(input, { partial = false } = {}) {
  const data = {};
  const has = (key) => Object.prototype.hasOwnProperty.call(input, key);

  if (!partial || has("name")) {
    if (
      typeof input.name !== "string" ||
      !input.name.trim() ||
      input.name.trim().length > 120
    ) {
      return {
        error: "Product name is required and must be 120 characters or fewer.",
      };
    }
    data.name = input.name.trim();
  }

  if (!partial || has("price")) {
    const price = Number(input.price);
    if (!Number.isFinite(price) || price <= 0 || price > 100000000) {
      return { error: "Product price must be a valid positive amount." };
    }
    data.price = Number(price.toFixed(2));
  }

  for (const key of ["description", "category"]) {
    if (has(key)) {
      if (input[key] !== null && typeof input[key] !== "string") {
        return { error: `${key} must be text.` };
      }
      if (
        typeof input[key] === "string" &&
        input[key].length > (key === "description" ? 1000 : 80)
      ) {
        return { error: `${key} is too long.` };
      }
      data[key] = input[key]?.trim() || null;
    }
  }

  if (has("imageUrl")) {
    if (input.imageUrl !== null && typeof input.imageUrl !== "string") {
      return { error: "imageUrl must be a URL." };
    }
    if (input.imageUrl) {
      let imageUrl;
      try {
        imageUrl = new URL(input.imageUrl);
      } catch {
        return { error: "imageUrl must be a valid URL." };
      }
      if (imageUrl.protocol !== "https:") {
        return { error: "imageUrl must use HTTPS." };
      }
    }
    data.imageUrl = input.imageUrl || null;
  }

  if (has("preparationTime")) {
    const preparationTime = Number(input.preparationTime);
    if (
      !Number.isInteger(preparationTime) ||
      preparationTime < 1 ||
      preparationTime > 1440
    ) {
      return {
        error:
          "Preparation time must be a whole number between 1 and 1440 minutes.",
      };
    }
    data.preparationTime = preparationTime;
  }

  if (has("stockQuantity")) {
    if (input.stockQuantity === null || input.stockQuantity === "") {
      data.stockQuantity = null;
    } else {
      const stockQuantity = Number(input.stockQuantity);
      if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
        return { error: "Stock quantity must be a non-negative whole number." };
      }
      data.stockQuantity = stockQuantity;
    }
  }

  if (has("isAvailable")) {
    if (typeof input.isAvailable !== "boolean") {
      return { error: "isAvailable must be a boolean." };
    }
    data.isAvailable = input.isAvailable;
  }

  return { data };
}

/**
 * POST /api/products
 * Create new product (Vendor only)
 */
router.post("/", authenticateToken, authorize("VENDOR"), async (req, res) => {
  try {
    const {
      name,
      price,
      description,
      category,
      imageUrl,
      preparationTime,
      stockQuantity,
    } = req.body;
    const userId = req.user.userId;

    const parsed = parseProductInput(req.body);
    if (parsed.error) {
      return res.status(400).json({ success: false, error: parsed.error });
    }

    const vendor = await global.prisma.Vendor.findUnique({ where: { userId } });
    if (!vendor)
      return res
        .status(403)
        .json({ success: false, error: "Vendor profile not found" });

    const product = await global.prisma.Product.create({
      data: {
        vendorId: vendor.id,
        ...parsed.data,
        preparationTime: parsed.data.preparationTime ?? 15,
        stockQuantity:
          parsed.data.stockQuantity !== undefined
            ? parsed.data.stockQuantity
            : null,
      },
    });

    res
      .status(201)
      .json({ success: true, message: "Product created", product });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/products/:id
 * Update product (Vendor only)
 */
router.patch(
  "/:id",
  authenticateToken,
  authorize("VENDOR"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const {
        name,
        price,
        isAvailable,
        description,
        category,
        imageUrl,
        preparationTime,
        stockQuantity,
      } = req.body;
      const userId = req.user.userId;

      const vendor = await global.prisma.Vendor.findUnique({
        where: { userId },
      });
      if (!vendor)
        return res
          .status(403)
          .json({ success: false, error: "Vendor profile not found" });

      const existingProduct = await global.prisma.Product.findUnique({
        where: { id },
      });
      if (!existingProduct)
        return res
          .status(404)
          .json({ success: false, error: "Product not found" });

      if (existingProduct.vendorId !== vendor.id) {
        return res
          .status(403)
          .json({
            success: false,
            error: "Not authorized to update this product",
          });
      }

      const parsed = parseProductInput(req.body, { partial: true });
      if (parsed.error) {
        return res.status(400).json({ success: false, error: parsed.error });
      }
      const updateData = parsed.data;

      const previousImageUrl = existingProduct.imageUrl;
      const imageReferenceChanged =
        Object.prototype.hasOwnProperty.call(updateData, "imageUrl") &&
        updateData.imageUrl !== previousImageUrl;

      const product = await global.prisma.Product.update({
        where: { id },
        data: updateData,
      });

      // Clean up the previous object only after the new reference has been
      // persisted, and only when the reference actually changed (replaced or
      // explicitly removed).
      if (imageReferenceChanged) {
        await cleanupPreviousManagedImage({
          previousImageUrl,
          vendorId: vendor.id,
          productId: id,
          operation: "image-replaced-or-removed",
        });
      }

      res.json({ success: true, message: "Product updated", product });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

/**
 * DELETE /api/products/:id
 * Delete product (Vendor only)
 */
router.delete(
  "/:id",
  authenticateToken,
  authorize("VENDOR"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      const vendor = await global.prisma.Vendor.findUnique({
        where: { userId },
      });
      if (!vendor)
        return res
          .status(403)
          .json({ success: false, error: "Vendor profile not found" });

      const existingProduct = await global.prisma.Product.findUnique({
        where: { id },
      });
      if (!existingProduct)
        return res
          .status(404)
          .json({ success: false, error: "Product not found" });

      if (existingProduct.vendorId !== vendor.id) {
        return res
          .status(403)
          .json({
            success: false,
            error: "Not authorized to delete this product",
          });
      }

      const previousImageUrl = existingProduct.imageUrl;
      await global.prisma.Product.delete({ where: { id } });

      // Clean up the product's managed image object after deletion.
      await cleanupPreviousManagedImage({
        previousImageUrl,
        vendorId: vendor.id,
        productId: id,
        operation: "product-deleted",
      });

      res.json({ success: true, message: "Product deleted" });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

export default router;
