// Utils for OTP and DVC code generation
import crypto from "node:crypto";

/**
 * Generate a random OTP code
 * @param {number} length - Length of OTP (default 6 digits)
 * @returns {string} OTP code
 */
export function generateOTP(length = 6) {
  const digits = "0123456789";
  let otp = "";
  for (let i = 0; i < length; i++) {
    otp += digits.charAt(Math.floor(Math.random() * digits.length));
  }
  return otp;
}

/**
 * Generate a DVC (Delivery Verification Code)
 * 6-character alphanumeric (e.g., XJ42K9)
 * @returns {string} DVC code
 */
export function generateDVC() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let dvc = "";
  for (let i = 0; i < 6; i++) {
    dvc += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return dvc;
}

/**
 * Generate a unique idempotency key
 * @returns {string} UUID-like key
 */
export function generateIdempotencyKey() {
  return crypto.randomUUID();
}

/**
 * Hash OTP or sensitive code for storage
 * @param {string} code - The code to hash
 * @returns {string} Hashed code
 */
export function hashCode(code) {
  return crypto
    .createHash("sha256")
    .update(code + process.env.JWT_ACCESS_SECRET) // Salt with secret
    .digest("hex");
}

/**
 * Verify a code against its hash
 * @param {string} code - Plain code
 * @param {string} hash - Stored hash
 * @returns {boolean} Match result
 */
export function verifyCode(code, hash) {
  const computedHash = hashCode(code);
  return computedHash === hash;
}
