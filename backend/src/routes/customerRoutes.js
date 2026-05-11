// ============================================
// Customer Routes
// ============================================

const express = require("express");
const router = express.Router();
const { authenticateToken, optionalAuth } = require("../middleware/auth");
const { createMemberAccountService } = require("../services/memberAuthService");
const {
  findNearbyVendors,
  isValidCoordinates,
} = require("../utils/location");

function getLoyaltyTier(orderCount) {
  if (orderCount >= 10) {
    return "PLATINUM";
  }

  if (orderCount >= 4) {
    return "LOYAL";
  }

  return "STANDARD";
}

function getPointEarningRate(orderCount) {
  return orderCount < 3 ? 0.05 : 0.02;
}

/**
 * GET /api/v1/customers/nearby-vendors
 * Find vendors nearby based on user location
 */
router.get("/nearby-vendors", authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude, radius = 5 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude required",
      });
    }

    const parsedLatitude = parseFloat(latitude);
    const parsedLongitude = parseFloat(longitude);
    const parsedRadius = parseFloat(radius);

    if (
      !isValidCoordinates(parsedLatitude, parsedLongitude) ||
      Number.isNaN(parsedRadius) ||
      parsedRadius <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid coordinates and radius are required",
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
      parsedLatitude,
      parsedLongitude,
      parsedRadius,
    )
      .sort((a, b) => {
        if (a.distance !== b.distance) {
          return a.distance - b.distance;
        }

        return (b.metrics?.acceptanceRate || 0) - (a.metrics?.acceptanceRate || 0);
      })
      .map((vendor) => ({
        id: vendor.id,
        name: vendor.name,
        description: vendor.description,
        logo: vendor.logo,
        bannerImage: vendor.bannerImage,
        lga: vendor.lga,
        address: vendor.address,
        averageRating: vendor.averageRating,
        totalReviews: vendor.totalReviews,
        serviceRadius: vendor.serviceRadius,
        distanceKm: Number(vendor.distance.toFixed(2)),
        estimatedDeliveryMinutes:
          (vendor.metrics?.avgPreparationTime || 15) + 20,
        metrics: vendor.metrics
          ? {
              acceptanceRate: vendor.metrics.acceptanceRate,
              avgPreparationTime: vendor.metrics.avgPreparationTime,
              meritScore: vendor.metrics.meritScore,
            }
          : null,
      }));

    return res.json({
      success: true,
      message: "Nearby vendors fetched",
      radiusKm: parsedRadius,
      count: nearbyVendors.length,
      vendors: nearbyVendors,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/v1/customers/vendors/:vendorId/menu
 * Get vendor's menu (products)
 */
router.get("/vendors/:vendorId/menu", optionalAuth, async (req, res) => {
  try {
    const { vendorId } = req.params;

    const vendor = await global.prisma.Vendor.findUnique({
      where: { id: vendorId },
      include: {
        metrics: true,
        products: {
          where: { isAvailable: true },
          orderBy: [{ category: "asc" }, { name: "asc" }],
        },
      },
    });

    if (!vendor || !vendor.isActive) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    const categoryMap = new Map();
    for (const product of vendor.products) {
      const categoryName = product.category || "Uncategorized";
      if (!categoryMap.has(categoryName)) {
        categoryMap.set(categoryName, []);
      }

      categoryMap.get(categoryName).push({
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        imageUrl: product.imageUrl,
        preparationTime: product.preparationTime,
        stockQuantity: product.stockQuantity,
        tags: product.tags,
      });
    }

    const categories = Array.from(categoryMap.entries()).map(
      ([category, products]) => ({
        category,
        products,
      }),
    );

    return res.json({
      success: true,
      message: "Menu fetched",
      vendor: {
        id: vendorId,
        name: vendor.name,
        description: vendor.description,
        logo: vendor.logo,
        bannerImage: vendor.bannerImage,
        averageRating: vendor.averageRating,
        totalReviews: vendor.totalReviews,
        lga: vendor.lga,
        estimatedDeliveryMinutes:
          (vendor.metrics?.avgPreparationTime || 15) + 20,
        categories,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/v1/customers/orders/:orderId
 * Get order details & real-time status
 */
router.get("/orders/:orderId", authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId;

    const order = await global.prisma.Order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        vendor: {
          select: {
            id: true,
            name: true,
            phone: true,
            averageRating: true,
            logo: true,
            bannerImage: true,
          },
        },
        reviews: {
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this order",
      });
    }

    const estimatedDeliveryMinutes =
      order.status === "COMPLETED" || order.status === "DELIVERED"
        ? 0
        : order.vendor
          ? 20 + order.items.reduce((max, item) => {
              return Math.max(max, item.product?.preparationTime || 15);
            }, 0)
          : 35;

    return res.json({
      success: true,
      message: "Order details fetched",
      order: {
        id: order.id,
        status: order.status,
        foodCost: order.foodCost,
        serviceFee: order.serviceFee,
        platformFee: order.platformFee,
        totalAmount: order.totalAmount,
        paymentReference: order.paymentReference,
        deliveryAddress: order.deliveryAddress,
        deliveryLat: order.deliveryLat,
        deliveryLng: order.deliveryLng,
        createdAt: order.createdAt,
        acceptedAt: order.acceptedAt,
        preparedAt: order.preparedAt,
        deliveredAt: order.deliveredAt,
        completedAt: order.completedAt,
        cancelledAt: order.cancelledAt,
        dvcEnteredAt: order.dvcEnteredAt,
        dispute: order.hasDispute
          ? {
              reason: order.disputeReason,
              resolvedAt: order.disputeResolvedAt,
            }
          : null,
        estimatedDeliveryMinutes,
        vendor: order.vendor,
        items: order.items.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          pricePerUnit: item.pricePerUnit,
          totalPrice: item.totalPrice,
          specialRequests: item.specialRequests,
          product: item.product
            ? {
                id: item.product.id,
                name: item.product.name,
                imageUrl: item.product.imageUrl,
              }
            : null,
        })),
        reviews: order.reviews,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/v1/customers/loyalty-points
 * Get user's loyalty points balance
 */
router.get("/loyalty-points", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await global.prisma.User.findUnique({
      where: { id: userId },
      select: {
        loyaltyPoints: true,
        pointsEarned: true,
        pointsRedeemed: true,
        orderCount: true,
        role: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const earningRate = getPointEarningRate(user.orderCount);

    return res.json({
      success: true,
      points: user.loyaltyPoints,
      pointsEarned: user.pointsEarned,
      pointsRedeemed: user.pointsRedeemed,
      orderCount: user.orderCount,
      tier: getLoyaltyTier(user.orderCount),
      earningRate,
      canRedeem: user.role !== "GUEST",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/v1/customers/create-account
 * Convert GUEST to MEMBER (set password, email)
 */
router.post("/create-account", authenticateToken, async (req, res) => {
  try {
    const { email, password, name } = req.body;

    const result = await createMemberAccountService({
      userId: req.user.userId,
      password,
      name,
      email,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error,
      });
    }

    return res.json({
      success: true,
      message: result.message,
      user: result.user,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      expiresIn: "15 minutes",
      refreshExpiresIn: "7 days",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
