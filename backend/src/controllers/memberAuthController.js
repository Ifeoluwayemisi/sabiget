// ============================================
// Member Auth Controller - Request Handlers
// ============================================

const {
  createMemberAccountService,
  loginService,
} = require("../services/memberAuthService");

/**
 * POST /api/v1/auth/create-account
 * Convert GUEST user to MEMBER by setting password
 * Body: { phone: "+2348123456789", password: "securePassword", name: "John Doe", email: "john@example.com" }
 */
exports.createAccount = async (req, res) => {
  try {
    const { phone, password, name, email } = req.body;

    // Validate required fields
    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Phone and password are required",
      });
    }

    // Validate phone format
    const phoneRegex = /^(\+234|0)[789]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Nigerian phone number",
        example: "+2348123456789",
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    // Validate email format (optional but validate if provided)
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email format",
        });
      }
    }

    // Create account
    const result = await createMemberAccountService(
      null, // userId not needed, phone lookup
      phone,
      password,
      name,
      email,
    );

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
};

/**
 * POST /api/v1/auth/login
 * Login with phone and password (MEMBER only)
 * Body: { phone: "+2348123456789", password: "securePassword" }
 */
exports.login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    // Validate required fields
    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Phone and password are required",
      });
    }

    // Validate phone format
    const phoneRegex = /^(\+234|0)[789]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Nigerian phone number",
        example: "+2348123456789",
      });
    }

    // Login
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
};

module.exports = {
  createAccount: exports.createAccount,
  login: exports.login,
};
