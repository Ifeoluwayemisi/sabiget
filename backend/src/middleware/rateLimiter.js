// Rate limiting middleware
import rateLimit from "express-rate-limit";

/**
 * OTP Request Rate Limiter
 * Limit: 3 OTP requests per phone number per hour
 */
const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: "Too many OTP requests. Try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.body?.phone || req.ip,
  skip: (req) => !req.body?.phone, // Skip if no phone provided
});

/**
 * Login Attempt Rate Limiter
 * Limit: 5 failed attempts per IP per 15 minutes
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: "Too many login attempts. Try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful attempts
});

/**
 * Checkout Rate Limiter
 * Limit: 10 checkout attempts per IP per hour
 */
const checkoutLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: "Too many checkout attempts. Try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * General API Rate Limiter
 * Limit: 100 requests per IP per 15 minutes
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: "Too many requests from this IP.",
  standardHeaders: true,
  legacyHeaders: false,
});

export { otpLimiter, loginLimiter, checkoutLimiter, apiLimiter };
