// ============================================
// Member Auth Service - Business Logic
// ============================================

import { hashPassword, verifyPassword } from "../utils/password.js";
import { generateTokenPair } from "../utils/jwt.js";

const getPrisma = () => global.prisma;

const createMemberAccountService = async ({
  userId,
  phone,
  password,
  name,
  email,
}) => {
  try {
    const prisma = getPrisma();
    const lookup = userId ? { id: userId } : { phone };
    const user = await prisma.User.findUnique({
      where: lookup,
    });

    if (!user) {
      return {
        success: false,
        error: "User not found",
      };
    }

    if (user.role !== "GUEST") {
      return {
        success: false,
        error: `User is already a ${user.role}, cannot create new account`,
      };
    }

    if (email) {
      const existingEmail = await prisma.User.findUnique({
        where: { email },
      });

      if (existingEmail && existingEmail.id !== user.id) {
        return {
          success: false,
          error: "Email already in use",
        };
      }
    }

    if (password.length < 8) {
      return {
        success: false,
        error: "Password must be at least 8 characters",
      };
    }

    const hashedPassword = await hashPassword(password);

    const updatedUser = await prisma.User.update({
      where: { phone: user.phone },
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

    console.log(
      `[Member Auth] User ${user.phone} converted from GUEST to MEMBER`,
    );

    const { accessToken, refreshToken } = generateTokenPair(updatedUser);

    await prisma.RefreshToken.create({
      data: {
        token: refreshToken,
        userId: updatedUser.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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

const loginService = async (phone, password) => {
  try {
    const prisma = getPrisma();
    const user = await prisma.User.findUnique({
      where: { phone },
    });

    if (!user) {
      return {
        success: false,
        error: "Invalid phone or password",
      };
    }

    if (user.role !== "MEMBER") {
      return {
        success: false,
        error: "User is not a MEMBER. Please verify identity first.",
      };
    }

    if (!user.password) {
      return {
        success: false,
        error: "Password not set for this account. Use OTP verification.",
      };
    }

    const isPasswordValid = await verifyPassword(password, user.password);
    if (!isPasswordValid) {
      return {
        success: false,
        error: "Invalid phone or password",
      };
    }

    await prisma.User.update({
      where: { phone },
      data: {
        lastLoginAt: new Date(),
      },
    });

    const { accessToken, refreshToken } = generateTokenPair(user);

    await prisma.RefreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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

export { createMemberAccountService, loginService };
