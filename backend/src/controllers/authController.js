// ============================================
// Auth Controller - Request Handlers
// ============================================

const { sendOTPService, verifyOTPService } = require("../services/authService");
const { generateAccessToken, verifyRefreshToken } = require("../utils/jwt");
const prisma = global.prisma;

/**
 * POST /api/v1/auth/send-otp
 * Send OTP to customer's phone via WhatsApp/SMS
 */
exports.sendOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    // Validate phone
    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    // Validate phone format (Nigerian format: +234 or 0)
    const phoneRegex = /^(\+234|0)[789]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Nigerian phone number",
        example: "+2348123456789",
      });
    }

    // Send OTP
    const result = await sendOTPService(phone);

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: result.message,
        channel: result.channel,
        otpId: result.otpId,
        expiresIn: "10 minutes",
        hint: "Check your WhatsApp first, SMS will arrive if WhatsApp fails",
      });
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error("[Auth Controller] Send OTP error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send OTP",
      error: error.message,
    });
  }
};

/**
 * POST /api/v1/auth/verify-otp
 * Verify OTP and issue JWT tokens
 */
exports.verifyOTP = async (req, res) => {
  try {
    const { phone, code } = req.body;

    // Validate inputs
    if (!phone || !code) {
      return res.status(400).json({
        success: false,
        message: "Phone and OTP code are required",
      });
    }

    // Verify OTP
    const result = await verifyOTPService(phone, code);

    if (!result.success) {
      return res.status(401).json(result);
    }

    // Return success with tokens
    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      user: result.user,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      expiresIn: "15 minutes",
      refreshExpiresIn: "7 days",
    });
  } catch (error) {
    console.error("[Auth Controller] Verify OTP error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify OTP",
      error: error.message,
    });
  }
};

/**
 * POST /api/v1/auth/refresh-token
 * Get new access token using refresh token
 */
exports.refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: "Refresh token is required",
      });
    }

    // Verify refresh token (signature + expiry)
    const decoded = verifyRefreshToken(refreshToken);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    // Verify user still exists
    const user = await prisma.User.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Generate new access token
    const newAccessToken = generateAccessToken(user.id, user.role);

    return res.status(200).json({
      success: true,
      message: "Access token refreshed",
      accessToken: newAccessToken,
      expiresIn: "15 minutes",
    });
  } catch (error) {
    console.error("[Auth Controller] Refresh token error:", error);
    return res.status(401).json({
      success: false,
      message: "Failed to refresh token",
      error: error.message,
    });
  }
};

/**
 * POST /api/v1/auth/logout
 * Logout user (client-side JWT discard)
 */
exports.logout = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    // With JWT, logout is client-side (discard tokens)
    // Optionally log the action for audit purposes
    console.log(`[Auth] User ${userId} logged out at ${new Date().toISOString()}`);

    return res.status(200).json({
      success: true,
      message: "Logged out successfully. Please discard your tokens on the client.",
    });
  } catch (error) {
    console.error("[Auth Controller] Logout error:", error);

/**
 * POST /api/v1/auth/refresh-token
 * Get new access token using refresh token
 */
exports.refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: "Refresh token is required",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to logout",
      error: error.message,
    });
  }
};
