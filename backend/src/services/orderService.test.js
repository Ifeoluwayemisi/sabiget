jest.mock("../utils/paystack", () => ({
  initiateRefund: jest.fn(),
}));

const { initiateRefund } = require("../utils/paystack");
const {
  CANCELLABLE_STATUSES,
  isAcceptanceExpired,
  triggerOrderRefund,
  autoKillExpiredPendingOrder,
  autoKillExpiredPendingOrders,
  completeDeliveredOrder,
} = require("./orderService");

describe("orderService", () => {
  let prisma;

  beforeEach(() => {
    prisma = {
      Order: {
        update: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    };

    global.prisma = prisma;
    jest.clearAllMocks();
  });

  afterAll(() => {
    delete global.prisma;
  });

  describe("CANCELLABLE_STATUSES", () => {
    it("includes pending orders", () => {
      expect(CANCELLABLE_STATUSES.has("PENDING")).toBe(true);
    });
  });

  describe("isAcceptanceExpired", () => {
    it("returns true for pending orders past the deadline", () => {
      const order = {
        status: "PENDING",
        acceptanceDeadline: new Date(Date.now() - 60_000),
      };

      expect(isAcceptanceExpired(order)).toBe(true);
    });

    it("returns false for non-pending orders", () => {
      const order = {
        status: "ACCEPTED",
        acceptanceDeadline: new Date(Date.now() - 60_000),
      };

      expect(isAcceptanceExpired(order)).toBe(false);
    });
  });

  describe("triggerOrderRefund", () => {
    it("returns early when the order was already refunded", async () => {
      const result = await triggerOrderRefund(
        {
          id: "ord_1",
          status: "REFUNDED",
        },
        "Already refunded",
      );

      expect(result).toEqual({
        success: true,
        alreadyRefunded: true,
      });
      expect(initiateRefund).not.toHaveBeenCalled();
      expect(prisma.Order.update).not.toHaveBeenCalled();
    });

    it("initiates refund and updates order timestamps", async () => {
      initiateRefund.mockResolvedValue({
        success: true,
        data: { refundId: "ref_1" },
      });

      prisma.Order.update.mockResolvedValue({
        id: "ord_2",
        status: "REFUNDED",
      });

      const order = {
        id: "ord_2",
        status: "CANCELLED_VENDOR",
        paymentReference: "pay_ref_1",
        totalAmount: 4500,
      };

      const result = await triggerOrderRefund(order, "Vendor rejected order");

      expect(initiateRefund).toHaveBeenCalledWith({
        transactionId: "pay_ref_1",
        amount: 4500,
        reason: "Vendor rejected order",
      });
      expect(prisma.Order.update).toHaveBeenCalledWith({
        where: { id: "ord_2" },
        data: expect.objectContaining({
          status: "REFUNDED",
          refundAmount: 4500,
          refundInitiatedAt: expect.any(Date),
          refundCompletedAt: expect.any(Date),
        }),
      });
      expect(result).toEqual({
        success: true,
        data: { refundId: "ref_1" },
      });
    });

    it("returns the refund provider error without updating the order", async () => {
      initiateRefund.mockResolvedValue({
        success: false,
        error: "refund failed",
      });

      const result = await triggerOrderRefund(
        {
          id: "ord_3",
          status: "CANCELLED_CUSTOMER",
          paymentReference: "pay_ref_2",
          totalAmount: 3200,
        },
        "Customer cancelled",
      );

      expect(result).toEqual({
        success: false,
        error: "refund failed",
      });
      expect(prisma.Order.update).not.toHaveBeenCalled();
    });
  });

  describe("autoKillExpiredPendingOrder", () => {
    it("returns the same order when the acceptance window is still open", async () => {
      const order = {
        id: "ord_4",
        status: "PENDING",
        acceptanceDeadline: new Date(Date.now() + 60_000),
      };

      const result = await autoKillExpiredPendingOrder(order);

      expect(result).toBe(order);
      expect(prisma.Order.update).not.toHaveBeenCalled();
    });

    it("auto-kills and refunds expired pending orders", async () => {
      const expiredOrder = {
        id: "ord_5",
        status: "PENDING",
        acceptanceDeadline: new Date(Date.now() - 60_000),
        paymentReference: "pay_ref_5",
        totalAmount: 8000,
      };

      initiateRefund.mockResolvedValue({
        success: true,
      });

      prisma.Order.update
        .mockResolvedValueOnce({
          ...expiredOrder,
          status: "CANCELLED_AUTO_KILL",
        })
        .mockResolvedValueOnce({
          ...expiredOrder,
          status: "REFUNDED",
        });

      prisma.Order.findUnique.mockResolvedValue({
        ...expiredOrder,
        status: "REFUNDED",
      });

      const result = await autoKillExpiredPendingOrder(expiredOrder);

      expect(prisma.Order.update).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { id: "ord_5" },
          data: expect.objectContaining({
            status: "CANCELLED_AUTO_KILL",
            autoKilledAt: expect.any(Date),
          }),
        }),
      );
      expect(initiateRefund).toHaveBeenCalled();
      expect(result).toEqual({
        ...expiredOrder,
        status: "REFUNDED",
      });
    });
  });

  describe("autoKillExpiredPendingOrders", () => {
    it("processes all expired pending orders up to the limit", async () => {
      const orders = [
        {
          id: "ord_6",
          status: "PENDING",
          acceptanceDeadline: new Date(Date.now() - 60_000),
          paymentReference: "pay_ref_6",
          totalAmount: 2000,
        },
        {
          id: "ord_7",
          status: "PENDING",
          acceptanceDeadline: new Date(Date.now() - 120_000),
          paymentReference: "pay_ref_7",
          totalAmount: 3500,
        },
      ];

      prisma.Order.findMany.mockResolvedValue(orders);
      initiateRefund.mockResolvedValue({ success: true });
      prisma.Order.update
        .mockResolvedValueOnce({ ...orders[0], status: "CANCELLED_AUTO_KILL" })
        .mockResolvedValueOnce({ ...orders[0], status: "REFUNDED" })
        .mockResolvedValueOnce({ ...orders[1], status: "CANCELLED_AUTO_KILL" })
        .mockResolvedValueOnce({ ...orders[1], status: "REFUNDED" });
      prisma.Order.findUnique
        .mockResolvedValueOnce({ ...orders[0], status: "REFUNDED" })
        .mockResolvedValueOnce({ ...orders[1], status: "REFUNDED" });

      const processed = await autoKillExpiredPendingOrders(10);

      expect(prisma.Order.findMany).toHaveBeenCalledWith({
        where: {
          status: "PENDING",
          acceptanceDeadline: {
            lte: expect.any(Date),
          },
        },
        take: 10,
        orderBy: {
          acceptanceDeadline: "asc",
        },
      });
      expect(processed).toBe(2);
    });
  });

  describe("completeDeliveredOrder", () => {
    it("completes a delivered order", async () => {
      prisma.Order.findUnique.mockResolvedValue({
        id: "ord_8",
        status: "DELIVERED",
      });
      prisma.Order.update.mockResolvedValue({
        id: "ord_8",
        status: "COMPLETED",
        completedAt: new Date(),
      });

      const result = await completeDeliveredOrder("ord_8");

      expect(prisma.Order.update).toHaveBeenCalledWith({
        where: { id: "ord_8" },
        data: expect.objectContaining({
          status: "COMPLETED",
          completedAt: expect.any(Date),
          adminNotes: "Order payout unlocked",
        }),
      });
      expect(result.success).toBe(true);
      expect(result.order.status).toBe("COMPLETED");
    });

    it("returns alreadyCompleted for completed orders", async () => {
      prisma.Order.findUnique.mockResolvedValue({
        id: "ord_9",
        status: "COMPLETED",
      });

      const result = await completeDeliveredOrder("ord_9");

      expect(result).toEqual({
        success: true,
        alreadyCompleted: true,
        order: {
          id: "ord_9",
          status: "COMPLETED",
        },
      });
      expect(prisma.Order.update).not.toHaveBeenCalled();
    });

    it("rejects invalid state transitions", async () => {
      prisma.Order.findUnique.mockResolvedValue({
        id: "ord_10",
        status: "ACCEPTED",
      });

      const result = await completeDeliveredOrder("ord_10");

      expect(result).toEqual({
        success: false,
        error: "Cannot complete order in ACCEPTED status",
      });
    });
  });
});
