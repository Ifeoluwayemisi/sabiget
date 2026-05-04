// ============================================
// Member Auth Service - Business Logic
// ============================================

const { hashPassword, verifyPassword } = require("../utils/password");
const { generateTokenPair } = require("../utils/jwt");
const { sendOTPService, verifyOTPService } = require("./authService");

// Prisma will be available globally after app.js initializes
const getPrisma = () => global.prisma;

/**
 * Create Member Account - Convert GUEST to MEMBER
 * Guest user upgrades by setting password, email, and name
 */
const createAccountService = async (userId, email, name, password) => {
  try {
    // Find user (must be GUEST role)
    const user = await getPrisma().User.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return {
        success: false,
        error: "User not found",
      };
    }

    // Only allow GUEST users to upgrade
    if (user.role !== "GUEST") {
      return {
        success: false,
        error: `User already has role ${user.role}. Can only upgrade from GUEST.`,
      };
    }

    // Check if email already exists
    if (email) {
      const existingEmail = await getPrisma().User.findUnique({
        where: { email },
      });

      if (existingEmail && existingEmail.id !== userId) {
        return {
          success: false,
          error: "Email already in use",
        };
      }
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Update user to MEMBER
    const updatedUser = await getPrisma().User.update({
      where: { id: userId },
      data: {
        email: email || null,
        name: name || null,
        password: hashedPassword,
        role: "MEMBER",
        updatedAt: new Date(),
      },
    });

    console.log(`[Member Auth] User ${userId} upgraded to MEMBER`);

    return {
      success: true,
      message: "Account created successfully",
      user: {
        id: updatedUser.id,
        phone: updatedUser.phone,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
      },
    };
  } catch (error) {
    console.error("[Member Auth Service] Error creating account:", error.message);
    throw error;
  }
};

/**
 * Member Login - Phone + Password
 */
const memberLoginService = async (phone, password) => {
  try {
    // Find user by phone
    const user = await getPrisma().User.findUnique({
      where: { phone },
    });

    if (!user) {
      return {
        success: false,
        error: "Invalid phone or password",
      };
    }

    // Check if user is MEMBER (must have password)
    if (user.role !== "MEMBER") {
      return {
        success: false,
        error: `User has role ${user.role}. Please use OTP login for guest/non-member users.`,
      };
    }

    // Check if password is set
    if (!user.password) {
      return {
        success: false,
        error: "Password not set. Please set password first or use OTP login.",
      };
    }

    // Verify password
    const passwordMatch = await verifyPassword(password, user.password);

    if (!passwordMatch) {
      // Log failed attempt (optional: implement rate limiting)
      console.log(`[Member Auth] Failed login attempt for ${phone}`);
      return {
        success: false,
        error: "Invalid phone or password",
      };
    }

    // Update last login
    await getPrisma().User.update({
      where: { phone },
      data: { lastLoginAt: new Date() },
    });

    // Generate JWT tokens
    const { accessToken, refreshToken } = generateTokenPair(user);

    console.log(`[Member Auth] ✓ User ${phone} logged in successfully`);

    return {
      success: true,
      message: "Logged in successfully",
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        name: user.name,
        role: user.role,
        loyaltyPoints: user.loyaltyPoints,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  } catch (error) {
    console.error("[Member Auth Service] Error during login:", error.message);
    throw error;
  }
};

/**
 * Change Password - Member changes their password
 */
const changePasswordService = async (userId, oldPassword, newPassword) => {
  try {
    // Find user
    const user = await getPrisma().User.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return {
        success: false,
        error: "User not found",
      };
    }

    // Verify old password
    if (!user.password) {
      return {
        success: false,
        error: "No password set. Cannot change password.",
      };
    }

    const oldPasswordMatch = await verifyPassword(oldPassword, user.password);

    if (!oldPasswordMatch) {
      return {
        success: false,
        error: "Current password is incorrect",
      };
    }

    // Hash new password
    const hashedNewPassword = await hashPassword(newPassword);

    // Update password
    await getPrisma().User.update({
      where: { id: userId },
      data: {
        password: hashedNewPassword,
        updatedAt: new Date(),
      },
    });

    console.log(`[Member Auth] ✓ User ${userId} changed password`);

    return {
      success: true,
      message: "Password changed successfully",
    };
  } catch (error) {
    console.error("[Member Auth Service] Error changing password:", error.message);
    throw error;
  }
};

/**
 * Forgot Password Flow - Reset via OTP
 * Step 1: Send OTP to phone (same as guest OTP)
 * Step 2: Verify OTP and set new password
 */
const forgotPasswordInitiateService = async (phone) => {
  try {
    // Check if user exists
    const user = await getPrisma().User.findUnique({
      where: { phone },
    });

    if (!user) {
      // Return same response for security (don't reveal if user exists)
      return {
        success: true,
        message: "If account exists, OTP will be sent",
        channel: "WHATSAPP",
      };
    }

    // Send OTP using existing OTP service
    const result = await sendOTPService(phone);

    if (result.success) {
      console.log(`[Member Auth] ✓ Password reset OTP sent to ${phone}`);
      return {
        success: true,
        message: result.message,
        channel: result.channel,
        otpId: result.otpId,
      };
    } else {
      return {
        success: false,
        error: result.error || "Failed to send OTP",
      };
    }
  } catch (error) {
    console.error("[Member Auth Service] Error in forgot password:", error.message);
    throw error;
  }
};

/**
 * Forgot Password Verify & Reset
 * Step 2: Verify OTP and set new password
 */
const forgotPasswordResetService = async (phone, code, newPassword) => {
  try {
    // Verify OTP
    const otpResult = await verifyOTPService(phone, code);

    if (!otpResult.success) {
      return {
        success: false,
        error: otpResult.error || "Invalid OTP",
      };
    }

    // Find user
    const user = await getPrisma().User.findUnique({
      where: { phone },
    });

    if (!user) {
      return {
        success: false,
        error: "User not found",
      };
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    await getPrisma().User.update({
      where: { phone },
      data: {
        password: hashedPassword,
        updatedAt: new Date(),
      },
    });

    console.log(`[Member Auth] ✓ User ${phone} reset password successfully`);

    return {
      success: true,
      message: "Password reset successfully. Please login with your new password.",
    };
  } catch (error) {
    console.error("[Member Auth Service] Error resetting password:", error.message);
    throw error;
  }
};

module.exports = {
  createAccountService,
  memberLoginService,
  changePasswordService,
  forgotPasswordInitiateService,
  forgotPasswordResetService,
};
