import { afterAll, afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

let mockCurrentUser;

const sendOTPService = jest.fn();
const verifyOTPService = jest.fn();
const createMemberAccountService = jest.fn();
const loginService = jest.fn();
const verifyRefreshToken = jest.fn();
const generateAccessToken = jest.fn(() => "new_access_token");
const generateTokenPair = jest.fn(() => ({
  accessToken: "new_access_token",
  refreshToken: "new_refresh_token",
}));

await jest.unstable_mockModule("../middleware/auth.js", () => ({
  authenticateToken: (req, res, next) => {
    req.user = mockCurrentUser;
    next();
  },
}));

await jest.unstable_mockModule("../middleware/rateLimiter.js", () => ({
  otpLimiter: (req, res, next) => next(),
  loginLimiter: (req, res, next) => next(),
}));

await jest.unstable_mockModule("../services/authService.js", () => ({
  sendOTPService,
  verifyOTPService,
}));

await jest.unstable_mockModule("../services/memberAuthService.js", () => ({
  createMemberAccountService,
  loginService,
}));

await jest.unstable_mockModule("../utils/jwt.js", () => ({
  verifyRefreshToken,
  generateAccessToken,
  generateTokenPair,
}));

const { startTestServer } = await import("./startTestServer.js");
const authRouter = (await import("../routes/authRoutes.js")).default;

describe("auth endpoint verification", () => {
  let server;
  let prisma;

  beforeEach(async () => {
    mockCurrentUser = { userId: "user_1", id: "user_1", role: "MEMBER" };
    prisma = {
      User: {
        findUnique: jest.fn(),
      },
      RefreshToken: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
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

  it("sends otp", async () => {
    sendOTPService.mockResolvedValue({
      success: true,
      message: "OTP sent via WhatsApp",
      channel: "WHATSAPP",
      otpId: "otp_1",
    });

    const response = await server.request("/send-otp", {
      method: "POST",
      body: JSON.stringify({ phone: "+2348123456789" }),
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(sendOTPService).toHaveBeenCalledWith("+2348123456789", null);
  });

  it("sends otp with an optional email fallback address", async () => {
    sendOTPService.mockResolvedValue({
      success: true,
      message: "OTP sent via Email",
      channel: "EMAIL",
      otpId: "otp_2",
    });

    const response = await server.request("/send-otp", {
      method: "POST",
      body: JSON.stringify({
        phone: "+2348123456789",
        email: "user@example.com",
      }),
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(sendOTPService).toHaveBeenCalledWith(
      "+2348123456789",
      "user@example.com",
    );
  });

  it("rejects an invalid optional email address", async () => {
    const response = await server.request("/send-otp", {
      method: "POST",
      body: JSON.stringify({
        phone: "+2348123456789",
        email: "not-an-email",
      }),
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Invalid email address");
    expect(sendOTPService).not.toHaveBeenCalled();
  });

  it("verifies otp and returns tokens", async () => {
    verifyOTPService.mockResolvedValue({
      success: true,
      user: { id: "user_1", role: "GUEST" },
      tokens: { accessToken: "access", refreshToken: "refresh" },
    });

    const response = await server.request("/verify-otp", {
      method: "POST",
      body: JSON.stringify({ phone: "+2348123456789", code: "123456" }),
    });

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toBe("access");
  });

  it("creates member account", async () => {
    createMemberAccountService.mockResolvedValue({
      success: true,
      message: "Account created successfully",
      user: { id: "user_1", role: "MEMBER" },
      tokens: { accessToken: "access", refreshToken: "refresh" },
    });

    const response = await server.request("/create-account", {
      method: "POST",
      body: JSON.stringify({
        password: "securePass123",
        name: "Ada",
        email: "ada@example.com",
      }),
    });

    expect(response.status).toBe(201);
    expect(createMemberAccountService).toHaveBeenCalledWith({
      userId: "user_1",
      password: "securePass123",
      name: "Ada",
      email: "ada@example.com",
    });
  });

  it("logs in member", async () => {
    loginService.mockResolvedValue({
      success: true,
      message: "Login successful",
      user: { id: "user_1", role: "MEMBER" },
      tokens: { accessToken: "access", refreshToken: "refresh" },
    });

    const response = await server.request("/login", {
      method: "POST",
      body: JSON.stringify({
        phone: "+2348123456789",
        password: "securePass123",
      }),
    });

    expect(response.status).toBe(200);
    expect(response.body.refreshToken).toBe("refresh");
  });

  it("refreshes access token", async () => {
    verifyRefreshToken.mockReturnValue({ userId: "user_1" });
    prisma.RefreshToken.findUnique.mockResolvedValue({
      token: "refresh",
      userId: "user_1",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: "user_1", role: "MEMBER" },
    });

    const response = await server.request("/refresh-token", {
      method: "POST",
      body: JSON.stringify({ refreshToken: "refresh" }),
    });

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toBe("new_access_token");
  });

  it("logs out authenticated user", async () => {
    const response = await server.request("/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken: "refresh" }),
    });

    expect(response.status).toBe(200);
    expect(prisma.RefreshToken.updateMany).toHaveBeenCalled();
  });

  it("returns current user profile", async () => {
    prisma.User.findUnique.mockResolvedValue({
      id: "user_1",
      phone: "+2348123456789",
      email: "ada@example.com",
      name: "Ada",
      role: "MEMBER",
      loyaltyPoints: 50,
      orderCount: 2,
      createdAt: "2026-05-11T00:00:00.000Z",
    });

    const response = await server.request("/me", {
      method: "GET",
    });

    expect(response.status).toBe(200);
    expect(response.body.user.id).toBe("user_1");
  });
});
