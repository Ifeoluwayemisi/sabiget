// Vendor Routes - Find vendors, get menus, vendor management
import express from "express";
import {
  authenticateToken,
  authorize,
  optionalAuth,
} from "../middleware/auth.js";
import { createSubAccount } from "../utils/paystack.js";
import { hashPassword } from "../utils/password.js";
import {
  findNearbyVendors,
  getLGAFromCoordinates,
  isValidCoordinates,
} from "../utils/location.js";

const router = express.Router();

function getVendorMenuCategories(products) {
  const categoryMap = new Map();

  for (const product of products) {
    const category = product.category || "Uncategorized";

    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }

    categoryMap.get(category).push(product);
  }

  return Array.from(categoryMap.entries()).map(([category, items]) => ({
    category,
    products: items,
  }));
}

function buildVendorPublicProfile(vendor) {
  return {
    id: vendor.id,
    name: vendor.name,
    description: vendor.description,
    phone: vendor.phone,
    email: vendor.email,
    latitude: vendor.latitude,
    longitude: vendor.longitude,
    lga: vendor.lga,
    address: vendor.address,
    serviceRadius: vendor.serviceRadius,
    isVerified: vendor.isVerified,
    isActive: vendor.isActive,
    averageRating: vendor.averageRating,
    totalReviews: vendor.totalReviews,
    logo: vendor.logo,
    bannerImage: vendor.bannerImage,
    metrics: vendor.metrics || null,
  };
}

/**
 * GET /api/vendors/nearby
 * Find vendors near user's location
 * Query params: lat, lng, radius (optional, default 5km)
 */
router.get("/nearby", optionalAuth, async (req, res) => {
  try {
    const { lat, lng, radius } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: "Latitude and longitude required",
      });
    }

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    const parsedRadius = radius ? parseFloat(radius) : 5;

    if (
      !isValidCoordinates(parsedLat, parsedLng) ||
      Number.isNaN(parsedRadius) ||
      parsedRadius <= 0
    ) {
      return res.status(400).json({
        success: false,
        error: "Valid coordinates and radius are required",
      });
    }

    const vendors = await global.prisma.Vendor.findMany({
      where: {
        isActive: true,
        isVerified: true,
      },
      include: {
        metrics: true,
      },
    });

    const nearbyVendors = findNearbyVendors(
      vendors,
      parsedLat,
      parsedLng,
      parsedRadius,
    ).map((vendor) => ({
      ...buildVendorPublicProfile(vendor),
      distanceKm: Number(vendor.distance.toFixed(2)),
      estimatedDeliveryMinutes:
        (vendor.metrics?.avgPreparationTime || 15) + 20,
    }));

    return res.json({
      success: true,
      radius: parsedRadius,
      count: nearbyVendors.length,
      vendors: nearbyVendors,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
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
        products: {
          orderBy: [{ category: "asc" }, { name: "asc" }],
        },
        metrics: true,
      },
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        error: "Vendor profile not found",
      });
    }

    return res.json({
      success: true,
      vendor: {
        ...vendor,
        catalog: {
          totalProducts: vendor.products.length,
          availableProducts: vendor.products.filter((p) => p.isAvailable).length,
          outOfStockProducts: vendor.products.filter(
            (p) => p.stockQuantity === 0,
          ).length,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/vendors/payment-setup
 * Set up Paystack sub-account for vendor
 */
router.patch(
  "/payment-setup",
  authenticateToken,
  authorize("VENDOR"),
  async (req, res) => {
    try {
      const { bankAccount, bankCode, contactName } = req.body;
      const userId = req.user.userId;

      if (!bankAccount || !bankCode) {
        return res.status(400).json({
          success: false,
          error: "Bank account and bank code are required",
        });
      }

      const vendor = await global.prisma.Vendor.findUnique({ where: { userId } });
      if (!vendor) {
        return res.status(404).json({
          success: false,
          error: "Vendor not found",
        });
      }

      const paystackResponse = await createSubAccount({
        businessName: vendor.name,
        bankCode,
        accountNumber: bankAccount,
        email: vendor.email || "vendor@sabiget.com",
        contactName: contactName || vendor.name,
        phone: vendor.phone,
      });

      if (!paystackResponse.success) {
        return res.status(400).json({
          success: false,
          error: "Failed to create Paystack sub-account",
          details: paystackResponse.error,
        });
      }

      const updatedVendor = await global.prisma.Vendor.update({
        where: { id: vendor.id },
        data: {
          bankAccount,
          bankCode,
          paystackSubcode: paystackResponse.data.subaccount_code,
        },
      });

      return res.json({
        success: true,
        message: "Payment setup successful",
        vendor: updatedVendor,
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },
);

/**
 * GET /api/vendors/:id
 * Get vendor details and menu
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const vendor = await global.prisma.Vendor.findUnique({
      where: { id },
      include: {
        products: {
          where: { isAvailable: true },
          orderBy: [{ category: "asc" }, { name: "asc" }],
        },
        metrics: true,
      },
    });

    if (!vendor || !vendor.isActive) {
      return res.status(404).json({
        success: false,
        error: "Vendor not found",
      });
    }

    return res.json({
      success: true,
      vendor: {
        ...buildVendorPublicProfile(vendor),
        categories: getVendorMenuCategories(vendor.products),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/vendors/:id/menu
 * Get vendor's menu (products)
 */
router.get("/:id/menu", async (req, res) => {
  try {
    const { id } = req.params;

    const vendor = await global.prisma.Vendor.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    });

    if (!vendor || !vendor.isActive) {
      return res.status(404).json({
        success: false,
        error: "Vendor not found",
      });
    }

    const products = await global.prisma.Product.findMany({
      where: { vendorId: id, isAvailable: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    return res.json({
      success: true,
      vendor: {
        id: vendor.id,
        name: vendor.name,
      },
      categories: getVendorMenuCategories(products),
      menu: products,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/vendors/register
 * Register a new vendor
 */
router.post("/register", async (req, res) => {
  try {
    const { name, phone, latitude, longitude, email, password } = req.body;

    if (
      !name ||
      !phone ||
      latitude === undefined ||
      longitude === undefined ||
      !password
    ) {
      return res.status(400).json({
        error: "Name, phone, latitude, longitude, and password required",
      });
    }

    const parsedLatitude = parseFloat(latitude);
    const parsedLongitude = parseFloat(longitude);

    if (!isValidCoordinates(parsedLatitude, parsedLongitude)) {
      return res.status(400).json({
        error: "Valid latitude and longitude are required",
      });
    }

    const existingVendor = await global.prisma.Vendor.findFirst({
      where: { OR: [{ phone }, { email }] },
    });
    if (existingVendor) {
      return res.status(400).json({
        error: "Vendor with this phone or email already exists",
      });
    }

    const hashedPassword = await hashPassword(password);

    let user = await global.prisma.User.findUnique({ where: { phone } });
    if (user) {
      user = await global.prisma.User.update({
        where: { id: user.id },
        data: { role: "VENDOR", password: hashedPassword, email, name },
      });
    } else {
      user = await global.prisma.User.create({
        data: { phone, email, password: hashedPassword, role: "VENDOR", name },
      });
    }

    const vendor = await global.prisma.Vendor.create({
      data: {
        name,
        phone,
        email,
        latitude: parsedLatitude,
        longitude: parsedLongitude,
        lga: getLGAFromCoordinates(parsedLatitude, parsedLongitude),
        userId: user.id,
      },
    });

    return res.json({
      success: true,
      message: "Vendor registered",
      status: "PENDING_VERIFICATION",
      vendor,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(400).json({
        error: "Unique constraint failed. Phone or email already in use.",
      });
    }
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/vendors/dashboard/stats
 * Vendor dashboard (orders, metrics, earnings)
 */
router.get(
  "/dashboard/stats",
  authenticateToken,
  authorize("VENDOR"),
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const vendor = await global.prisma.Vendor.findUnique({
        where: { userId },
        include: {
          metrics: true,
          products: true,
        },
      });

      if (!vendor) {
        return res.status(404).json({ error: "Vendor profile not found" });
      }

      const orders = await global.prisma.Order.findMany({
        where: { vendorId: vendor.id },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
          items: {
            select: {
              id: true,
              quantity: true,
              totalPrice: true,
            },
          },
        },
      });

      const allVendorOrders = await global.prisma.Order.findMany({
        where: { vendorId: vendor.id },
        select: {
          id: true,
          status: true,
          totalAmount: true,
          refundAmount: true,
          createdAt: true,
        },
      });

      const orderSummary = {
        totalOrders: allVendorOrders.length,
        pendingOrders: allVendorOrders.filter((o) => o.status === "PENDING").length,
        activeOrders: allVendorOrders.filter((o) =>
          ["ACCEPTED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"].includes(
            o.status,
          ),
        ).length,
        completedOrders: allVendorOrders.filter((o) => o.status === "COMPLETED")
          .length,
        refundedOrders: allVendorOrders.filter((o) => o.status === "REFUNDED")
          .length,
        cancelledOrders: allVendorOrders.filter((o) =>
          String(o.status).startsWith("CANCELLED_"),
        ).length,
      };

      const earnings = allVendorOrders.reduce(
        (accumulator, order) => {
          if (
            ["PENDING", "ACCEPTED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"].includes(
              order.status,
            )
          ) {
            accumulator.pendingRevenue += order.totalAmount || 0;
          }

          if (order.status === "COMPLETED") {
            accumulator.completedRevenue += order.totalAmount || 0;
          }

          if (order.status === "REFUNDED") {
            accumulator.refundedAmount +=
              order.refundAmount || order.totalAmount || 0;
          }

          return accumulator;
        },
        {
          pendingRevenue: 0,
          completedRevenue: 0,
          refundedAmount: 0,
        },
      );

      const catalog = {
        totalProducts: vendor.products.length,
        availableProducts: vendor.products.filter((product) => product.isAvailable)
          .length,
        unavailableProducts: vendor.products.filter(
          (product) => !product.isAvailable,
        ).length,
        outOfStockProducts: vendor.products.filter(
          (product) => product.stockQuantity === 0,
        ).length,
      };

      return res.json({
        success: true,
        message: "Vendor dashboard fetched",
        vendor: {
          id: vendor.id,
          name: vendor.name,
          isVerified: vendor.isVerified,
          isActive: vendor.isActive,
          lga: vendor.lga,
          paystackSubcodeConfigured: Boolean(vendor.paystackSubcode),
        },
        metrics: vendor.metrics || null,
        catalog,
        orders: orderSummary,
        earnings: {
          pendingRevenue: earnings.pendingRevenue,
          completedRevenue: earnings.completedRevenue,
          refundedAmount: earnings.refundedAmount,
          totalRevenue:
            earnings.pendingRevenue + earnings.completedRevenue,
        },
        recentOrders: orders,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },
);

export default router;
