// ============================================
// Auth Controller - Request Handlers
// ============================================

import { sendOTPService, verifyOTPService } from "../services/authService.js";
import { generateAccessToken, verifyRefreshToken } from "../utils/jwt.js";
import config from "../config.js";

const getPrisma = () => global.prisma;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/v1/auth/send-otp
 * Send OTP to a customer (WhatsApp first; email fallback).
 * Body: { phone: "+2348123456789", email?: "user@example.com" }
 */
export async function sendOTP(req, res) {
  try {
    const { phone, email } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    const phoneRegex = /^(\+234|0)[789]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Nigerian phone number",
        example: "+2348123456789",
      });
    }

    if (email !== undefined && email !== null && email !== "") {
      if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email address",
        });
      }
    }

    const result = await sendOTPService(phone, email || null);

    if (result.success) {
      const hintByChannel = {
        WHATSAPP: "Check your WhatsApp for your verification code.",
        EMAIL: "Check your email for your verification code.",
        CONSOLE: "Verification code printed to the server console (development mode).",
      };

      return res.status(200).json({
        success: true,
        message: result.message,
        channel: result.channel,
        mode: result.mode,
        otpId: result.otpId,
        expiresIn: `${config.otp.expiryMinutes} minutes`,
        hint: hintByChannel[result.channel] || "Check your WhatsApp or email.",
      });
    }

    return res.status(400).json(result);
  } catch (error) {
    console.error("[Auth Controller] Send OTP error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send OTP",
      error: error.message,
    });
  }
}

/**
 * POST /api/v1/auth/verify-otp
 * Verify OTP and issue JWT tokens
 */
export async function verifyOTP(req, res) {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({
        success: false,
        message: "Phone and OTP code are required",
      });
    }

    const result = await verifyOTPService(phone, code);

    if (!result.success) {
      return res.status(401).json(result);
    }

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
}

/**
 * POST /api/v1/auth/refresh-token
 * Get new access token using refresh token
 */
export async function refreshAccessToken(req, res) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: "Refresh token is required",
      });
    }

    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    const storedToken = await getPrisma().RefreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    if (storedToken.userId !== decoded.userId) {
      return res.status(401).json({
        success: false,
        message: "Refresh token user mismatch",
      });
    }

    if (storedToken.revokedAt) {
      return res.status(401).json({
        success: false,
        message: "Refresh token has been revoked",
      });
    }

    if (new Date() > new Date(storedToken.expiresAt)) {
      return res.status(401).json({
        success: false,
        message: "Refresh token expired",
      });
    }

    const newAccessToken = generateAccessToken(
      storedToken.user.id,
      storedToken.user.role,
    );

    return res.status(200).json({
      success: true,
      message: "Access token refreshed",
      accessToken: newAccessToken,
      expiresIn: "15 minutes",
    });
  } catch (error) {
    console.error("[Auth Controller] Refresh token error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to refresh token",
      error: error.message,
    });
  }
}

/**
 * POST /api/v1/auth/logout
 * Logout user (revoke refresh token)
 */
export async function logout(req, res) {
  try {
    const { refreshToken } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    if (refreshToken) {
      await getPrisma().RefreshToken.updateMany({
        where: {
          token: refreshToken,
          userId,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    } else {
      await getPrisma().RefreshToken.updateMany({
        where: {
          userId,
          revokedAt: null,
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
}
