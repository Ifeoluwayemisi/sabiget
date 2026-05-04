// Vendor Routes - Find vendors, get menus, vendor management
const express = require("express");
const router = express.Router();
const {
  authenticateToken,
  authorize,
  optionalAuth,
} = require("../middleware/auth");
const { createSubAccount } = require("../utils/paystack");

/**
 * GET /api/vendors/nearby
 * Find vendors near user's location
 * Query params: lat, lng, radius (optional, default 5km)
 */
router.get("/nearby", optionalAuth, async (req, res) => {
  try {
    const { lat, lng, radius } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: "Latitude and longitude required" });
    }

    // TODO: Implement geospatial query with PostGIS
    res.json({
      message: "Nearby vendors fetched",
      lat,
      lng,
      radius: radius || 5,
      info: "Implementation pending",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/vendors/me
 * Get current vendor profile
 */
router.get("/me", authenticateToken, authorize("VENDOR"), async (req, res) => {
  try {
    const userId = req.user.userId;
    const vendor = await global.prisma.Vendor.findUnique({
      where: { userId },
      include: {
        products: true,
        metrics: true
      }
    });

    if (!vendor) {
      return res.status(404).json({ success: false, error: "Vendor profile not found" });
    }

    res.json({ success: true, vendor });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/vendors/payment-setup
 * Set up Paystack sub-account for vendor
 */
router.patch("/payment-setup", authenticateToken, authorize("VENDOR"), async (req, res) => {
  try {
    const { bankAccount, bankCode, contactName } = req.body;
    const userId = req.user.userId;

    if (!bankAccount || !bankCode) {
      return res.status(400).json({ success: false, error: "Bank account and bank code are required" });
    }

    const vendor = await global.prisma.Vendor.findUnique({ where: { userId } });
    if (!vendor) return res.status(404).json({ success: false, error: "Vendor not found" });

    // Call Paystack
    const paystackResponse = await createSubAccount({
      businessName: vendor.name,
      bankCode,
      accountNumber: bankAccount,
      email: vendor.email || "vendor@sabiget.com",
      contactName: contactName || vendor.name,
      phone: vendor.phone
    });

    if (!paystackResponse.success) {
      return res.status(400).json({ success: false, error: "Failed to create Paystack sub-account", details: paystackResponse.error });
    }

    // Update Vendor
    const updatedVendor = await global.prisma.Vendor.update({
      where: { id: vendor.id },
      data: {
        bankAccount,
        bankCode,
        paystackSubcode: paystackResponse.data.subaccount_code,
      }
    });

    res.json({
      success: true,
      message: "Payment setup successful",
      vendor: updatedVendor
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/vendors/:id
 * Get vendor details and menu
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // TODO: Fetch vendor and products from database
    res.json({
      message: "Vendor details fetched",
      vendorId: id,
      info: "Implementation pending",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/vendors/:id/menu
 * Get vendor's menu (products)
 */
router.get("/:id/menu", async (req, res) => {
  try {
    const { id } = req.params;

    // TODO: Fetch products for vendor
    res.json({
      message: "Vendor menu fetched",
      vendorId: id,
      info: "Implementation pending",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const { hashPassword } = require("../utils/password");

/**
 * POST /api/vendors/register
 * Register a new vendor
 */
router.post("/register", async (req, res) => {
  try {
    const { name, phone, latitude, longitude, email, password } = req.body;

    if (!name || !phone || latitude === undefined || longitude === undefined || !password) {
      return res.status(400).json({
        error: "Name, phone, latitude, longitude, and password required",
      });
    }

    const existingVendor = await global.prisma.Vendor.findFirst({
        where: { OR: [{ phone }, { email }] }
    });
    if (existingVendor) {
        return res.status(400).json({ error: "Vendor with this phone or email already exists" });
    }

    const hashedPassword = await hashPassword(password);

    let user = await global.prisma.User.findUnique({ where: { phone } });
    if (user) {
        user = await global.prisma.User.update({
            where: { id: user.id },
            data: { role: "VENDOR", password: hashedPassword, email, name }
        });
    } else {
        user = await global.prisma.User.create({
            data: { phone, email, password: hashedPassword, role: "VENDOR", name }
        });
    }

    const vendor = await global.prisma.Vendor.create({
        data: {
            name,
            phone,
            email,
            latitude,
            longitude,
            lga: "Pending", // TBD via Geocoding
            userId: user.id
        }
    });

    res.json({
      success: true,
      message: "Vendor registered",
      status: "PENDING_VERIFICATION",
      vendor,
    });
  } catch (error) {
    if (error.code === 'P2002') {
        return res.status(400).json({ error: "Unique constraint failed. Phone or email already in use." });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/vendors/dashboard
 * Vendor dashboard (orders, metrics, earnings)
 */
router.get(
  "/dashboard/stats",
  authenticateToken,
  authorize("VENDOR"),
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const vendor = await global.prisma.Vendor.findUnique({ where: { userId } });
      if (!vendor) return res.status(404).json({ error: "Vendor profile not found" });
      const vendorId = vendor.id;

      // TODO: Fetch vendor's dashboard data
      res.json({
        message: "Vendor dashboard fetched",
        vendorId,
        info: "Implementation pending",
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

module.exports = router;
