// Auth Routes - OTP, Login, Token Refresh
const express = require("express");
const router = express.Router();
const { otpLimiter, loginLimiter } = require("../middleware/rateLimiter");
const { authenticateToken } = require("../middleware/auth");

/**
 * POST /api/auth/send-otp
 * Send OTP to user's phone (WhatsApp or SMS)
 */
router.post("/send-otp", otpLimiter, async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ error: "Phone number required" });
    }

    // TODO: Implement OTP generation and sending via Termii
    res.json({
      message: "OTP sent to your phone",
      phone,
      info: "Implementation pending",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auth/verify-otp
 * Verify OTP and issue JWT tokens
 */
router.post("/verify-otp", loginLimiter, async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ error: "Phone and OTP required" });
    }

    // TODO: Implement OTP verification and token generation
    res.json({
      message: "OTP verified",
      phone,
      info: "Implementation pending",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auth/refresh-token
 * Get new access token using refresh token
 */
router.post("/refresh-token", async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ error: "No refresh token" });
    }

    // TODO: Implement token refresh logic
    res.json({
      message: "Token refreshed",
      info: "Implementation pending",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auth/logout
 * Clear tokens
 */
router.post("/logout", authenticateToken, async (req, res) => {
  try {
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get("/me", authenticateToken, async (req, res) => {
  try {
    // TODO: Fetch user details from database
    res.json({
      user: req.user,
      info: "Implementation pending",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
