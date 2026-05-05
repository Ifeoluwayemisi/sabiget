// Auth Routes - OTP, Login, Token Refresh
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const memberAuthController = require("../controllers/memberAuthController");
const { otpLimiter, loginLimiter } = require("../middleware/rateLimiter");
const { authenticateToken } = require("../middleware/auth");

/**
 * POST /api/v1/auth/send-otp
 * Send OTP to user's phone (WhatsApp or SMS)
 * Body: { phone: "+2348123456789" }
 */
router.post("/send-otp", otpLimiter, authController.sendOTP);

/**
 * POST /api/v1/auth/verify-otp
 * Verify OTP and issue JWT tokens
 * Body: { phone: "+2348123456789", code: "482917" }
 */
router.post("/verify-otp", loginLimiter, authController.verifyOTP);

/**
 * POST /api/v1/auth/create-account
 * Convert GUEST user to MEMBER with password
 * Body: { phone: "+2348123456789", password: "securePass123", name: "John", email: "john@example.com" }
 */
router.post(
  "/create-account",
  loginLimiter,
  memberAuthController.createAccount,
);

/**
 * POST /api/v1/auth/login
 * Login with phone and password (MEMBER only)
 * Body: { phone: "+2348123456789", password: "securePass123" }
 */
router.post("/login", loginLimiter, memberAuthController.login);

/**
 * POST /api/v1/auth/refresh-token
 * Get new access token using refresh token
 * Body: { refreshToken: "eyJ..." }
 */
router.post("/refresh-token", authController.refreshAccessToken);

/**
 * POST /api/v1/auth/logout
 * Clear tokens and revoke refresh token
 * Headers: { Authorization: "Bearer accessToken" }
 * Body: { refreshToken: "eyJ..." }
 */
router.post("/logout", authenticateToken, authController.logout);

/**
 * GET /api/v1/auth/me
 * Get current authenticated user
 * Headers: { Authorization: "Bearer accessToken" }
 */
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const prisma = global.prisma;
    const user = await prisma.User.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        phone: true,
        email: true,
        name: true,
        role: true,
        loyaltyPoints: true,
        orderCount: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
