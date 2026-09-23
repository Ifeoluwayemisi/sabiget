// Vendor Routes - Find vendors, get menus, vendor management
import express from "express";
import {
  authenticateToken,
  authorize,
  optionalAuth,
} from "../middleware/auth.js";
import { createSubAccount, resolveAccountNumber } from "../utils/paystack.js";
import { hashPassword } from "../utils/password.js";
import { vendorRegistrationLimiter } from "../middleware/rateLimiter.js";
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
 * Discover active, verified vendors.
 *
 * Two modes:
 * - Geolocation mode: `lat` + `lng` + `radius` (optional, default 5km).
 *   Uses the existing Haversine/radius discovery path around the customer's
 *   real coordinates.
 * - Manual-area mode: `area` (optional string). Matches the vendor's own
 *   declared LGA or free-text address (case-insensitive contains) with NO
 *   geospatial anchor, so a typed area such as Ikeja, Abuja, Ibadan or Port
 *   Harcourt is genuinely what drives the query. The discoverability rules
 *   (isActive + isVerified) are enforced in both modes.
 */
router.get("/nearby", optionalAuth, async (req, res) => {
  try {
    const { lat, lng, radius, area } = req.query;

    const hasArea = typeof area === "string" && area.trim() !== "";

    if (hasArea) {
      const trimmedArea = area.trim();

      const areaVendors = await global.prisma.Vendor.findMany({
        where: {
          isActive: true,
          isVerified: true,
          OR: [
            { lga: { contains: trimmedArea, mode: "insensitive" } },
            { address: { contains: trimmedArea, mode: "insensitive" } },
          ],
        },
        orderBy: { name: "asc" },
        include: {
          metrics: true,
        },
      });

      // Area mode has no user anchor point, so distance and delivery ETA
      // cannot be honestly derived. They are left null rather than invented
      // around a fixed/assumed coordinate.
      const mappedVendors = areaVendors.map((vendor) => ({
        ...buildVendorPublicProfile(vendor),
        distanceKm: null,
        estimatedDeliveryMinutes: null,
      }));

      return res.json({
        success: true,
        area: trimmedArea,
        count: mappedVendors.length,
        vendors: mappedVendors,
      });
    }

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
 * POST /api/vendors/payment-account/verify
 * Resolve a Nigerian bank account and return the registered account name.
 * This endpoint ONLY verifies the account — it never creates a Paystack
 * subaccount and never modifies vendor payment/setup state. Provider failures
 * are normalized into a safe, human-readable message; no Paystack credentials
 * or raw provider payloads are exposed.
 */
router.post(
  "/payment-account/verify",
  authenticateToken,
  authorize("VENDOR"),
  async (req, res) => {
    try {
      const { bankAccount, bankCode } = req.body;

      if (!bankAccount || !bankCode) {
        return res.status(400).json({
          success: false,
          error: "Bank account and bank code are required",
        });
      }

      const resolution = await resolveAccountNumber(bankAccount, bankCode);

      if (!resolution.success) {
        return res.status(400).json({
          success: false,
          error:
            "We couldn't verify this account. Check the bank and account number and try again.",
        });
      }

      return res.json({
        success: true,
        accountName: resolution.data.accountName,
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },
);

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

      // One vendor = one Paystack subaccount. A vendor that already has a
      // subaccount must never silently receive another one, and an existing
      // valid subaccount must never be overwritten.
      if (vendor.paystackSubcode) {
        return res.status(409).json({
          success: false,
          error: "Vendor payment account is already configured",
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

      // Atomic claim: even if two setup requests pass the pre-check above
      // concurrently (the Paystack call necessarily happens outside the DB
      // transaction), only one may persist a subaccount. The loser's Paystack
      // subaccount becomes an orphan in Paystack, but the vendor row is never
      // written twice and never overwritten.
      const claimed = await global.prisma.Vendor.updateMany({
        where: { id: vendor.id, paystackSubcode: null },
        data: {
          bankAccount,
          bankCode,
          paystackSubcode: paystackResponse.data.subaccount_code,
        },
      });

      if (claimed.count === 0) {
        const existingVendor =
          (await global.prisma.Vendor.findUnique({ where: { id: vendor.id } })) ||
          vendor;
        return res.status(409).json({
          success: false,
          error: "Vendor payment account is already configured",
          vendor: existingVendor,
        });
      }

      const updatedVendor =
        (await global.prisma.Vendor.findUnique({ where: { id: vendor.id } })) ||
        vendor;

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
 * PATCH /api/vendors/profile
 * Update the authenticated vendor's store business info and/or location.
 * Business info: name, description, phone, email, address.
 * Location: latitude + longitude (only valid together), serviceRadius.
 * Identity always comes from the token — a body `vendorId` is never trusted.
 * The vendor only becomes discoverable once verified, active, given valid
 * coordinates within a customer's search radius, and (at checkout) paid.
 */
router.patch(
  "/profile",
  authenticateToken,
  authorize("VENDOR"),
  async (req, res) => {
    try {
      const {
        name,
        description,
        phone,
        email,
        address,
        latitude,
        longitude,
        serviceRadius,
      } = req.body;
      const userId = req.user.userId;

      const vendor = await global.prisma.Vendor.findUnique({ where: { userId } });
      if (!vendor) {
        return res.status(404).json({
          success: false,
          error: "Vendor profile not found",
        });
      }

      const data = {};

      if (name !== undefined) {
        const trimmedName = typeof name === "string" ? name.trim() : "";
        if (!trimmedName) {
          return res.status(400).json({
            success: false,
            error: "Business name cannot be empty",
          });
        }
        data.name = trimmedName;
      }

      if (description !== undefined) {
        data.description =
          typeof description === "string" ? description.trim() || null : null;
      }

      if (phone !== undefined) {
        const trimmedPhone = typeof phone === "string" ? phone.trim() : "";
        if (!/^(\+234|0)[789]\d{9}$/.test(trimmedPhone)) {
          return res.status(400).json({
            success: false,
            error: "Invalid Nigerian phone number",
            example: "+2348123456789",
          });
        }
        data.phone = trimmedPhone;
      }

      if (email !== undefined) {
        const trimmedEmail = typeof email === "string" ? email.trim() : "";
        if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
          return res.status(400).json({
            success: false,
            error: "Invalid email address",
          });
        }
        data.email = trimmedEmail || null;
      }

      if (address !== undefined) {
        data.address =
          typeof address === "string" ? address.trim() || null : null;
      }

      if (latitude !== undefined || longitude !== undefined) {
        if (latitude === undefined || longitude === undefined) {
          return res.status(400).json({
            success: false,
            error: "Latitude and longitude must be provided together",
          });
        }

        const parsedLatitude = parseFloat(latitude);
        const parsedLongitude = parseFloat(longitude);

        if (!isValidCoordinates(parsedLatitude, parsedLongitude)) {
          return res.status(400).json({
            success: false,
            error: "Valid coordinates (latitude and longitude) are required",
          });
        }

        data.latitude = parsedLatitude;
        data.longitude = parsedLongitude;
        data.lga = getLGAFromCoordinates(parsedLatitude, parsedLongitude);
      }

      if (serviceRadius !== undefined) {
        const parsedRadius = parseFloat(serviceRadius);
        if (
          Number.isNaN(parsedRadius) ||
          parsedRadius <= 0 ||
          parsedRadius > 50
        ) {
          return res.status(400).json({
            success: false,
            error: "Service radius must be greater than 0 and at most 50 km",
          });
        }
        data.serviceRadius = parsedRadius;
      }

      if (Object.keys(data).length === 0) {
        return res.status(400).json({
          success: false,
          error: "Nothing to update",
        });
      }

      if (data.phone || data.email) {
        const conflictWhere = [];
        if (data.phone) conflictWhere.push({ phone: data.phone });
        if (data.email) conflictWhere.push({ email: data.email });

        const conflict = await global.prisma.Vendor.findFirst({
          where: {
            NOT: { id: vendor.id },
            OR: conflictWhere,
          },
        });

        if (conflict) {
          return res.status(400).json({
            success: false,
            error: "Another vendor already uses this phone or email",
          });
        }
      }

      const updatedVendor = await global.prisma.Vendor.update({
        where: { id: vendor.id },
        data,
      });

      return res.json({
        success: true,
        message: "Store details updated",
        vendor: {
          id: updatedVendor.id,
          name: updatedVendor.name,
          description: updatedVendor.description,
          phone: updatedVendor.phone,
          email: updatedVendor.email,
          address: updatedVendor.address,
          latitude: updatedVendor.latitude,
          longitude: updatedVendor.longitude,
          lga: updatedVendor.lga,
          serviceRadius: updatedVendor.serviceRadius,
          isVerified: updatedVendor.isVerified,
          isActive: updatedVendor.isActive,
        },
      });
    } catch (error) {
      if (error.code === "P2002") {
        return res.status(400).json({
          success: false,
          error: "Another vendor already uses this phone or email",
        });
      }
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

    // An unverified vendor is not live to customers, whether they arrive via
    // search (already filtered) or a direct/shared link to this id.
    if (!vendor || !vendor.isActive || !vendor.isVerified) {
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
        isVerified: true,
      },
    });

    // Same rule as discovery and the profile endpoint above: unverified =
    // not live, even for a direct link.
    if (!vendor || !vendor.isActive || !vendor.isVerified) {
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
router.post(
  "/register",
  vendorRegistrationLimiter,
  async (req, res) => {
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

    const existingUser = await global.prisma.User.findUnique({
      where: { phone },
    });

    // Never overwrite an established account: knowing a phone number must not
    // grant control of it. Only passwordless GUEST shadow accounts may be
    // elevated during onboarding.
    if (existingUser && existingUser.role !== "GUEST") {
      return res.status(409).json({
        success: false,
        error:
          "An account with this phone number already exists. Please sign in or contact support.",
      });
    }

    let user;
    if (existingUser) {
      user = await global.prisma.User.update({
        where: { id: existingUser.id },
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
