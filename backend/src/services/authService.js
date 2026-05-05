// ============================================
// Auth Service - Business Logic
// ============================================

const { generateOTP, hashCode, verifyCode } = require("../utils/generators");
const {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
} = require("../utils/jwt");
const { sendWhatsAppOTP, sendSmsOTP, verifyOTP } = require("../utils/termii");

// Prisma will be available globally after app.js initializes
const getPrisma = () => global.prisma;

/**
 * Send OTP via WhatsApp (primary) or SMS (fallback)
 */
const sendOTPService = async (phone) => {
  try {
    // Generate 6-digit OTP
    const otpCode = generateOTP(6);
    const hashedOTP = hashCode(otpCode);

    // Store in database
    const otpLog = await getPrisma().OTPLog.create({
      data: {
        phone,
        code: hashedOTP,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        maxAttempts: 3,
        attempts: 0,
        isUsed: false,
      },
    });

    console.log(`[OTP] Generated for ${phone}: ${otpCode}`);

    // Try WhatsApp first
    console.log(`[OTP] Attempting WhatsApp delivery to ${phone}`);
    const whatsappResult = await sendWhatsAppOTP({
      phone,
      code: otpCode,
    });

    if (whatsappResult.success) {
      console.log(`[OTP] ✓ WhatsApp sent successfully to ${phone}`);
      return {
        success: true,
        message: "OTP sent via WhatsApp",
        channel: "WHATSAPP",
        otpId: otpLog.id,
      };
    }

    // WhatsApp failed, try SMS after 30 seconds
    console.log(`[OTP] WhatsApp failed, scheduling SMS fallback for ${phone}`);
    setTimeout(async () => {
      console.log(`[OTP] Attempting SMS delivery to ${phone}`);
      const smsResult = await sendSmsOTP({
        phone,
        code: otpCode,
      });

      if (smsResult.success) {
        console.log(`[OTP] ✓ SMS sent successfully to ${phone}`);
        // Update channel in database (optional)
      } else {
        console.error(`[OTP] ✗ SMS also failed for ${phone}`);
      }
    }, 30000); // 30 seconds

    return {
      success: true,
      message: "OTP sent via WhatsApp, SMS fallback scheduled",
      channel: "WHATSAPP",
      otpId: otpLog.id,
    };
  } catch (error) {
    console.error("[OTP Service] Error sending OTP:", error.message);
    throw error;
  }
};

/**
 * Verify OTP and create/update user
 */
const verifyOTPService = async (phone, code) => {
  try {
    // Find OTP record
    const otpRecord = await getPrisma().OTPLog.findFirst({
      where: {
        phone,
        isUsed: false,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!otpRecord) {
      return {
        success: false,
        error: "OTP not found or already used",
      };
    }

    // Check expiry
    if (new Date() > new Date(otpRecord.expiresAt)) {
      return {
        success: false,
        error: "OTP expired",
      };
    }

    // Check attempts
    if (otpRecord.attempts >= otpRecord.maxAttempts) {
      return {
        success: false,
        error: "Too many attempts. OTP locked for 15 minutes",
      };
    }

    // Verify code (compare hashed)
    if (!verifyCode(code, otpRecord.code)) {
      // Increment attempts
      await getPrisma().OTPLog.update({
        where: { id: otpRecord.id },
        data: { attempts: otpRecord.attempts + 1 },
      });

      return {
        success: false,
        error: "Invalid OTP",
        attemptsRemaining: otpRecord.maxAttempts - otpRecord.attempts - 1,
      };
    }

    // Mark OTP as used
    await getPrisma().OTPLog.update({
      where: { id: otpRecord.id },
      data: {
        isUsed: true,
        usedAt: new Date(),
      },
    });

    // Find or create user (GUEST role)
    let user = await getPrisma().User.findUnique({
      where: { phone },
    });

    if (!user) {
      console.log(`[OTP] Creating new GUEST user for ${phone}`);
      user = await getPrisma().User.create({
        data: {
          phone,
          role: "GUEST",
          isVerified: true,
          verifiedAt: new Date(),
          lastLoginAt: new Date(),
        },
      });
    } else {
      // Update existing user
      user = await getPrisma().User.update({
        where: { phone },
        data: {
          lastLoginAt: new Date(),
        },
      });
    }

    // Generate JWT tokens
    const { accessToken, refreshToken } = generateTokenPair(user);

    // Save refresh token to database
    await getPrisma().RefreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    console.log(`[OTP] ✓ User ${phone} verified successfully`);

    return {
      success: true,
      message: "OTP verified successfully",
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
    console.error("[OTP Service] Error verifying OTP:", error.message);
    throw error;
  }
};

module.exports = {
  sendOTPService,
  verifyOTPService,
};
