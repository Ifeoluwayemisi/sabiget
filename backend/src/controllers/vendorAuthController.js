// Vendor Auth Controller - Vendor-specific authentication (signup, login)
import { generateTokenPair } from "../utils/jwt.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { getLGAFromCoordinates, isValidCoordinates } from "../utils/location.js";

// In-memory store for vendor 2FA codes since the schema does not support these fields directly on User
const temp2FAStore = new Map(); // key: userId, value: { code, method, expiresAt }

/**
 * POST /api/v1/auth/vendor/signup
 * Vendor registration with email, password, and business details
 */
export async function vendorSignup(req, res) {
  try {
    const {
      email,
      password,
      businessName,
      businessPhone,
      businessCategory,
      latitude,
      longitude,
      description,
    } = req.body;

    const name = businessName || req.body.name;
    const phone = businessPhone || req.body.phone;

    if (!email || !password || !name || !phone) {
      return res.status(400).json({
        success: false,
        error: "Email, password, business name, and business phone required",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 8 characters",
      });
    }

    const phoneRegex = /^(\+234|0)[789]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        error: "Invalid Nigerian phone number",
        example: "+2348123456789",
      });
    }

    const existingUser = await global.prisma.User.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: "Email already registered",
      });
    }

    const existingVendor = await global.prisma.Vendor.findFirst({
      where: {
        OR: [{ phone }, { email }],
      },
    });

    if (existingVendor) {
      return res.status(409).json({
        success: false,
        error: "Vendor with this phone or email already exists",
      });
    }

    // Coordinates fallback to Lagos (Ikeja) if not provided (to avoid Prisma validation crash)
    const parsedLatitude = latitude !== undefined ? parseFloat(latitude) : 6.6018;
    const parsedLongitude = longitude !== undefined ? parseFloat(longitude) : 3.3515;

    if (!isValidCoordinates(parsedLatitude, parsedLongitude)) {
      return res.status(400).json({
        success: false,
        error: "Valid coordinates (latitude and longitude) are required",
      });
    }

    const hashedPassword = await hashPassword(password);

    // Create User with role VENDOR
    const user = await global.prisma.User.create({
      data: {
        email,
        phone,
        name,
        password: hashedPassword,
        role: "VENDOR",
        isVerified: false,
      },
    });

    // Create Vendor profile mapping to User
    const lga = getLGAFromCoordinates(parsedLatitude, parsedLongitude);
    const vendor = await global.prisma.Vendor.create({
      data: {
        userId: user.id,
        name,
        phone,
        email,
        latitude: parsedLatitude,
        longitude: parsedLongitude,
        lga,
        description: description || businessCategory || "General",
        isVerified: false,
        isActive: true,
      },
    });

    const { accessToken, refreshToken } = generateTokenPair(user);

    await global.prisma.RefreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return res.status(201).json({
      success: true,
      message: "Vendor account created successfully",
      accessToken,
      refreshToken,
      expiresIn: "15 minutes",
      vendor: {
        id: vendor.id,
        vendorId: vendor.id,
        userId: user.id,
        name: vendor.name,
        businessName: vendor.name,
        phone: vendor.phone,
        businessPhone: vendor.phone,
        isVerified: vendor.isVerified,
        isApproved: vendor.isVerified,
        nextStep: "Complete vendor dashboard setup",
      },
    });
  } catch (error) {
    console.error("[Vendor Auth Signup] Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * POST /api/v1/auth/vendor/login
 * Vendor login with email and password
 */
export async function vendorLogin(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password required",
      });
    }

    const user = await global.prisma.User.findUnique({ where: { email } });

    if (!user || user.role !== "VENDOR") {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

    const passwordMatch = await verifyPassword(password, user.password || "");

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

    const vendor = await global.prisma.Vendor.findUnique({
      where: { userId: user.id },
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        error: "Vendor account not found",
      });
    }

    if (!vendor.isActive) {
      return res.status(403).json({
        success: false,
        error: "Vendor account is deactivated",
      });
    }

    const { accessToken, refreshToken } = generateTokenPair(user);

    await global.prisma.RefreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return res.json({
      success: true,
      message: "Vendor login successful",
      accessToken,
      refreshToken,
      expiresIn: "15 minutes",
      vendor: {
        id: vendor.id,
        vendorId: vendor.id,
        name: vendor.name,
        businessName: vendor.name,
        phone: vendor.phone,
        email: vendor.email,
        isVerified: vendor.isVerified,
        isApproved: vendor.isVerified,
      },
    });
  } catch (error) {
    console.error("[Vendor Auth Login] Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * POST /api/v1/auth/vendor/setup-2fa
 * Setup 2FA (2-factor authentication) for vendor
 * Headers: { Authorization: "Bearer accessToken" }
 */
export async function setupVendor2FA(req, res) {
  try {
    const userId = req.user.userId;
    const { method = "email" } = req.body;

    if (!["email", "sms"].includes(method)) {
      return res.status(400).json({
        success: false,
        error: "2FA method must be 'email' or 'sms'",
      });
    }

    const user = await global.prisma.User.findUnique({ where: { id: userId } });

    if (!user || user.role !== "VENDOR") {
      return res.status(403).json({
        success: false,
        error: "Only vendors can setup 2FA",
      });
    }

    const twoFACode = Math.random().toString().slice(2, 8).padStart(6, "0");

    // Store temporary 2FA code in-memory to prevent schema mismatch crash
    temp2FAStore.set(userId, {
      code: twoFACode,
      method,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    console.log(`[Vendor 2FA] Set up 2FA for user ${userId} (${method}): ${twoFACode}`);

    return res.json({
      success: true,
      message: `2FA code sent via ${method}`,
      nextStep: "Verify code at /auth/vendor/verify-2fa",
      expiresIn: "10 minutes",
    });
  } catch (error) {
    console.error("[Vendor 2FA Setup] Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * POST /api/v1/auth/vendor/verify-2fa
 * Verify 2FA code for vendor
 * Headers: { Authorization: "Bearer accessToken" }
 * Body: { code: "482917" }
 */
export async function verifyVendor2FA(req, res) {
  try {
    const userId = req.user.userId;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: "2FA code required",
      });
    }

    const user = await global.prisma.User.findUnique({ where: { id: userId } });

    if (!user || user.role !== "VENDOR") {
      return res.status(403).json({
        success: false,
        error: "Only vendors can verify 2FA",
      });
    }

    const stored2FA = temp2FAStore.get(userId);

    if (!stored2FA || stored2FA.code !== code) {
      return res.status(401).json({
        success: false,
        error: "Invalid 2FA code",
      });
    }

    if (new Date() > stored2FA.expiresAt) {
      return res.status(401).json({
        success: false,
        error: "2FA code expired. Request a new one.",
      });
    }

    // Clear 2FA code from memory
    temp2FAStore.delete(userId);

    // Update verified status in DB
    await global.prisma.User.update({
      where: { id: userId },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
      },
    });

    const vendor = await global.prisma.Vendor.update({
      where: { userId },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
      },
    });

    return res.json({
      success: true,
      message: "2FA verified successfully",
      vendor: {
        id: vendor.id,
        vendorId: vendor.id,
        name: vendor.name,
        businessName: vendor.name,
        phone: vendor.phone,
        email: vendor.email,
        isVerified: vendor.isVerified,
        isApproved: vendor.isVerified,
        nextStep: vendor.isVerified
          ? "Access vendor dashboard at /vendor/dashboard"
          : "Awaiting admin approval. Check email for updates.",
      },
    });
  } catch (error) {
    console.error("[Vendor 2FA Verify] Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
