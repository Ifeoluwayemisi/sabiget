jest.mock("../services/authService", () => ({
  sendOTPService: jest.fn(),
  verifyOTPService: jest.fn(),
}));

jest.mock("../utils/jwt", () => ({
  generateAccessToken: jest.fn(() => "new_access_token"),
  verifyRefreshToken: jest.fn(),
}));

const { sendOTPService, verifyOTPService } = require("../services/authService");
const { verifyRefreshToken } = require("../utils/jwt");
const authController = require("./authController");

function createRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

describe("authController", () => {
  beforeEach(() => {
    global.prisma = {
      RefreshToken: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    jest.clearAllMocks();
  });

  afterAll(() => {
    delete global.prisma;
  });

  it("rejects invalid Nigerian phone numbers for OTP send", async () => {
    const req = {
      body: { phone: "123" },
    };
    const res = createRes();

    await authController.sendOTP(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Invalid Nigerian phone number",
      example: "+2348123456789",
    });
    expect(sendOTPService).not.toHaveBeenCalled();
  });

  it("returns tokens when OTP verification succeeds", async () => {
    verifyOTPService.mockResolvedValue({
      success: true,
      user: { id: "user_1", phone: "+2348000000000", role: "GUEST" },
      tokens: {
        accessToken: "access_token",
        refreshToken: "refresh_token",
      },
    });

    const req = {
      body: { phone: "+2348000000000", code: "123456" },
    };
    const res = createRes();

    await authController.verifyOTP(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "OTP verified successfully",
      user: { id: "user_1", phone: "+2348000000000", role: "GUEST" },
      accessToken: "access_token",
      refreshToken: "refresh_token",
      expiresIn: "15 minutes",
      refreshExpiresIn: "7 days",
    });
  });

  it("rejects refresh when the token is revoked", async () => {
    verifyRefreshToken.mockReturnValue({
      userId: "user_2",
    });
    global.prisma.RefreshToken.findUnique.mockResolvedValue({
      token: "refresh_token",
      userId: "user_2",
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: "user_2",
        role: "MEMBER",
      },
    });

    const req = {
      body: { refreshToken: "refresh_token" },
    };
    const res = createRes();

    await authController.refreshAccessToken(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Refresh token has been revoked",
    });
  });

  it("revokes all active refresh tokens when logout is called without a specific token", async () => {
    const req = {
      body: {},
      user: { userId: "user_3" },
    };
    const res = createRes();

    await authController.logout(req, res);

    expect(global.prisma.RefreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user_3",
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
