// ============================================
// DVC (Delivery Verification Code) Utilities
// ============================================

/**
 * Generate a 6-character alphanumeric DVC code
 * Format: Uppercase letters and numbers only (e.g., "XJ42K9")
 * This creates 2 billion+ combinations to prevent brute-force guessing
 * @returns {string} - DVC code
 */
const generateDVCCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";

  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return code;
};

/**
 * Validate DVC code format
 * @param {string} code - Code to validate
 * @returns {boolean} - True if valid format
 */
const isValidDVCFormat = (code) => {
  if (!code || typeof code !== "string") return false;
  if (code.length !== 6) return false;

  const dvcRegex = /^[A-Z0-9]{6}$/;
  return dvcRegex.test(code);
};

/**
 * Check if DVC entry should be locked
 * @param {Object} dvcData - DVC attempt data from database
 * @returns {boolean} - True if locked
 */
const isDVCLocked = (dvcData) => {
  if (!dvcData) return false;

  const { dvcAttempts, dvcMaxAttempts, dvcLockedUntil } = dvcData;

  // Check if currently in lockout period
  if (dvcLockedUntil && new Date() < new Date(dvcLockedUntil)) {
    return true;
  }

  // Check if max attempts exceeded
  if (dvcAttempts >= dvcMaxAttempts) {
    return true;
  }

  return false;
};

/**
 * Calculate lockout expiry time (15 minutes from now)
 * @returns {Date} - Lockout expiry timestamp
 */
const calculateDVCLockoutExpiry = () => {
  const now = new Date();
  const lockoutDuration = 15 * 60 * 1000; // 15 minutes in milliseconds
  return new Date(now.getTime() + lockoutDuration);
};

module.exports = {
  generateDVCCode,
  isValidDVCFormat,
  isDVCLocked,
  calculateDVCLockoutExpiry,
};
