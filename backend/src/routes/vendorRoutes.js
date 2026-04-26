// Vendor Routes - Find vendors, get menus, vendor management
const express = require("express");
const router = express.Router();
const {
  authenticateToken,
  authorize,
  optionalAuth,
} = require("../middleware/auth");

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

/**
 * POST /api/vendors/register
 * Register a new vendor
 */
router.post("/register", async (req, res) => {
  try {
    const { name, phone, latitude, longitude, email } = req.body;

    if (!name || !phone || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        error: "Name, phone, latitude, and longitude required",
      });
    }

    // TODO: Create vendor account with pending KYB status
    res.json({
      message: "Vendor registered",
      status: "PENDING_VERIFICATION",
      info: "Implementation pending",
    });
  } catch (error) {
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
      const vendorId = req.user.userId;

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
