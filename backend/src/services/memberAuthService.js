// ============================================
// Member Auth Service - Business Logic
// ============================================

const { hashPassword, verifyPassword } = require("../utils/password");
const { generateTokenPair } = require("../utils/jwt");

// Prisma will be available globally after app.js initializes
const getPrisma = () => global.prisma;

/**
 * Create member account (GUEST → MEMBER conversion)
 * Requirements:
 * - User must be GUEST (OTP verified)
 * - Must provide strong password
 * - Optional: name, email
 */
const createMemberAccountService = async (
  userId,
  phone,
  password,
  name,
  email,
) => {
  try {
    const prisma = getPrisma();

    // Find user by phone
    const user = await prisma.User.findUnique({
      where: { phone },
    });

    if (!user) {
      return {
        success: false,
        error: "User not found",
      };
    }

    // Check if user is still GUEST
    if (user.role !== "GUEST") {
      return {
        success: false,
        error: `User is already a ${user.role}, cannot create new account`,
      };
    }

    // Validate password strength
    if (password.length < 8) {
      return {
        success: false,
        error: "Password must be at least 8 characters",
      };
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Update user to MEMBER with password
    const updatedUser = await prisma.User.update({
      where: { phone },
      data: {
        password: hashedPassword,
        role: "MEMBER",
        name: name || user.name,
        email: email || user.email,
        isVerified: true,
        verifiedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log(`[Member Auth] User ${phone} converted from GUEST to MEMBER`);

    // Generate JWT tokens
    const { accessToken, refreshToken } = generateTokenPair(updatedUser);

    // Save refresh token to database
    await prisma.RefreshToken.create({
      data: {
        token: refreshToken,
        userId: updatedUser.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return {
      success: true,
      message: "Account created successfully",
      user: {
        id: updatedUser.id,
        phone: updatedUser.phone,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        loyaltyPoints: updatedUser.loyaltyPoints,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  } catch (error) {
    console.error(
      "[Member Auth Service] Error creating account:",
      error.message,
    );
    throw error;
  }
};

/**
 * Login with phone and password (MEMBER only)
 * Requirements:
 * - User must be MEMBER
 * - Phone number must be valid
 * - Password must match hash
 */
const loginService = async (phone, password) => {
  try {
    const prisma = getPrisma();

    // Find user by phone
    const user = await prisma.User.findUnique({
      where: { phone },
    });

    if (!user) {
      return {
        success: false,
        error: "Invalid phone or password",
      };
    }

    // Check if user is MEMBER
    if (user.role !== "MEMBER") {
      return {
        success: false,
        error: `User is not a MEMBER. Please verify identity first.`,
      };
    }

    // Check if password exists
    if (!user.password) {
      return {
        success: false,
        error: "Password not set for this account. Use OTP verification.",
      };
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.password);
    if (!isPasswordValid) {
      return {
        success: false,
        error: "Invalid phone or password",
      };
    }

    // Update last login
    await prisma.User.update({
      where: { phone },
      data: {
        lastLoginAt: new Date(),
      },
    });

    // Generate JWT tokens
    const { accessToken, refreshToken } = generateTokenPair(user);

    // Save refresh token to database
    await prisma.RefreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    console.log(`[Member Auth] User ${phone} logged in successfully`);

    return {
      success: true,
      message: "Login successful",
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
    console.error("[Member Auth Service] Error logging in:", error.message);
    throw error;
  }
};

module.exports = {
  createMemberAccountService,
  loginService,
};
