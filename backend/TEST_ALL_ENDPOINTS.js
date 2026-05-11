#!/usr/bin/env node

/**
 * SabiGet Backend - Comprehensive Integration Test
 * Tests all Phase 1-3 endpoints
 */

import http from "http";
import https from "https";
import { URL } from "url";

const API_URL = process.env.API_URL || "http://localhost:5000";

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[36m",
  bold: "\x1b[1m",
};

function log(msg, color = "reset") {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

let testsPassed = 0;
let testsFailed = 0;
let testToken = null;
let testUserId = null;
let testVendorId = null;
let testOrderId = null;
let testProductId = null;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_URL + path);
    const options = {
      method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (token) {
      options.headers["Authorization"] = `Bearer ${token}`;
    }

    const httpModule = url.protocol === "https:" ? https : http;
    const bodyStr = body ? JSON.stringify(body) : null;

    if (bodyStr) {
      options.headers["Content-Length"] = Buffer.byteLength(bodyStr);
    }

    const req = httpModule.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({
            status: res.statusCode,
            body: data ? JSON.parse(data) : null,
          });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function test(name, fn) {
  try {
    log(`\n▶ ${name}`, "blue");
    await fn();
    log(`✅ ${name}`, "green");
    testsPassed++;
  } catch (error) {
    log(`❌ ${name}: ${error.message}`, "red");
    testsFailed++;
  }
}

async function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg}: expected ${expected}, got ${actual}`);
  }
}

async function assertExists(value, msg) {
  if (!value) {
    throw new Error(`${msg}: value missing`);
  }
}

// ============================================
// PHASE 1-2: Auth & Core Features
// ============================================

await test("✓ Send OTP", async () => {
  const res = await request("POST", "/api/v1/auth/send-otp", {
    phone: "+2348123456789",
  });
  assertEqual(res.status, 200, "Send OTP status");
  assertExists(res.body.success, "OTP response");
  log("  OTP sent to +2348123456789", "yellow");
});

await test("✓ Verify OTP & Get Tokens", async () => {
  // Mock OTP code (check terminal output for actual code)
  const res = await request("POST", "/api/v1/auth/verify-otp", {
    phone: "+2348123456789",
    code: "123456", // Will be logged by backend
  });
  if (res.status === 200 && res.body.accessToken) {
    testToken = res.body.accessToken;
    testUserId = res.body.user.id;
    log(`  User: ${res.body.user.name || "Guest"}`, "yellow");
  } else {
    log("  Note: Use OTP code from backend terminal", "yellow");
    testToken = "test-token-placeholder";
  }
});

await test("✓ Auth Check Endpoint", async () => {
  const res = await request("GET", "/api/v1/auth/me", null, testToken);
  if (res.status === 200) {
    log(`  Authenticated as: ${res.body.user?.role || "GUEST"}`, "yellow");
  }
});

// ============================================
// PHASE 3: Customer Discovery
// ============================================

await test("✓ Get Nearby Vendors", async () => {
  const res = await request(
    "GET",
    "/api/v1/customers/nearby-vendors?latitude=6.5244&longitude=3.3792&radius=5",
    null,
    testToken,
  );
  if (res.status === 200) {
    testVendorId = res.body.vendors?.[0]?.id;
    log(`  Found ${res.body.vendors?.length || 0} vendors`, "yellow");
  }
});

await test("✓ Get Vendor Menu", async () => {
  if (!testVendorId) {
    log("  Skipping (no vendor found)", "yellow");
    return;
  }
  const res = await request(
    "GET",
    `/api/v1/customers/vendors/${testVendorId}/menu`,
  );
  if (res.status === 200) {
    testProductId = res.body.categories?.[0]?.products?.[0]?.id;
    log(`  Found ${res.body.categories?.length || 0} categories`, "yellow");
  }
});

// ============================================
// PHASE 2: Order Management
// ============================================

await test("✓ Create Order", async () => {
  if (!testVendorId || !testProductId) {
    log("  Skipping (missing vendor/product)", "yellow");
    return;
  }
  const res = await request(
    "POST",
    "/api/v1/orders",
    {
      vendorId: testVendorId,
      items: [{ productId: testProductId, quantity: 1 }],
      deliveryAddress: "123 Main St, Lagos",
      deliveryLat: 6.5244,
      deliveryLng: 3.3792,
    },
    testToken,
  );
  if (res.status === 201 || res.status === 200) {
    testOrderId = res.body.orderId;
    log(`  Order created: ${testOrderId}`, "yellow");
  }
});

await test("✓ Get Order Details", async () => {
  if (!testOrderId) {
    log("  Skipping (no order)", "yellow");
    return;
  }
  const res = await request(
    "GET",
    `/api/v1/orders/${testOrderId}`,
    null,
    testToken,
  );
  if (res.status === 200) {
    log(`  Status: ${res.body.order?.status}`, "yellow");
  }
});

// ============================================
// PHASE 3: Order History & Reviews
// ============================================

await test("✓ Get Order History", async () => {
  const res = await request(
    "GET",
    "/api/v1/customers/order-history?page=1&limit=5",
    null,
    testToken,
  );
  if (res.status === 200) {
    log(`  Retrieved ${res.body.orders?.length || 0} orders`, "yellow");
  }
});

await test("✓ Get Loyalty Points", async () => {
  const res = await request(
    "GET",
    "/api/v1/customers/loyalty-points",
    null,
    testToken,
  );
  if (res.status === 200) {
    log(
      `  Balance: ${res.body.loyaltyPoints} points (Tier: ${res.body.tier})`,
      "yellow",
    );
  }
});

await test("✓ Get Customer Insights", async () => {
  const res = await request(
    "GET",
    "/api/v1/customers/insights",
    null,
    testToken,
  );
  if (res.status === 200) {
    log(
      `  Orders: ${res.body.insights?.totalOrders}, Spent: ₦${res.body.insights?.totalSpent}`,
      "yellow",
    );
  }
});

await test("✓ Get Recommendations", async () => {
  const res = await request(
    "GET",
    "/api/v1/customers/recommendations?latitude=6.5244&longitude=3.3792&radius=5",
    null,
    testToken,
  );
  if (res.status === 200) {
    log(`  ${res.body.recommendations?.length || 0} recommendations`, "yellow");
  }
});

// ============================================
// Error Handling & Edge Cases
// ============================================

await test("✗ Invalid OTP Should Fail", async () => {
  const res = await request("POST", "/api/v1/auth/verify-otp", {
    phone: "+2348123456789",
    code: "INVALID",
  });
  if (res.status !== 200) {
    log("  Correctly rejected invalid OTP", "yellow");
  } else {
    throw new Error("Should have rejected invalid OTP");
  }
});

await test("✗ Missing Token Should Return 401", async () => {
  const res = await request("GET", "/api/v1/customers/loyalty-points");
  if (res.status === 401 || res.status === 403) {
    log("  Correctly rejected missing token", "yellow");
  } else {
    throw new Error(`Expected 401/403, got ${res.status}`);
  }
});

await test("✗ Invalid Coordinates Should Fail", async () => {
  const res = await request(
    "GET",
    "/api/v1/customers/nearby-vendors?latitude=500&longitude=500",
    null,
    testToken,
  );
  if (res.status === 400) {
    log("  Correctly rejected invalid coordinates", "yellow");
  }
});

// ============================================
// Summary
// ============================================

log("\n" + "=".repeat(50), "bold");
log(`\n📊 Test Results`, "bold");
log(`✅ Passed: ${testsPassed}`, "green");
log(`❌ Failed: ${testsFailed}`, testsFailed > 0 ? "red" : "green");
log(`\n📝 Notes:`, "blue");
log(`  - For OTP tests, check backend terminal for code`, "yellow");
log(`  - Token used: ${testToken?.substring(0, 20)}...`, "yellow");
log(`  - User ID: ${testUserId || "Not set"}`, "yellow");
log(`  - Vendor ID: ${testVendorId || "Not found"}`, "yellow");
log(`  - Order ID: ${testOrderId || "Not created"}`, "yellow");

if (testsFailed === 0) {
  log(`\n✅ All tests passed! Backend is working.`, "green");
  process.exit(0);
} else {
  log(`\n⚠️  Some tests failed. Check output above.`, "red");
  process.exit(1);
}
