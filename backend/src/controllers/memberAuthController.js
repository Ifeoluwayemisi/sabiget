// ============================================
// Member Auth Controller - Request Handlers
// ============================================

const {
  createAccountService,
  memberLoginService,
  changePasswordService,
  forgotPasswordInitiateService,
  forgotPasswordResetService,
} = require("../services/memberAuthService");

/**
 * POST /api/v1/auth/member/create-account
 * Convert GUEST user to MEMBER by setting password
 * Body: { email, name, password }
 * Headers: { Authorization: "Bearer accessToken" }
 */
exports.createAccount = async (req, res) => {
  try {
    const { email, name, password } = req.body;
    const userId = req.user?.id;

    // Validate authentication
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Must be logged in (OTP) first",
      });
    }

    // Validate password
    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required",
      });
    }

    // Password strength validation
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    // Validate email format if provided
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
    const result = await createAccountService(userId, email, name, password);

    if (result.success) {
      return res.status(201).json({
        success: true,
        message: result.message,
        user: result.user,
      });
    } else {
      return res.status(400).json(result);
    }
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
 * POST /api/v1/auth/member/login
 * Login with phone and password
 * Body: { phone: "+2348123456789", password: "securePassword123" }
 */
exports.memberLogin = async (req, res) => {
  try {
    const { phone, password } = req.body;

    // Validate inputs
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

    // Perform login
    const result = await memberLoginService(phone, password);

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: result.message,
        user: result.user,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        expiresIn: "15 minutes",
        refreshExpiresIn: "7 days",
      });
    } else {
      return res.status(401).json(result);
    }
  } catch (error) {
    console.error("[Member Auth Controller] Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to login",
      error: error.message,
    });
  }
};

/**
 * POST /api/v1/auth/member/change-password
 * Change password for authenticated member
 * Body: { oldPassword: "current123", newPassword: "newSecure456" }
 * Headers: { Authorization: "Bearer accessToken" }
 */
exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user?.id;

    // Validate authentication
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Must be authenticated",
      });
    }

    // Validate inputs
    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Old and new password are required",
      });
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters",
      });
    }

    // Check that passwords are different
    if (oldPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from old password",
      });
    }

    // Change password
    const result = await changePasswordService(userId, oldPassword, newPassword);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error("[Member Auth Controller] Change password error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to change password",
      error: error.message,
    });
  }
};

/**
 * POST /api/v1/auth/member/forgot-password/initiate
 * Initiate password reset flow (send OTP)
 * Body: { phone: "+2348123456789" }
 */
exports.forgotPasswordInitiate = async (req, res) => {
  try {
    const { phone } = req.body;

    // Validate phone
    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
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

    // Send OTP
    const result = await forgotPasswordInitiateService(phone);

    return res.status(200).json(result);
  } catch (error) {
    console.error("[Member Auth Controller] Forgot password initiate error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to initiate password reset",
      error: error.message,
    });
  }
};

/**
 * POST /api/v1/auth/member/forgot-password/reset
 * Complete password reset (verify OTP and set new password)
 * Body: { phone: "+2348123456789", code: "482917", newPassword: "newSecure456" }
 */
exports.forgotPasswordReset = async (req, res) => {
  try {
    const { phone, code, newPassword } = req.body;

    // Validate inputs
    if (!phone || !code || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Phone, OTP code, and new password are required",
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

    // Validate new password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters",
      });
    }

    // Reset password
    const result = await forgotPasswordResetService(phone, code, newPassword);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error("[Member Auth Controller] Forgot password reset error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reset password",
      error: error.message,
    });
  }
};
