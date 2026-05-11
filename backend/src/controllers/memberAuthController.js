// ============================================
// Member Auth Controller - Request Handlers
// ============================================

import {
  createMemberAccountService,
  loginService,
} from "../services/memberAuthService.js";

/**
 * POST /api/v1/auth/create-account
 * Convert authenticated GUEST user to MEMBER by setting password
 * Body: { password: "securePassword", name: "John Doe", email: "john@example.com" }
 */
export async function createAccount(req, res) {
  try {
    const { password, name, email } = req.body;
    const userId = req.user?.userId;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required",
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Authenticated user is required",
      });
    }

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email format",
        });
      }
    }

    const result = await createMemberAccountService({
      userId,
      password,
      name,
      email,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(201).json({
      success: true,
      message: result.message,
      user: result.user,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      expiresIn: "15 minutes",
      refreshExpiresIn: "7 days",
    });
  } catch (error) {
    console.error("[Member Auth Controller] Create account error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create account",
      error: error.message,
    });
  }
}

/**
 * POST /api/v1/auth/login
 * Login with phone and password (MEMBER only)
 * Body: { phone: "+2348123456789", password: "securePassword" }
 */
export async function login(req, res) {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Phone and password are required",
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

    const result = await loginService(phone, password);

    if (!result.success) {
      return res.status(401).json(result);
    }

    return res.status(200).json({
      success: true,
      message: result.message,
      user: result.user,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      expiresIn: "15 minutes",
      refreshExpiresIn: "7 days",
    });
  } catch (error) {
    console.error("[Member Auth Controller] Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to login",
      error: error.message,
    });
  }
}
