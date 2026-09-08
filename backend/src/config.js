// ============================================
// Central runtime configuration
// ============================================
// Cash on Delivery, hardcoded fees, and guessed DVC/OTP values are dangerous.
// This module is the single read point for the configuration-driven business
// values used across routes/services. Defaults mirror `.env.example`; real
// values always come from the environment.

function parseIntEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(value) ? value : fallback;
}

const nodeEnv = process.env.NODE_ENV || "development";
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

const config = {
  nodeEnv,
  isProduction: nodeEnv === "production",
  frontendUrl,
  serviceFeeNaira: parseIntEnv("SERVICE_FEE_NAIRA", 500),
  paystack: {
    callbackUrl:
      process.env.PAYSTACK_CALLBACK_URL || `${frontendUrl}/payment-callback`,
  },
  dvc: {
    length: parseIntEnv("DVC_LENGTH", 6),
    lockoutMinutes: parseIntEnv("DVC_LOCKOUT_MINUTES", 15),
    maxAttempts: parseIntEnv("DVC_MAX_ATTEMPTS", 3),
  },
  otp: {
    length: parseIntEnv("OTP_LENGTH", 6),
    expiryMinutes: parseIntEnv("OTP_EXPIRY_MINUTES", 10),
  },
};

/**
 * Notification provider configuration (Meta WhatsApp Cloud API + Brevo).
 * Read fresh on every call so runtime (ott startup) and tests observe the
 * current environment exactly. There is intentionally NO SMS provider and NO
 * fake/local provider; the only non-live fallback is an explicitly-labelled
 * development console channel (see notifications.js).
 */
export function getNotificationsConfig() {
  return {
    nodeEnv: process.env.NODE_ENV || "development",
    // META_WHATSAPP_ACCESS_TOKEN is the current name; the older
    // META_WHATSAPP_TOKEN is still honoured so existing env files keep working.
    whatsappAccessToken:
      process.env.META_WHATSAPP_ACCESS_TOKEN || process.env.META_WHATSAPP_TOKEN || "",
    whatsappPhoneNumberId: process.env.META_WHATSAPP_PHONE_NUMBER_ID || "",
    whatsappBusinessAccountId: process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID || "",
    whatsappApiVersion: process.env.META_WHATSAPP_API_VERSION || "v20.0",
    whatsappOtpTemplate:
      process.env.META_WHATSAPP_OTP_TEMPLATE || "sabiget_otp",
    whatsappOrderTemplate:
      process.env.META_WHATSAPP_ORDER_TEMPLATE || "sabiget_order_status",
    brevoApiKey: process.env.BREVO_API_KEY || "",
    brevoSenderEmail:
      process.env.BREVO_SENDER_EMAIL || "no-reply@sabiget.com",
    brevoSenderName: process.env.BREVO_SENDER_NAME || "SabiGet",
  };
}

export default config;