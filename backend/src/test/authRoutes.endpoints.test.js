import { afterAll, afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

// Restored from a pre-ESM-migration CommonJS test file (see
// vendorRoutes.endpoints.test.js for context). Assertions unchanged.
// authController/memberAuthController are mocked wholesale here — their
// own real logic is exercised by authController.test.js and
// memberAuthController.test.js. Only /me (implemented inline in
// authRoutes.js) is under test in this file.

let mockCurrentUser;

await jest.unstable_mockModule("../middleware/auth.js", () => ({
  authenticateToken: (req, res, next) => {
    req.user = mockCurrentUser;
    next();
  },
}));

await jest.unstable_mockModule("../controllers/authController.js", () => ({
  sendOTP: jest.fn((req, res) => res.json({ mocked: "send-otp" })),
  verifyOTP: jest.fn((req, res) => res.json({ mocked: "verify-otp" })),
  refreshAccessToken: jest.fn((req, res) =>
    res.json({ mocked: "refresh-token" }),
  ),
  logout: jest.fn((req, res) => res.json({ mocked: "logout" })),
}));

await jest.unstable_mockModule("../controllers/memberAuthController.js", () => ({
  createAccount: jest.fn((req, res) => res.json({ mocked: "create-account" })),
  login: jest.fn((req, res) => res.json({ mocked: "member-login" })),
}));

await jest.unstable_mockModule("../middleware/rateLimiter.js", () => ({
  otpLimiter: (req, res, next) => next(),
  loginLimiter: (req, res, next) => next(),
}));

const { startTestServer } = await import("./startTestServer.js");
const authRouter = (await import("../routes/authRoutes.js")).default;

describe("authRoutes", () => {
  let server;
  let prisma;

  beforeEach(async () => {
    mockCurrentUser = { userId: "user_1", id: "user_1", role: "MEMBER" };
    prisma = {
      User: {
        findUnique: jest.fn(),
      },
    };
    global.prisma = prisma;
    jest.clearAllMocks();
    server = await startTestServer(authRouter);
  });

  afterEach(async () => {
    await server.close();
  });

  afterAll(() => {
    delete global.prisma;
  });

  it("returns the current authenticated user from /me", async () => {
    prisma.User.findUnique.mockResolvedValue({
      id: "user_1",
      phone: "+2348000000000",
      email: "user@example.com",
      name: "Ada",
      role: "MEMBER",
      loyaltyPoints: 100,
      orderCount: 2,
      createdAt: "2026-05-01T00:00:00.000Z",
    });

    const response = await server.request("/me", {
      method: "GET",
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.user.id).toBe("user_1");
  });

  it("returns 404 from /me when the user no longer exists", async () => {
    prisma.User.findUnique.mockResolvedValue(null);

    const response = await server.request("/me", {
      method: "GET",
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      message: "User not found",
    });
  });
});
