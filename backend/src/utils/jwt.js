// Utils for JWT token generation and validation
import jwt from "jsonwebtoken";

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

/**
 * Generate access token (short-lived)
 */
export function generateAccessToken(userId, role) {
  return jwt.sign({ userId, role }, JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

/**
 * Generate refresh token (long-lived)
 */
export function generateRefreshToken(userId, role) {
  return jwt.sign({ userId, role }, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });
}

/**
 * Verify access token
 */
export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, JWT_ACCESS_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Decode token without verification (for debugging)
 */
export function decodeToken(token) {
  return jwt.decode(token);
}

/**
 * Generate both access and refresh tokens in one call
 */
export function generateTokenPair(user) {
  return {
    accessToken: generateAccessToken(user.id, user.role),
    refreshToken: generateRefreshToken(user.id, user.role),
  };
}

const GUEST_ORDER_TOKEN_EXPIRY = "24h";

/**
 * Limited-scope token that lets an unauthenticated guest read exactly one
 * order after checkout. Signed with the refresh secret (never the access
 * secret) so it cannot be replayed against authenticateToken routes, and it
 * carries a scope claim that must be checked on every use.
 */
export function generateGuestOrderToken(orderId) {
  return jwt.sign(
    { orderId, scope: "order:read" },
    JWT_REFRESH_SECRET,
    { expiresIn: GUEST_ORDER_TOKEN_EXPIRY },
  );
}

/**
 * Verify a guest order token. Returns { orderId } only when the signature,
 * expiry, scope claim, and orderId binding all check out; null otherwise.
 */
export function verifyGuestOrderToken(token) {
  try {
    const payload = jwt.verify(token, JWT_REFRESH_SECRET);
    if (!payload || payload.scope !== "order:read" || !payload.orderId) {
      return null;
    }
    return payload;
  } catch (error) {
    return null;
  }
}
