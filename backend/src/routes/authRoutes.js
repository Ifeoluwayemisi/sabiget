// Auth Routes - OTP, Login, Token Refresh
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const memberAuthController = require("../controllers/memberAuthController");
const { otpLimiter, loginLimiter } = require("../middleware/rateLimiter");
const { authenticateToken } = require("../middleware/auth");

// ============================================
// GUEST/OTP AUTHENTICATION
// ============================================

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

// ============================================
// TOKEN MANAGEMENT
// ============================================

/**
 * POST /api/v1/auth/refresh-token
 * Get new access token using refresh token
 * Body: { refreshToken: "eyJ..." }
 */
router.post("/refresh-token", authController.refreshAccessToken);

/**
 * POST /api/v1/auth/logout
 * Logout user (client-side JWT discard)
 * Headers: { Authorization: "Bearer accessToken" }
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

// ============================================
// MEMBER AUTHENTICATION
// ============================================

/**
 * POST /api/v1/auth/member/create-account
 * Convert GUEST to MEMBER by setting password
 * Body: { email: "user@example.com", name: "John Doe", password: "securePass123" }
 * Headers: { Authorization: "Bearer accessToken" }
 */
router.post("/member/create-account", authenticateToken, memberAuthController.createAccount);

/**
 * POST /api/v1/auth/member/login
 * Member login with phone and password
 * Body: { phone: "+2348123456789", password: "securePass123" }
 */
router.post("/member/login", loginLimiter, memberAuthController.memberLogin);

/**
 * POST /api/v1/auth/member/change-password
 * Change password for authenticated member
 * Body: { oldPassword: "current123", newPassword: "newSecure456" }
 * Headers: { Authorization: "Bearer accessToken" }
 */
router.post("/member/change-password", authenticateToken, memberAuthController.changePassword);

/**
 * POST /api/v1/auth/member/forgot-password/initiate
 * Initiate password reset flow (send OTP)
 * Body: { phone: "+2348123456789" }
 */
router.post("/member/forgot-password/initiate", otpLimiter, memberAuthController.forgotPasswordInitiate);

/**
 * POST /api/v1/auth/member/forgot-password/reset
 * Complete password reset (verify OTP and set new password)
 * Body: { phone: "+2348123456789", code: "482917", newPassword: "newSecure456" }
 */
router.post("/member/forgot-password/reset", loginLimiter, memberAuthController.forgotPasswordReset);

module.exports = router;
