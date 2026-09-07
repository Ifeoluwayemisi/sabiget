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

export default config;