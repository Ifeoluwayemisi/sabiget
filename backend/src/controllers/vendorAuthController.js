// Vendor Auth Controller - Vendor-specific authentication (signup, login)
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "your-refresh-secret-key";

/**
 * POST /api/v1/auth/vendor/signup
 * Vendor registration with email, password, and business details
 */
export async function vendorSignup(req, res) {
  try {
    const { email, password, businessName, businessPhone, businessCategory } =
      req.body;

    if (!email || !password || !businessName || !businessPhone) {
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

    const existingUser = await global.prisma.User.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: "Email already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await global.prisma.User.create({
      data: {
        email,
        password: hashedPassword,
        role: "VENDOR",
        isVerified: false,
      },
    });

    const vendor = await global.prisma.Vendor.create({
      data: {
        userId: user.id,
        businessName,
        businessPhone,
        businessCategory: businessCategory || "General",
        isApproved: false,
        isActive: true,
      },
    });

    const accessToken = jwt.sign(
      { userId: user.id, role: "VENDOR" },
      JWT_SECRET,
      { expiresIn: "15m" },
    );

    const refreshToken = jwt.sign(
      { userId: user.id, role: "VENDOR" },
      JWT_REFRESH_SECRET,
      { expiresIn: "7d" },
    );

    await global.prisma.RefreshToken.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return res.status(201).json({
      success: true,
      message: "Vendor account created successfully",
      accessToken,
      refreshToken,
      expiresIn: "15m",
      vendor: {
        vendorId: vendor.id,
        userId: user.id,
        businessName: vendor.businessName,
        businessPhone: vendor.businessPhone,
        isApproved: vendor.isApproved,
        nextStep: "Complete vendor dashboard setup",
      },
    });
  } catch (error) {
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

    const passwordMatch = await bcrypt.compare(password, user.password || "");

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

    const accessToken = jwt.sign(
      { userId: user.id, role: "VENDOR" },
      JWT_SECRET,
      { expiresIn: "15m" },
    );

    const refreshToken = jwt.sign(
      { userId: user.id, role: "VENDOR" },
      JWT_REFRESH_SECRET,
      { expiresIn: "7d" },
    );

    await global.prisma.RefreshToken.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return res.json({
      success: true,
      message: "Vendor login successful",
      accessToken,
      refreshToken,
      expiresIn: "15m",
      vendor: {
        vendorId: vendor.id,
        businessName: vendor.businessName,
        isApproved: vendor.isApproved,
      },
    });
  } catch (error) {
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

    // TODO: Send 2FA code via email or SMS
    // await sendVendor2FACode(user.email, twoFACode, method);

    await global.prisma.User.update({
      where: { id: userId },
      data: {
        twoFACode,
        twoFAMethod: method,
        twoFAExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    return res.json({
      success: true,
      message: `2FA code sent via ${method}`,
      nextStep: "Verify code at /auth/vendor/verify-2fa",
      expiresIn: "10 minutes",
    });
  } catch (error) {
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

    if (user.twoFACode !== code) {
      return res.status(401).json({
        success: false,
        error: "Invalid 2FA code",
      });
    }

    if (new Date() > user.twoFAExpiresAt) {
      return res.status(401).json({
        success: false,
        error: "2FA code expired. Request a new one.",
      });
    }

    await global.prisma.User.update({
      where: { id: userId },
      data: {
        isVerified: true,
        twoFACode: null,
        twoFAMethod: null,
        twoFAExpiresAt: null,
      },
    });

    const vendor = await global.prisma.Vendor.findUnique({
      where: { userId },
    });

    return res.json({
      success: true,
      message: "2FA verified successfully",
      vendor: {
        vendorId: vendor.id,
        businessName: vendor.businessName,
        isApproved: vendor.isApproved,
        nextStep: vendor.isApproved
          ? "Access vendor dashboard at /vendor/dashboard"
          : "Awaiting admin approval. Check email for updates.",
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
