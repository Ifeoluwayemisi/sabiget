// Auth Routes - OTP, Login, Token Refresh
import express from "express";
import * as authController from "../controllers/authController.js";
import * as memberAuthController from "../controllers/memberAuthController.js";
import * as vendorAuthController from "../controllers/vendorAuthController.js";
import { otpLimiter, loginLimiter } from "../middleware/rateLimiter.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

/**
 * POST /api/v1/auth/send-otp
 * Send OTP to a customer (WhatsApp first; email fallback)
 * Body: { phone: "+2348123456789", email?: "user@example.com" }
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
 * Convert authenticated GUEST user to MEMBER with password
 * Headers: { Authorization: "Bearer accessToken" }
 * Body: { password: "securePass123", name: "John", email: "john@example.com" }
 */
router.post(
  "/create-account",
  authenticateToken,
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

/**
 * ============================================
 * VENDOR AUTHENTICATION ROUTES
 * ============================================
 */

/**
 * POST /api/v1/auth/vendor/signup
 * Register as vendor with business details
 * Body: { email, password, businessName, businessPhone, businessCategory }
 */
router.post("/vendor/signup", loginLimiter, vendorAuthController.vendorSignup);

/**
 * POST /api/v1/auth/vendor/login
 * Vendor login with email and password
 * Body: { email, password }
 */
router.post("/vendor/login", loginLimiter, vendorAuthController.vendorLogin);

export default router;
