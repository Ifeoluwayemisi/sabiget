// Product Routes - Menu management
const express = require("express");
const router = express.Router();
const { authenticateToken, authorize } = require("../middleware/auth");

/**
 * GET /api/products
 * Get all products (with optional filtering)
 * Query params: vendorId, category, search
 */
router.get("/", async (req, res) => {
  try {
    const { vendorId, category, search } = req.query;

    const where = { isAvailable: true };
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

    const product = await global.prisma.Product.findUnique({
      where: { id },
      include: { vendor: { select: { name: true, id: true, lga: true } } },
    });

    if (!product) return res.status(404).json({ success: false, error: "Product not found" });

    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/products
 * Create new product (Vendor only)
 */
router.post("/", authenticateToken, authorize("VENDOR"), async (req, res) => {
  try {
    const { name, price, description, category, imageUrl, preparationTime, stockQuantity } = req.body;
    const userId = req.user.userId;

    if (!name || !price) {
      return res.status(400).json({ success: false, error: "Name and price required" });
    }

    const vendor = await global.prisma.Vendor.findUnique({ where: { userId } });
    if (!vendor) return res.status(403).json({ success: false, error: "Vendor profile not found" });

    const product = await global.prisma.Product.create({
      data: {
        vendorId: vendor.id,
        name,
        price: parseFloat(price),
        description,
        category,
        imageUrl,
        preparationTime: preparationTime ? parseInt(preparationTime) : 15,
        stockQuantity: stockQuantity ? parseInt(stockQuantity) : null,
      },
    });

    res.status(201).json({ success: true, message: "Product created", product });
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
      const { name, price, isAvailable, description, category, imageUrl, preparationTime, stockQuantity } = req.body;
      const userId = req.user.userId;

      const vendor = await global.prisma.Vendor.findUnique({ where: { userId } });
      if (!vendor) return res.status(403).json({ success: false, error: "Vendor profile not found" });

      const existingProduct = await global.prisma.Product.findUnique({ where: { id } });
      if (!existingProduct) return res.status(404).json({ success: false, error: "Product not found" });
      
      if (existingProduct.vendorId !== vendor.id) {
        return res.status(403).json({ success: false, error: "Not authorized to update this product" });
      }

      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (price !== undefined) updateData.price = parseFloat(price);
      if (isAvailable !== undefined) updateData.isAvailable = Boolean(isAvailable);
      if (description !== undefined) updateData.description = description;
      if (category !== undefined) updateData.category = category;
      if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
      if (preparationTime !== undefined) updateData.preparationTime = parseInt(preparationTime);
      if (stockQuantity !== undefined) updateData.stockQuantity = parseInt(stockQuantity);

      const product = await global.prisma.Product.update({
        where: { id },
        data: updateData,
      });

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

      const vendor = await global.prisma.Vendor.findUnique({ where: { userId } });
      if (!vendor) return res.status(403).json({ success: false, error: "Vendor profile not found" });

      const existingProduct = await global.prisma.Product.findUnique({ where: { id } });
      if (!existingProduct) return res.status(404).json({ success: false, error: "Product not found" });
      
      if (existingProduct.vendorId !== vendor.id) {
        return res.status(403).json({ success: false, error: "Not authorized to delete this product" });
      }

      await global.prisma.Product.delete({ where: { id } });

      res.json({ success: true, message: "Product deleted" });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

module.exports = router;
