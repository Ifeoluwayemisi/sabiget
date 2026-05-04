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
 * Logout user (revoke refresh token)
 */
exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const userId = req.user?.id; // Assuming user ID is added by auth middleware

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    if (refreshToken) {
      // Revoke refresh token
      await prisma.RefreshToken.updateMany({
        where: {
          token: refreshToken,
          userId,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("[Auth Controller] Logout error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to logout",
      error: error.message,
    });
  }
};

/**
 * POST /api/v1/auth/login
 * Password-based login (Email/Phone + Password)
 */
const { verifyPassword } = require("../utils/password");
exports.login = async (req, res) => {
  try {
    const { phone, email, password } = req.body;

    if (!password || (!phone && !email)) {
      return res.status(400).json({
        success: false,
        message: "Phone or Email, and password are required",
      });
    }

    // Find user
    const user = await prisma.User.findFirst({
      where: phone ? { phone } : { email },
    });

    if (!user || !user.password) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Generate JWT tokens
    const { generateTokenPair } = require("../utils/jwt");
    const { accessToken, refreshToken } = generateTokenPair(user);

    // Save refresh token to database
    await prisma.RefreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    user.password = undefined; // Don't send password hash
    
    return res.status(200).json({
      success: true,
      message: "Logged in successfully",
      user,
      accessToken,
      refreshToken,
      expiresIn: "15 minutes",
      refreshExpiresIn: "7 days",
    });
  } catch (error) {
    console.error("[Auth Controller] Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to login",
      error: error.message,
    });
  }
};
