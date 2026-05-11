const express = require("express");
const { startTestServer } = require("../test/startTestServer");

jest.mock("../utils/paystack", () => ({
  verifyWebhookSignature: jest.fn(() => true),
}));

const { verifyWebhookSignature } = require("../utils/paystack");
const webhookRouter = require("./webhookRoutes");

describe("webhookRoutes", () => {
  let server;
  let prisma;
  let io;

  beforeEach(async () => {
    prisma = {
      WebhookLog: {
        create: jest.fn(),
        update: jest.fn(),
      },
      Order: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    io = {
      to: jest.fn(() => ({
        emit: jest.fn(),
      })),
    };

    global.prisma = prisma;
    global.io = io;
    jest.clearAllMocks();
    server = await startTestServer(webhookRouter, { withRawBody: true });
  });

  afterEach(async () => {
    await server.close();
  });

  afterAll(() => {
    delete global.prisma;
    delete global.io;
  });

  it("processes charge.success once and ignores repeated delivery of the same event", async () => {
    prisma.WebhookLog.create
      .mockResolvedValueOnce({ id: "log_1" })
      .mockResolvedValueOnce({ id: "log_2" });

    prisma.Order.findUnique
      .mockResolvedValueOnce({
        id: "ord_1",
        vendorId: "vendor_1",
        status: "UNPAID",
        paymentReference: "pay_ref_1",
        totalAmount: 4500,
        deliveryAddress: "12 Test Ave",
        user: {
          id: "user_1",
          name: "Test User",
          phone: "+2348000000000",
        },
        items: [],
      })
      .mockResolvedValueOnce({
        id: "ord_1",
        vendorId: "vendor_1",
        status: "PENDING",
        paymentReference: "pay_ref_1",
        totalAmount: 4500,
        deliveryAddress: "12 Test Ave",
        user: {
          id: "user_1",
          name: "Test User",
          phone: "+2348000000000",
        },
        items: [],
      });

    prisma.Order.update.mockResolvedValue({
      id: "ord_1",
      vendorId: "vendor_1",
      status: "PENDING",
      paymentReference: "pay_ref_1",
      totalAmount: 4500,
      deliveryAddress: "12 Test Ave",
      acceptanceDeadline: new Date(),
      user: {
        id: "user_1",
        name: "Test User",
        phone: "+2348000000000",
      },
      items: [],
    });

    const payload = {
      event: "charge.success",
      data: {
        reference: "pay_ref_1",
        amount: 450000,
        metadata: {
          orderId: "ord_1",
        },
      },
    };

    const firstResponse = await server.request("/paystack", {
      method: "POST",
      headers: {
        "x-paystack-signature": "valid-signature",
      },
      body: JSON.stringify(payload),
    });

    const secondResponse = await server.request("/paystack", {
      method: "POST",
      headers: {
        "x-paystack-signature": "valid-signature",
      },
      body: JSON.stringify(payload),
    });

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(prisma.Order.update).toHaveBeenCalledTimes(1);
    expect(prisma.WebhookLog.create).toHaveBeenCalledTimes(2);
    expect(prisma.WebhookLog.update).toHaveBeenCalledTimes(2);
    expect(verifyWebhookSignature).toHaveBeenCalledTimes(2);
    expect(io.to).toHaveBeenCalledWith("vendor:vendor_1");
  });

  it("rejects invalid webhook signatures", async () => {
    verifyWebhookSignature.mockReturnValueOnce(false);

    const response = await server.request("/paystack", {
      method: "POST",
      headers: {
        "x-paystack-signature": "bad-signature",
      },
      body: JSON.stringify({
        event: "charge.success",
        data: {},
      }),
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      message: "Invalid webhook signature",
    });
    expect(prisma.WebhookLog.create).not.toHaveBeenCalled();
  });

  it("records processing failure when payment amount does not match", async () => {
    prisma.WebhookLog.create.mockResolvedValue({ id: "log_mismatch" });
    prisma.Order.findUnique.mockResolvedValue({
      id: "ord_mismatch",
      vendorId: "vendor_2",
      status: "UNPAID",
      paymentReference: "pay_ref_mismatch",
      totalAmount: 4500,
      deliveryAddress: "Mismatch Street",
      user: {
        id: "user_2",
        name: "Mismatch User",
        phone: "+2348111111111",
      },
      items: [],
    });

    const response = await server.request("/paystack", {
      method: "POST",
      headers: {
        "x-paystack-signature": "valid-signature",
      },
      body: JSON.stringify({
        event: "charge.success",
        data: {
          reference: "pay_ref_mismatch",
          amount: 999,
          metadata: {
            orderId: "ord_mismatch",
          },
        },
      }),
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain("Payment amount mismatch");
    expect(prisma.WebhookLog.update).toHaveBeenCalledWith({
      where: { id: "log_mismatch" },
      data: {
        processed: false,
        error: expect.stringContaining("Payment amount mismatch"),
      },
    });
    expect(prisma.Order.update).not.toHaveBeenCalled();
  });
});
