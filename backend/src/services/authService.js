// ============================================
// Auth Service - Business Logic
// ============================================

import { generateOTP, hashCode, verifyCode } from "../utils/generators.js";
import { generateTokenPair } from "../utils/jwt.js";
import { sendOtpNotification } from "../utils/notifications.js";
import config from "../config.js";

const getPrisma = () => global.prisma;

const sendOTPService = async (phone, email = null) => {
  try {
    const otpCode = generateOTP(config.otp.length);
    const hashedOTP = hashCode(otpCode);

    const otpLog = await getPrisma().OTPLog.create({
      data: {
        phone,
        code: hashedOTP,
        expiresAt: new Date(
          Date.now() + config.otp.expiryMinutes * 60 * 1000,
        ),
        maxAttempts: 3,
        attempts: 0,
        isUsed: false,
      },
    });

    // WhatsApp first, then email fallback (no SMS). Outside production an
    // explicit console channel prints the code so QA can complete the flow.
    const delivery = await sendOtpNotification({
      phone,
      email,
      code: otpCode,
      expiryMinutes: config.otp.expiryMinutes,
      otpId: otpLog.id,
    });

    if (!delivery.delivered && delivery.mode === "unavailable") {
      return {
        success: false,
        error: delivery.error,
        otpId: otpLog.id,
      };
    }

    const channel = delivery.channel || "CONSOLE";

    return {
      success: true,
      message:
        channel === "WHATSAPP"
          ? "OTP sent via WhatsApp"
          : channel === "EMAIL"
            ? "OTP sent to your email"
            : "OTP generated in development mode (see server console)",
      channel,
      mode: delivery.mode,
      otpId: otpLog.id,
    };
  } catch (error) {
    console.error("[OTP Service] Error sending OTP:", error.message);
    throw error;
  }
};

const verifyOTPService = async (phone, code) => {
  try {
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

    if (new Date() > new Date(otpRecord.expiresAt)) {
      return {
        success: false,
        error: "OTP expired",
      };
    }

    if (otpRecord.attempts >= otpRecord.maxAttempts) {
      return {
        success: false,
        error: "Too many attempts. OTP locked for 15 minutes",
      };
    }

    if (!verifyCode(code, otpRecord.code)) {
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

    await getPrisma().OTPLog.update({
      where: { id: otpRecord.id },
      data: {
        isUsed: true,
        usedAt: new Date(),
      },
    });

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
      user = await getPrisma().User.update({
        where: { phone },
        data: {
          lastLoginAt: new Date(),
        },
      });
    }

    const { accessToken, refreshToken } = generateTokenPair(user);

    await getPrisma().RefreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    console.log(`[OTP] User ${phone} verified successfully`);

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

export { sendOTPService, verifyOTPService };
