// ============================================
// Customer Routes
// ============================================

import express from "express";
import { authenticateToken, optionalAuth } from "../middleware/auth.js";
import { createMemberAccountService } from "../services/memberAuthService.js";
import { findNearbyVendors, isValidCoordinates } from "../utils/location.js";
import {
  redeemLoyaltyPoints,
  getLoyaltyTier,
  getPointsEarningRate,
  getCustomerInsights,
  getRecommendedVendors,
} from "../services/customerService.js";

const router = express.Router();

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

        return (
          (b.metrics?.acceptanceRate || 0) - (a.metrics?.acceptanceRate || 0)
        );
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
          ? 20 +
            order.items.reduce((max, item) => {
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

    const earningRate = getPointsEarningRate(user.orderCount);

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
 * GET /api/v1/customers/order-history
 * Get customer's order history with filtering
 */
router.get("/order-history", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status, page = 1, limit = 10 } = req.query;

    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
    const skip = (parsedPage - 1) * parsedLimit;

    const where = { userId };
    if (status) {
      where.status = status;
    }

    const [orders, total] = await Promise.all([
      global.prisma.Order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: parsedLimit,
        include: {
          vendor: {
            select: { id: true, name: true, logo: true, averageRating: true },
          },
          items: {
            include: { product: { select: { name: true, price: true } } },
          },
          reviews: {
            select: { id: true, rating: true },
          },
        },
      }),
      global.prisma.Order.count({ where }),
    ]);

    const formattedOrders = orders.map((order) => ({
      id: order.id,
      status: order.status,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
      completedAt: order.completedAt,
      vendor: order.vendor,
      itemCount: order.items.length,
      rating: order.reviews?.[0]?.rating || null,
      reviewId: order.reviews?.[0]?.id || null,
    }));

    return res.json({
      success: true,
      orders: formattedOrders,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages: Math.ceil(total / parsedLimit),
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
 * POST /api/v1/customers/orders/:orderId/review
 * Submit review for completed order
 */
router.post("/orders/:orderId/review", authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { rating, comment, foodQuality, deliverySpeed, driverBehavior } =
      req.body;
    const userId = req.user.userId;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5",
      });
    }

    if (comment && comment.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Comment must be 500 characters or less",
      });
    }

    const order = await global.prisma.Order.findUnique({
      where: { id: orderId },
      include: { vendor: true },
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
        message: "Not authorized to review this order",
      });
    }

    if (order.status !== "COMPLETED" && order.status !== "DELIVERED") {
      return res.status(400).json({
        success: false,
        message: "Can only review completed or delivered orders",
      });
    }

    // Check if review already exists
    const existingReview = await global.prisma.Review.findFirst({
      where: { orderId, userId },
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: "You have already reviewed this order",
      });
    }

    const review = await global.prisma.Review.create({
      data: {
        orderId,
        userId,
        vendorId: order.vendorId,
        rating,
        comment: comment || null,
        foodQuality: foodQuality ? Math.max(1, Math.min(5, foodQuality)) : null,
        deliverySpeed: deliverySpeed
          ? Math.max(1, Math.min(5, deliverySpeed))
          : null,
        driverBehavior: driverBehavior
          ? Math.max(1, Math.min(5, driverBehavior))
          : null,
      },
    });

    // Update vendor's average rating
    const vendorReviews = await global.prisma.Review.findMany({
      where: { vendorId: order.vendorId },
      select: { rating: true },
    });

    const averageRating =
      vendorReviews.length > 0
        ? (
            vendorReviews.reduce((sum, r) => sum + r.rating, 0) /
            vendorReviews.length
          ).toFixed(1)
        : 0;

    await global.prisma.Vendor.update({
      where: { id: order.vendorId },
      data: {
        averageRating: parseFloat(averageRating),
        totalReviews: vendorReviews.length,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Review submitted successfully",
      review: {
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
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
 * GET /api/v1/customers/vendors/:vendorId/reviews
 * Get all reviews for a vendor
 */
router.get("/vendors/:vendorId/reviews", async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { page = 1, limit = 10, sortBy = "recent" } = req.query;

    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
    const skip = (parsedPage - 1) * parsedLimit;

    // Verify vendor exists
    const vendor = await global.prisma.Vendor.findUnique({
      where: { id: vendorId },
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    const orderBy =
      sortBy === "highest"
        ? { rating: "desc" }
        : sortBy === "lowest"
          ? { rating: "asc" }
          : { createdAt: "desc" };

    const [reviews, total] = await Promise.all([
      global.prisma.Review.findMany({
        where: { vendorId },
        orderBy,
        skip,
        take: parsedLimit,
        include: {
          user: { select: { id: true, name: true } },
        },
      }),
      global.prisma.Review.count({ where: { vendorId } }),
    ]);

    const formattedReviews = reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      foodQuality: review.foodQuality,
      deliverySpeed: review.deliverySpeed,
      driverBehavior: review.driverBehavior,
      user: {
        id: review.user.id,
        name: review.user.name,
      },
      createdAt: review.createdAt,
    }));

    // Calculate rating distribution
    const ratingCounts = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    };

    reviews.forEach((review) => {
      ratingCounts[review.rating]++;
    });

    return res.json({
      success: true,
      vendor: {
        id: vendorId,
        name: vendor.name,
        averageRating: vendor.averageRating,
        totalReviews: vendor.totalReviews,
      },
      reviews: formattedReviews,
      ratingDistribution: ratingCounts,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages: Math.ceil(total / parsedLimit),
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
 * GET /api/v1/customers/orders/:orderId/review
 * Get review for a specific order (if exists)
 */
router.get("/orders/:orderId/review", authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId;

    const order = await global.prisma.Order.findUnique({
      where: { id: orderId },
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
        message: "Not authorized to view this review",
      });
    }

    const review = await global.prisma.Review.findFirst({
      where: { orderId, userId },
      include: {
        vendor: { select: { id: true, name: true } },
      },
    });

    if (!review) {
      return res.json({
        success: true,
        review: null,
        message: "No review found for this order",
      });
    }

    return res.json({
      success: true,
      review: {
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        foodQuality: review.foodQuality,
        deliverySpeed: review.deliverySpeed,
        driverBehavior: review.driverBehavior,
        vendor: review.vendor,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt,
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
 * POST /api/v1/customers/loyalty-points/redeem
 * Redeem loyalty points for discount
 */
router.post("/loyalty-points/redeem", authenticateToken, async (req, res) => {
  try {
    const { pointsToRedeem } = req.body;
    const userId = req.user.userId;

    if (!pointsToRedeem || pointsToRedeem <= 0 || pointsToRedeem < 100) {
      return res.status(400).json({
        success: false,
        message: "Minimum 100 points required (₦50 discount)",
      });
    }

    const result = await redeemLoyaltyPoints(userId, pointsToRedeem);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error,
        availablePoints: result.availablePoints,
      });
    }

    return res.json({
      success: true,
      message: result.message,
      pointsRedeemed: result.pointsRedeemed,
      discountNaira: result.discountNaira,
      remainingPoints: result.remainingPoints,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/v1/customers/insights
 * Get customer's insights (spend, frequency, preferences)
 */
router.get("/insights", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await getCustomerInsights(userId);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: result.error,
      });
    }

    return res.json({
      success: true,
      insights: result.insights,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/v1/customers/recommendations
 * Get personalized vendor recommendations
 */
router.get("/recommendations", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { latitude, longitude, radius = 5 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude required",
      });
    }

    const parsedLatitude = parseFloat(latitude);
    const parsedLongitude = parseFloat(longitude);
    const parsedRadius = parseFloat(radius) || 5;

    if (!isValidCoordinates(parsedLatitude, parsedLongitude)) {
      return res.status(400).json({
        success: false,
        message: "Invalid coordinates",
      });
    }

    const result = await getRecommendedVendors(
      userId,
      parsedLatitude,
      parsedLongitude,
      parsedRadius,
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error,
      });
    }

    return res.json({
      success: true,
      recommendations: result.recommendations,
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

export default router;
