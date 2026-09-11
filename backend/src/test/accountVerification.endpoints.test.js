import { afterAll, afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

// Endpoint tests for vendor payment account verification and Paystack
// sub-account setup hardening (MVP Item 2.1): the verify endpoint must only
// resolve the account name (never create a subaccount or touch vendor state),
// and payment-setup must refuse to mint additional subaccounts.
let mockCurrentUser;

const createSubAccount = jest.fn();
const resolveAccountNumber = jest.fn();

await jest.unstable_mockModule("../middleware/auth.js", () => ({
  authenticateToken: (req, res, next) => {
    if (mockCurrentUser === "UNAUTHENTICATED") {
      return res.status(401).json({ error: "Not authenticated" });
    }
    req.user = mockCurrentUser;
    next();
  },
  optionalAuth: (req, res, next) => {
    req.user = mockCurrentUser;
    next();
  },
  authorize:
    (...roles) =>
    (req, res, next) => {
      if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }
      next();
    },
}));

await jest.unstable_mockModule("../utils/paystack.js", () => ({
  createSubAccount,
  resolveAccountNumber,
}));

const { startTestServer } = await import("./startTestServer.js");
const vendorRouter = (await import("../routes/vendorRoutes.js")).default;

describe("vendor payment account verification + setup protection", () => {
  let server;
  let prisma;

  beforeEach(async () => {
    mockCurrentUser = { userId: "vendor_user_1", role: "VENDOR" };
    prisma = {
      Vendor: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
      Product: {
        findMany: jest.fn(),
      },
      User: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      Order: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
        groupBy: jest.fn(),
      },
    };
    global.prisma = prisma;
    jest.clearAllMocks();
    server = await startTestServer(vendorRouter);
  });

  afterEach(async () => {
    await server.close();
  });

  afterAll(() => {
    delete global.prisma;
  });

  // ---- Verification: POST /payment-account/verify -------------------------

  it("requires bank account and bank code for verification", async () => {
    const missingAccount = await server.request("/payment-account/verify", {
      method: "POST",
      body: JSON.stringify({ bankCode: "044" }),
    });
    expect(missingAccount.status).toBe(400);
    expect(missingAccount.body.error).toBe(
      "Bank account and bank code are required",
    );

    const missingCode = await server.request("/payment-account/verify", {
      method: "POST",
      body: JSON.stringify({ bankAccount: "0000000000" }),
    });
    expect(missingCode.status).toBe(400);
    expect(missingCode.body.error).toBe(
      "Bank account and bank code are required",
    );
  });

  it("resolves the registered account name for a valid account", async () => {
    resolveAccountNumber.mockResolvedValue({
      success: true,
      data: { accountName: "JOHN DOE" },
    });

    const response = await server.request("/payment-account/verify", {
      method: "POST",
      body: JSON.stringify({ bankAccount: "0000000000", bankCode: "044" }),
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, accountName: "JOHN DOE" });
    expect(resolveAccountNumber).toHaveBeenCalledWith("0000000000", "044");
  });

  it("returns a safe failure for an invalid account without touching vendor state", async () => {
    resolveAccountNumber.mockResolvedValue({ success: false, error: "resolve failed" });

    const response = await server.request("/payment-account/verify", {
      method: "POST",
      body: JSON.stringify({ bankAccount: "0123456789", bankCode: "058" }),
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error:
        "We couldn't verify this account. Check the bank and account number and try again.",
    });
    expect(response.body.details).toBeUndefined();
    expect(resolveAccountNumber).toHaveBeenCalledWith("0123456789", "058");
    // Verification must never create a subaccount or modify vendor state.
    expect(createSubAccount).not.toHaveBeenCalled();
    expect(prisma.Vendor.update).not.toHaveBeenCalled();
    expect(prisma.Vendor.updateMany).not.toHaveBeenCalled();
  });

  it("returns 401 for an unauthenticated verification request", async () => {
    mockCurrentUser = "UNAUTHENTICATED";
    const response = await server.request("/payment-account/verify", {
      method: "POST",
      body: JSON.stringify({ bankAccount: "0000000000", bankCode: "044" }),
    });

    expect(response.status).toBe(401);
  });

  // ---- Setup: PATCH /payment-setup (duplicate-subaccount protection) -------

  it("requires bank account and bank code for setup", async () => {
    const response = await server.request("/payment-setup", {
      method: "PATCH",
      body: JSON.stringify({ bankAccount: "0000000000" }),
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Bank account and bank code are required");
  });

  it("persists a Paystack subaccount after a successful verified setup", async () => {
    prisma.Vendor.findUnique
      .mockResolvedValueOnce({
        id: "vendor_1",
        userId: "vendor_user_1",
        name: "Food Place",
        email: "food@example.com",
        phone: "+2348000000000",
        paystackSubcode: null,
      })
      .mockResolvedValueOnce({
        id: "vendor_1",
        name: "Food Place",
        paystackSubcode: "ACCT_VERIFIED",
        bankAccount: "0000000000",
        bankCode: "044",
      });
    createSubAccount.mockResolvedValue({
      success: true,
      data: { subaccount_code: "ACCT_VERIFIED" },
    });
    prisma.Vendor.updateMany.mockResolvedValue({ count: 1 });

    const response = await server.request("/payment-setup", {
      method: "PATCH",
      body: JSON.stringify({ bankAccount: "0000000000", bankCode: "044" }),
    });

    expect(response.status).toBe(200);
    expect(createSubAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        accountNumber: "0000000000",
        bankCode: "044",
      }),
    );
    expect(prisma.Vendor.updateMany).toHaveBeenCalledWith({
      where: { id: "vendor_1", paystackSubcode: null },
      data: {
        bankAccount: "0000000000",
        bankCode: "044",
        paystackSubcode: "ACCT_VERIFIED",
      },
    });
    expect(response.body.success).toBe(true);
    expect(response.body.vendor.paystackSubcode).toBe("ACCT_VERIFIED");
  });

  it("rejects repeated setup for an already-configured vendor", async () => {
    prisma.Vendor.findUnique.mockResolvedValueOnce({
      id: "vendor_2",
      userId: "vendor_user_1",
      name: "Food Place",
      paystackSubcode: "ACCT_EXISTING",
    });

    const response = await server.request("/payment-setup", {
      method: "PATCH",
      body: JSON.stringify({ bankAccount: "0000000000", bankCode: "044" }),
    });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe(
      "Vendor payment account is already configured",
    );
    expect(createSubAccount).not.toHaveBeenCalled();
  });

  it("does not overwrite when a concurrent setup wins the claim", async () => {
    prisma.Vendor.findUnique
      .mockResolvedValueOnce({
        id: "vendor_3",
        userId: "vendor_user_1",
        name: "Food Place",
        paystackSubcode: null,
      })
      .mockResolvedValueOnce({
        id: "vendor_3",
        paystackSubcode: "ACCT_WINNER",
      });
    createSubAccount.mockResolvedValue({
      success: true,
      data: { subaccount_code: "ACCT_LOSER" },
    });
    prisma.Vendor.updateMany.mockResolvedValue({ count: 0 });

    const response = await server.request("/payment-setup", {
      method: "PATCH",
      body: JSON.stringify({ bankAccount: "0000000000", bankCode: "044" }),
    });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe(
      "Vendor payment account is already configured",
    );
    expect(response.body.vendor.paystackSubcode).toBe("ACCT_WINNER");
  });

  it("does not mark vendor configured when Paystack setup fails", async () => {
    prisma.Vendor.findUnique.mockResolvedValue({
      id: "vendor_4",
      userId: "vendor_user_1",
      name: "Food Place",
      paystackSubcode: null,
    });
    createSubAccount.mockResolvedValue({ success: false, error: "provider error" });

    const response = await server.request("/payment-setup", {
      method: "PATCH",
      body: JSON.stringify({ bankAccount: "0000000000", bankCode: "044" }),
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Failed to create Paystack sub-account");
    expect(response.body.success).toBe(false);
    expect(prisma.Vendor.updateMany).not.toHaveBeenCalled();
    // The vendor must remain unconfigured (retryable, not falsely Connected).
    expect(prisma.Vendor.update).not.toHaveBeenCalled();
  });
});