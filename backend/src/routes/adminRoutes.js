// Admin Routes - Dashboard, vendor management, dispute resolution
import express from "express";
import { authenticateToken, authorize } from "../middleware/auth.js";
import { triggerOrderRefund } from "../services/orderService.js";

const router = express.Router();

function getPrisma() {
  return global.prisma;
}

function getPagination(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

function getRequestMetadata(req) {
  return {
    ipAddress: req.ip,
    userAgent: req.get("user-agent") || null,
  };
}

async function createAuditLog(req, payload) {
  const prisma = getPrisma();
  if (!prisma.AuditLog?.create) {
    return null;
  }

  return prisma.AuditLog.create({
    data: {
      adminId: req.user.userId,
      ...payload,
      ...getRequestMetadata(req),
    },
  });
}

function buildVendorFilter(status, search) {
  const where = {};
  const normalizedStatus = status ? String(status).toUpperCase() : null;

  if (normalizedStatus === "ACTIVE") {
    where.isActive = true;
  } else if (normalizedStatus === "INACTIVE") {
    where.isActive = false;
  } else if (
    normalizedStatus &&
    ["PENDING", "VERIFIED", "REJECTED", "SUSPENDED"].includes(normalizedStatus)
  ) {
    where.kybStatus = normalizedStatus;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { lga: { contains: search, mode: "insensitive" } },
    ];
  }

  return where;
}

function buildOrderFilter(status, vendorId) {
  const where = {};

  if (status) {
    where.status = String(status).toUpperCase();
  }

  if (vendorId) {
    where.vendorId = vendorId;
  }

  return where;
}

function buildDisputeFilter(status) {
  if (!status) {
    return {};
  }

  return {
    status: String(status).toUpperCase(),
  };
}

/**
 * GET /api/admin/dashboard
 * Admin dashboard with key metrics
 */
router.get(
  "/dashboard",
  authenticateToken,
  authorize("ADMIN", "SUPER_ADMIN"),
  async (req, res) => {
    try {
      const prisma = getPrisma();

      const [
        paidOrderAggregate,
        vendorCount,
        activeVendorCount,
        orderCount,
        pendingOrderCount,
        disputeCount,
      ] = await Promise.all([
        prisma.Order.aggregate({
          where: {
            status: {
              in: ["PENDING", "ACCEPTED", "OUT_FOR_DELIVERY", "DELIVERED", "COMPLETED"],
            },
          },
          _sum: {
            totalAmount: true,
            platformFee: true,
          },
        }),
        prisma.Vendor.count(),
        prisma.Vendor.count({ where: { isActive: true } }),
        prisma.Order.count(),
        prisma.Order.count({ where: { status: "PENDING" } }),
        prisma.DisputeReport.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW", "ESCALATED"] } } }),
      ]);

      return res.json({
        success: true,
        message: "Admin dashboard data fetched",
        metrics: {
          gmv: paidOrderAggregate._sum.totalAmount || 0,
          netRevenue: paidOrderAggregate._sum.platformFee || 0,
          vendorCount,
          activeVendorCount,
          orderCount,
          pendingOrderCount,
          openDisputeCount: disputeCount,
        },
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },
);

/**
 * GET /api/admin/vendors
 * List all vendors with filters
 */
router.get(
  "/vendors",
  authenticateToken,
  authorize("ADMIN", "SUPER_ADMIN"),
  async (req, res) => {
    try {
      const prisma = getPrisma();
      const { status, search } = req.query;
      const { page, limit, skip } = getPagination(req.query);
      const where = buildVendorFilter(status, search);

      const [vendors, total] = await Promise.all([
        prisma.Vendor.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            metrics: true,
            user: {
              select: {
                id: true,
                name: true,
                phone: true,
                email: true,
              },
            },
          },
        }),
        prisma.Vendor.count({ where }),
      ]);

      return res.json({
        success: true,
        message: "Vendors fetched",
        filters: { status: status || null, search: search || null },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(Math.ceil(total / limit), 1),
        },
        vendors,
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },
);

/**
 * PATCH /api/admin/vendors/:id/verify
 * Verify vendor (KYB)
 */
router.patch(
  "/vendors/:id/verify",
  authenticateToken,
  authorize("ADMIN", "SUPER_ADMIN"),
  async (req, res) => {
    try {
      const prisma = getPrisma();
      const { id } = req.params;
      const { approved, reason } = req.body;

      if (typeof approved !== "boolean") {
        return res.status(400).json({
          success: false,
          error: "`approved` must be a boolean",
        });
      }

      const existingVendor = await prisma.Vendor.findUnique({
        where: { id },
      });

      if (!existingVendor) {
        return res.status(404).json({
          success: false,
          error: "Vendor not found",
        });
      }

      const updatedVendor = await prisma.Vendor.update({
        where: { id },
        data: {
          isVerified: approved,
          verifiedAt: approved ? new Date() : null,
          kybStatus: approved ? "VERIFIED" : "REJECTED",
          isActive: approved ? existingVendor.isActive : false,
        },
      });

      await createAuditLog(req, {
        action: approved ? "VENDOR_VERIFIED" : "VENDOR_REJECTED",
        targetType: "VENDOR",
        targetId: id,
        reason: reason || null,
        changes: {
          before: {
            isVerified: existingVendor.isVerified,
            kybStatus: existingVendor.kybStatus,
            isActive: existingVendor.isActive,
          },
          after: {
            isVerified: updatedVendor.isVerified,
            kybStatus: updatedVendor.kybStatus,
            isActive: updatedVendor.isActive,
          },
        },
      });

      return res.json({
        success: true,
        message: "Vendor verification updated",
        vendor: updatedVendor,
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },
);

/**
 * PATCH /api/admin/vendors/:id/deactivate
 * Deactivate vendor
 */
router.patch(
  "/vendors/:id/deactivate",
  authenticateToken,
  authorize("ADMIN", "SUPER_ADMIN"),
  async (req, res) => {
    try {
      const prisma = getPrisma();
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason || !String(reason).trim()) {
        return res.status(400).json({
          success: false,
          error: "A deactivation reason is required",
        });
      }

      const existingVendor = await prisma.Vendor.findUnique({
        where: { id },
      });

      if (!existingVendor) {
        return res.status(404).json({
          success: false,
          error: "Vendor not found",
        });
      }

      const updatedVendor = await prisma.Vendor.update({
        where: { id },
        data: {
          isActive: false,
        },
      });

      await createAuditLog(req, {
        action: "VENDOR_DEACTIVATED",
        targetType: "VENDOR",
        targetId: id,
        reason: String(reason).trim(),
        changes: {
          before: {
            isActive: existingVendor.isActive,
          },
          after: {
            isActive: updatedVendor.isActive,
          },
        },
      });

      return res.json({
        success: true,
        message: existingVendor.isActive
          ? "Vendor deactivated"
          : "Vendor already inactive",
        vendor: updatedVendor,
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },
);

/**
 * GET /api/admin/orders
 * List all orders with filters
 */
router.get(
  "/orders",
  authenticateToken,
  authorize("ADMIN", "SUPER_ADMIN"),
  async (req, res) => {
    try {
      const prisma = getPrisma();
      const { status, vendorId } = req.query;
      const { page, limit, skip } = getPagination(req.query);
      const where = buildOrderFilter(status, vendorId);

      const [orders, total] = await Promise.all([
        prisma.Order.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            vendor: {
              select: {
                id: true,
                name: true,
                phone: true,
              },
            },
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
        }),
        prisma.Order.count({ where }),
      ]);

      return res.json({
        success: true,
        message: "Orders fetched",
        filters: { status: status || null, vendorId: vendorId || null },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(Math.ceil(total / limit), 1),
        },
        orders,
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },
);

/**
 * GET /api/admin/orders/:id
 * Get order details for dispute investigation
 */
router.get(
  "/orders/:id",
  authenticateToken,
  authorize("ADMIN", "SUPER_ADMIN"),
  async (req, res) => {
    try {
      const prisma = getPrisma();
      const { id } = req.params;

      const order = await prisma.Order.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          vendor: true,
          user: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              role: true,
            },
          },
          reviews: true,
          webhookLogs: {
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          error: "Order not found",
        });
      }

      const auditLogs = prisma.AuditLog?.findMany
        ? await prisma.AuditLog.findMany({
            where: {
              targetType: "ORDER",
              targetId: id,
            },
            orderBy: { createdAt: "desc" },
          })
        : [];

      return res.json({
        success: true,
        message: "Order details fetched",
        order,
        auditLogs,
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },
);

/**
 * POST /api/admin/orders/:id/force-refund
 * Force refund an order
 */
router.post(
  "/orders/:id/force-refund",
  authenticateToken,
  authorize("ADMIN", "SUPER_ADMIN"),
  async (req, res) => {
    try {
      const prisma = getPrisma();
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason || !String(reason).trim()) {
        return res.status(400).json({
          success: false,
          error: "A refund reason is required",
        });
      }

      const order = await prisma.Order.findUnique({
        where: { id },
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          error: "Order not found",
        });
      }

      const refundResult = await triggerOrderRefund(
        order,
        `Admin force refund: ${String(reason).trim()}`,
      );

      if (!refundResult.success) {
        return res.status(502).json({
          success: false,
          error: refundResult.error || "Refund failed",
        });
      }

      const updatedOrder = await prisma.Order.update({
        where: { id },
        data: {
          forceRefundedByAdmin: true,
          adminNotes: String(reason).trim(),
        },
      });

      await createAuditLog(req, {
        action: "ORDER_FORCE_REFUND",
        targetType: "ORDER",
        targetId: id,
        reason: String(reason).trim(),
        changes: {
          before: {
            status: order.status,
            forceRefundedByAdmin: order.forceRefundedByAdmin,
          },
          after: {
            status: updatedOrder.status,
            forceRefundedByAdmin: updatedOrder.forceRefundedByAdmin,
          },
        },
      });

      return res.json({
        success: true,
        message: refundResult.alreadyRefunded
          ? "Order was already refunded"
          : "Order force refunded",
        order: updatedOrder,
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },
);

/**
 * GET /api/admin/disputes
 * List all disputes
 */
router.get(
  "/disputes",
  authenticateToken,
  authorize("ADMIN", "SUPER_ADMIN"),
  async (req, res) => {
    try {
      const prisma = getPrisma();
      const { status } = req.query;
      const { page, limit, skip } = getPagination(req.query);
      const where = buildDisputeFilter(status);

      const [disputes, total] = await Promise.all([
        prisma.DisputeReport.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                phone: true,
              },
            },
          },
        }),
        prisma.DisputeReport.count({ where }),
      ]);

      return res.json({
        success: true,
        message: "Disputes fetched",
        filters: { status: status || null },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(Math.ceil(total / limit), 1),
        },
        disputes,
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },
);

/**
 * POST /api/admin/disputes/:id/resolve
 * Resolve a dispute
 */
router.post(
  "/disputes/:id/resolve",
  authenticateToken,
  authorize("ADMIN", "SUPER_ADMIN"),
  async (req, res) => {
    try {
      const prisma = getPrisma();
      const { id } = req.params;
      const { resolution, refund } = req.body;

      if (!resolution || !String(resolution).trim()) {
        return res.status(400).json({
          success: false,
          error: "A resolution is required",
        });
      }

      const dispute = await prisma.DisputeReport.findUnique({
        where: { id },
      });

      if (!dispute) {
        return res.status(404).json({
          success: false,
          error: "Dispute not found",
        });
      }

      let refundResult = null;
      let relatedOrder = null;

      if (refund && dispute.orderId) {
        relatedOrder = await prisma.Order.findUnique({
          where: { id: dispute.orderId },
        });

        if (relatedOrder) {
          refundResult = await triggerOrderRefund(
            relatedOrder,
            `Dispute resolution refund: ${String(resolution).trim()}`,
          );

          if (!refundResult.success) {
            return res.status(502).json({
              success: false,
              error: refundResult.error || "Refund failed",
            });
          }
        }
      }

      const resolvedDispute = await prisma.DisputeReport.update({
        where: { id },
        data: {
          status: "RESOLVED",
          resolution: String(resolution).trim(),
          resolvedBy: req.user.userId,
          resolvedAt: new Date(),
        },
      });

      if (dispute.orderId) {
        await prisma.Order.update({
          where: { id: dispute.orderId },
          data: {
            hasDispute: false,
            disputeResolvedAt: new Date(),
            adminNotes: String(resolution).trim(),
          },
        });
      }

      await createAuditLog(req, {
        action: "DISPUTE_RESOLVED",
        targetType: "DISPUTE",
        targetId: id,
        reason: String(resolution).trim(),
        changes: {
          before: {
            status: dispute.status,
            resolution: dispute.resolution,
          },
          after: {
            status: resolvedDispute.status,
            resolution: resolvedDispute.resolution,
            refundTriggered: Boolean(refund && dispute.orderId),
          },
        },
      });

      return res.json({
        success: true,
        message: "Dispute resolved",
        dispute: resolvedDispute,
        refundTriggered: Boolean(refund && relatedOrder),
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },
);

/**
 * GET /api/admin/audit-logs
 * List audit logs
 */
router.get(
  "/audit-logs",
  authenticateToken,
  authorize("ADMIN", "SUPER_ADMIN"),
  async (req, res) => {
    try {
      const prisma = getPrisma();
      const { action, targetType } = req.query;
      const { page, limit, skip } = getPagination(req.query);
      const where = {};

      if (action) {
        where.action = action;
      }

      if (targetType) {
        where.targetType = String(targetType).toUpperCase();
      }

      const [logs, total] = await Promise.all([
        prisma.AuditLog.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            admin: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        }),
        prisma.AuditLog.count({ where }),
      ]);

      return res.json({
        success: true,
        message: "Audit logs fetched",
        filters: {
          action: action || null,
          targetType: targetType ? String(targetType).toUpperCase() : null,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(Math.ceil(total / limit), 1),
        },
        logs,
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },
);

/**
 * GET /api/admin/analytics
 * Analytics and heatmaps
 */
router.get(
  "/analytics",
  authenticateToken,
  authorize("ADMIN", "SUPER_ADMIN"),
  async (req, res) => {
    try {
      const prisma = getPrisma();

      const [statusBuckets, topVendors, recentOrders] = await Promise.all([
        prisma.Order.groupBy({
          by: ["status"],
          _count: { status: true },
        }),
        prisma.Vendor.findMany({
          take: 5,
          orderBy: {
            metrics: {
              meritScore: "desc",
            },
          },
          include: {
            metrics: true,
          },
        }),
        prisma.Order.findMany({
          take: 10,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            status: true,
            totalAmount: true,
            createdAt: true,
            vendorId: true,
          },
        }),
      ]);

      return res.json({
        success: true,
        message: "Analytics data fetched",
        orderStatusBreakdown: statusBuckets.map((bucket) => ({
          status: bucket.status,
          count: bucket._count.status,
        })),
        topVendors,
        recentOrders,
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },
);

export default router;
