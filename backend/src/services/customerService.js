// ============================================
// Customer Service - Business Logic
// ============================================

const getPrisma = () => global.prisma;

/**
 * Calculate loyalty points for an order
 * Rules:
 * - First 3 orders: 5% of order total (food cost only)
 * - After 3 orders: 2% of order total
 */
const calculateOrderPoints = (foodCost, orderCount) => {
  const earnRate = orderCount < 3 ? 0.05 : 0.02;
  return Math.floor(foodCost * earnRate);
};

/**
 * Update user's loyalty points after order completion
 * Called when order status changes to COMPLETED
 */
const updateLoyaltyPointsOnOrderCompletion = async (orderId) => {
  try {
    const order = await getPrisma().Order.findUnique({
      where: { id: orderId },
      include: { user: true },
    });

    if (!order) {
      return { success: false, error: "Order not found" };
    }

    if (order.status !== "COMPLETED") {
      return { success: false, error: "Order must be completed" };
    }

    const user = order.user;
    const pointsEarned = calculateOrderPoints(order.foodCost, user.orderCount);

    const updatedUser = await getPrisma().User.update({
      where: { id: order.userId },
      data: {
        loyaltyPoints: {
          increment: pointsEarned,
        },
        pointsEarned: {
          increment: pointsEarned,
        },
      },
    });

    return {
      success: true,
      pointsEarned,
      totalPoints: updatedUser.loyaltyPoints,
    };
  } catch (error) {
    console.error("[Customer Service] Error updating loyalty points:", error);
    throw error;
  }
};

/**
 * Redeem loyalty points for discount on next order
 * Conversion: 100 points = ₦100 discount (1:1 ratio in kobo)
 */
const redeemLoyaltyPoints = async (userId, pointsToRedeem) => {
  try {
    const user = await getPrisma().User.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    if (user.loyaltyPoints < pointsToRedeem) {
      return {
        success: false,
        error: "Insufficient loyalty points",
        availablePoints: user.loyaltyPoints,
      };
    }

    if (pointsToRedeem < 50) {
      return {
        success: false,
        error: "Minimum 50 points required for redemption",
      };
    }

    const discountAmount = pointsToRedeem; // 1:1 conversion (points to kobo/naira)

    const updatedUser = await getPrisma().User.update({
      where: { id: userId },
      data: {
        loyaltyPoints: {
          decrement: pointsToRedeem,
        },
        pointsRedeemed: {
          increment: pointsToRedeem,
        },
      },
    });

    return {
      success: true,
      message: `Redeemed ${pointsToRedeem} points for ₦${discountAmount/100} discount`,
      pointsRedeemed: pointsToRedeem,
      discountNaira: discountAmount / 100,
      remainingPoints: updatedUser.loyaltyPoints,
    };
  } catch (error) {
    console.error("[Customer Service] Error redeeming points:", error);
    throw error;
  }
};

/**
 * Get customer's loyalty tier
 */
const getLoyaltyTier = (orderCount) => {
  if (orderCount >= 10) {
    return "PLATINUM"; // Highest tier
  }
  if (orderCount >= 4) {
    return "LOYAL";
  }
  return "STANDARD";
};

/**
 * Get points earning rate based on order count
 */
const getPointsEarningRate = (orderCount) => {
  return orderCount < 3 ? 0.05 : 0.02; // 5% initially, then 2%
};

/**
 * Get customer insights (spend, frequency, preferences)
 */
const getCustomerInsights = async (userId) => {
  try {
    const user = await getPrisma().User.findUnique({
      where: { id: userId },
      include: {
        orders: {
          where: { status: "COMPLETED" },
          select: { totalAmount: true, createdAt: true, vendorId: true },
        },
      },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Calculate metrics
    const totalSpent = user.orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const avgOrderValue =
      user.orders.length > 0 ? totalSpent / user.orders.length : 0;

    // Find most frequently ordered vendor
    const vendorCounts = {};
    user.orders.forEach((order) => {
      vendorCounts[order.vendorId] =
        (vendorCounts[order.vendorId] || 0) + 1;
    });

    const favoriteVendorId = Object.entries(vendorCounts).sort(
      (a, b) => b[1] - a[1],
    )[0]?.[0] || null;

    const favoriteVendor = favoriteVendorId
      ? await getPrisma().Vendor.findUnique({
          where: { id: favoriteVendorId },
          select: { id: true, name: true, logo: true },
        })
      : null;

    // Calculate order frequency (orders per month)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentOrders = user.orders.filter(
      (o) => new Date(o.createdAt) > thirtyDaysAgo,
    ).length;

    return {
      success: true,
      insights: {
        totalOrders: user.orderCount,
        totalSpent: totalSpent,
        avgOrderValue: avgOrderValue.toFixed(2),
        recentOrdersThisMonth: recentOrders,
        frequencyPerWeek: (recentOrders / 4).toFixed(1),
        favoriteVendor,
        loyaltyTier: getLoyaltyTier(user.orderCount),
        pointsBalance: user.loyaltyPoints,
      },
    };
  } catch (error) {
    console.error("[Customer Service] Error getting insights:", error);
    throw error;
  }
};

/**
 * Get personalized recommendations based on order history
 */
const getRecommendedVendors = async (userId, latitude, longitude, radius = 5) => {
  try {
    const user = await getPrisma().User.findUnique({
      where: { id: userId },
      include: {
        orders: {
          where: { status: "COMPLETED" },
          select: { vendorId: true },
        },
      },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Get vendors similar to user's favorite vendors
    const favoriteVendorIds = [
      ...new Set(user.orders.map((o) => o.vendorId)),
    ].slice(0, 3);

    const { findNearbyVendors, isValidCoordinates } = require("../utils/location");

    if (!isValidCoordinates(latitude, longitude)) {
      return { success: false, error: "Invalid coordinates" };
    }

    const allNearbyVendors = await getPrisma().Vendor.findMany({
      where: {
        isActive: true,
        isVerified: true,
      },
      include: { metrics: true },
    });

    const { calculateDistance } = require("../utils/location");

    const nearby = allNearbyVendors
      .map((vendor) => ({
        ...vendor,
        distance: calculateDistance(
          latitude,
          longitude,
          vendor.latitude,
          vendor.longitude,
        ),
      }))
      .filter((v) => v.distance <= radius)
      .sort((a, b) => {
        // Prioritize favorite vendors
        if (
          favoriteVendorIds.includes(a.id) &&
          !favoriteVendorIds.includes(b.id)
        ) {
          return -1;
        }
        if (
          !favoriteVendorIds.includes(a.id) &&
          favoriteVendorIds.includes(b.id)
        ) {
          return 1;
        }
        // Then by rating
        return (b.averageRating || 0) - (a.averageRating || 0);
      })
      .slice(0, 5);

    return {
      success: true,
      recommendations: nearby.map((v) => ({
        id: v.id,
        name: v.name,
        logo: v.logo,
        distanceKm: v.distance.toFixed(2),
        rating: v.averageRating,
        isFavorite: favoriteVendorIds.includes(v.id),
        reason: favoriteVendorIds.includes(v.id)
          ? "You frequently order from here"
          : "Highly rated in your area",
      })),
    };
  } catch (error) {
    console.error("[Customer Service] Error getting recommendations:", error);
    throw error;
  }
};

module.exports = {
  calculateOrderPoints,
  updateLoyaltyPointsOnOrderCompletion,
  redeemLoyaltyPoints,
  getLoyaltyTier,
  getPointsEarningRate,
  getCustomerInsights,
  getRecommendedVendors,
};
