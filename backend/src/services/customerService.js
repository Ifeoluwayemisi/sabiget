// ============================================
// Customer Service - Business Logic
// ============================================

import { calculateDistance, isValidCoordinates } from "../utils/location.js";

const getPrisma = () => global.prisma;

const calculateOrderPoints = (foodCost, orderCount) => {
  const earnRate = orderCount < 3 ? 0.05 : 0.02;
  return Math.floor(foodCost * earnRate);
};

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

    if (pointsToRedeem < 100) {
      return {
        success: false,
        error: "Minimum 100 points required for redemption",
      };
    }

    const discountAmount = pointsToRedeem;

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
      message: `Redeemed ${pointsToRedeem} points for N${discountAmount / 100} discount`,
      pointsRedeemed: pointsToRedeem,
      discountNaira: discountAmount / 100,
      remainingPoints: updatedUser.loyaltyPoints,
    };
  } catch (error) {
    console.error("[Customer Service] Error redeeming points:", error);
    throw error;
  }
};

const getLoyaltyTier = (orderCount) => {
  if (orderCount >= 10) {
    return "PLATINUM";
  }
  if (orderCount >= 4) {
    return "LOYAL";
  }
  return "STANDARD";
};

const getPointsEarningRate = (orderCount) => {
  return orderCount < 3 ? 0.05 : 0.02;
};

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

    const totalSpent = user.orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const avgOrderValue =
      user.orders.length > 0 ? totalSpent / user.orders.length : 0;

    const vendorCounts = {};
    user.orders.forEach((order) => {
      vendorCounts[order.vendorId] = (vendorCounts[order.vendorId] || 0) + 1;
    });

    const favoriteVendorId =
      Object.entries(vendorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    const favoriteVendor = favoriteVendorId
      ? await getPrisma().Vendor.findUnique({
          where: { id: favoriteVendorId },
          select: { id: true, name: true, logo: true },
        })
      : null;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentOrders = user.orders.filter(
      (order) => new Date(order.createdAt) > thirtyDaysAgo,
    ).length;

    return {
      success: true,
      insights: {
        totalOrders: user.orderCount,
        totalSpent,
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

const getRecommendedVendors = async (
  userId,
  latitude,
  longitude,
  radius = 5,
) => {
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

    const favoriteVendorIds = [...new Set(user.orders.map((order) => order.vendorId))].slice(
      0,
      3,
    );

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
      .filter((vendor) => vendor.distance <= radius)
      .sort((a, b) => {
        if (favoriteVendorIds.includes(a.id) && !favoriteVendorIds.includes(b.id)) {
          return -1;
        }
        if (!favoriteVendorIds.includes(a.id) && favoriteVendorIds.includes(b.id)) {
          return 1;
        }
        return (b.averageRating || 0) - (a.averageRating || 0);
      })
      .slice(0, 5);

    return {
      success: true,
      recommendations: nearby.map((vendor) => ({
        id: vendor.id,
        name: vendor.name,
        logo: vendor.logo,
        distanceKm: vendor.distance.toFixed(2),
        rating: vendor.averageRating,
        isFavorite: favoriteVendorIds.includes(vendor.id),
        reason: favoriteVendorIds.includes(vendor.id)
          ? "You frequently order from here"
          : "Highly rated in your area",
      })),
    };
  } catch (error) {
    console.error("[Customer Service] Error getting recommendations:", error);
    throw error;
  }
};

export {
  calculateOrderPoints,
  updateLoyaltyPointsOnOrderCompletion,
  redeemLoyaltyPoints,
  getLoyaltyTier,
  getPointsEarningRate,
  getCustomerInsights,
  getRecommendedVendors,
};
