#!/usr/bin/env node

/**
 * Phase 3 Customer Experience - Test Helper Script
 *
 * Usage:
 *   node PHASE3_TEST_HELPER.js test-nearby-vendors
 *   node PHASE3_TEST_HELPER.js test-order-history
 *   node PHASE3_TEST_HELPER.js test-loyalty-points
 *
 * Set environment variables:
 *   API_URL=http://localhost:5000
 *   ACCESS_TOKEN=your_token_here
 *   USER_ID=user_123
 */

const http = require("http");
const querystring = require("querystring");

const API_URL = process.env.API_URL || "http://localhost:5000";
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const USER_ID = process.env.USER_ID;

// ANSI color codes for output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[36m",
  bold: "\x1b[1m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_URL + path);
    const options = {
      method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (ACCESS_TOKEN) {
      options.headers["Authorization"] = `Bearer ${ACCESS_TOKEN}`;
    }

    if (body) {
      const bodyStr = JSON.stringify(body);
      options.headers["Content-Length"] = Buffer.byteLength(bodyStr);
    }

    const urlObj = new URL(url);
    const httpMethod = urlObj.protocol === "https:" ? require("https") : http;

    const req = httpMethod.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const jsonData = data ? JSON.parse(data) : null;
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: jsonData,
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
          });
        }
      });
    });

    req.on("error", reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function testNearbyVendors() {
  log("\n=== Test: Get Nearby Vendors ===", "blue");

  try {
    const response = await request(
      "GET",
      "/api/v1/customers/nearby-vendors?latitude=6.5244&longitude=3.3792&radius=5",
    );

    if (response.status === 200) {
      log("✓ Status 200 OK", "green");
      log(`✓ Found ${response.body.vendors?.length || 0} vendors`, "green");

      if (response.body.vendors?.length > 0) {
        const vendor = response.body.vendors[0];
        log(
          `  First vendor: ${vendor.name} (${vendor.distanceKm}km away)`,
          "yellow",
        );
        log(
          `  Rating: ${vendor.averageRating}⭐ (${vendor.totalReviews} reviews)`,
          "yellow",
        );
      }
    } else {
      log(`✗ Unexpected status: ${response.status}`, "red");
    }
  } catch (error) {
    log(`✗ Error: ${error.message}`, "red");
  }
}

async function testOrderHistory() {
  log("\n=== Test: Get Order History ===", "blue");

  if (!ACCESS_TOKEN) {
    log("✗ ACCESS_TOKEN not set", "red");
    return;
  }

  try {
    const response = await request(
      "GET",
      "/api/v1/customers/order-history?page=1&limit=5",
    );

    if (response.status === 200) {
      log("✓ Status 200 OK", "green");
      log(`✓ Retrieved ${response.body.orders?.length || 0} orders`, "green");

      if (response.body.pagination) {
        log(
          `  Pagination: Page ${response.body.pagination.page}/${response.body.pagination.totalPages}`,
          "yellow",
        );
        log(`  Total orders: ${response.body.pagination.total}`, "yellow");
      }

      if (response.body.orders?.length > 0) {
        const order = response.body.orders[0];
        log(`  Latest order: ${order.id} (${order.status})`, "yellow");
        log(
          `  Amount: ₦${order.totalAmount}, Vendor: ${order.vendor.name}`,
          "yellow",
        );
        if (order.rating) {
          log(`  Review: ${order.rating}⭐`, "yellow");
        }
      }
    } else {
      log(`✗ Unexpected status: ${response.status}`, "red");
    }
  } catch (error) {
    log(`✗ Error: ${error.message}`, "red");
  }
}

async function testLoyaltyPoints() {
  log("\n=== Test: Get Loyalty Points ===", "blue");

  if (!ACCESS_TOKEN) {
    log("✗ ACCESS_TOKEN not set", "red");
    return;
  }

  try {
    const response = await request("GET", "/api/v1/customers/loyalty-points");

    if (response.status === 200) {
      log("✓ Status 200 OK", "green");
      const points = response.body;
      log(`✓ Current balance: ${points.loyaltyPoints} points`, "green");
      log(`  Earned lifetime: ${points.pointsEarned}`, "yellow");
      log(`  Redeemed lifetime: ${points.pointsRedeemed}`, "yellow");
      log(`  Tier: ${points.tier}`, "yellow");
      log(
        `  Earning rate: ${(points.earningRate * 100).toFixed(0)}%`,
        "yellow",
      );

      if (points.nextTier) {
        log(
          `  Next tier: ${points.nextTier.name} (${points.nextTier.ordersNeeded - points.nextTier.ordersCompleted} orders remaining)`,
          "yellow",
        );
      }
    } else {
      log(`✗ Unexpected status: ${response.status}`, "red");
    }
  } catch (error) {
    log(`✗ Error: ${error.message}`, "red");
  }
}

async function testCustomerInsights() {
  log("\n=== Test: Get Customer Insights ===", "blue");

  if (!ACCESS_TOKEN) {
    log("✗ ACCESS_TOKEN not set", "red");
    return;
  }

  try {
    const response = await request("GET", "/api/v1/customers/insights");

    if (response.status === 200) {
      log("✓ Status 200 OK", "green");
      const insights = response.body.insights;
      log(`✓ Total orders: ${insights.totalOrders}`, "green");
      log(`  Total spent: ₦${insights.totalSpent}`, "yellow");
      log(`  Average order: ₦${insights.avgOrderValue}`, "yellow");
      log(
        `  This month: ${insights.recentOrdersThisMonth} orders (${insights.frequencyPerWeek}/week)`,
        "yellow",
      );
      if (insights.favoriteVendor) {
        log(`  Favorite: ${insights.favoriteVendor.name}`, "yellow");
      }
      log(`  Tier: ${insights.loyaltyTier}`, "yellow");
      log(`  Points balance: ${insights.pointsBalance}`, "yellow");
    } else {
      log(`✗ Unexpected status: ${response.status}`, "red");
    }
  } catch (error) {
    log(`✗ Error: ${error.message}`, "red");
  }
}

async function testRecommendations() {
  log("\n=== Test: Get Personalized Recommendations ===", "blue");

  if (!ACCESS_TOKEN) {
    log("✗ ACCESS_TOKEN not set", "red");
    return;
  }

  try {
    const response = await request(
      "GET",
      "/api/v1/customers/recommendations?latitude=6.5244&longitude=3.3792&radius=5",
    );

    if (response.status === 200) {
      log("✓ Status 200 OK", "green");
      log(
        `✓ Found ${response.body.recommendations?.length || 0} recommendations`,
        "green",
      );

      response.body.recommendations?.forEach((vendor, index) => {
        log(
          `  ${index + 1}. ${vendor.name} (${vendor.distanceKm}km)`,
          "yellow",
        );
        log(
          `     Rating: ${vendor.rating}⭐ | Favorite: ${vendor.isFavorite ? "Yes" : "No"} | Reason: ${vendor.reason}`,
          "yellow",
        );
      });
    } else {
      log(`✗ Unexpected status: ${response.status}`, "red");
    }
  } catch (error) {
    log(`✗ Error: ${error.message}`, "red");
  }
}

async function testAll() {
  log(
    `\n${colors.bold}=== Phase 3 Customer Experience Tests ===${colors.reset}`,
    "blue",
  );
  log(`API URL: ${API_URL}`, "yellow");
  log(
    `Token: ${ACCESS_TOKEN ? "Set ✓" : "Not set ✗"}`,
    ACCESS_TOKEN ? "green" : "red",
  );

  await testNearbyVendors();
  await testOrderHistory();
  await testLoyaltyPoints();
  await testCustomerInsights();
  await testRecommendations();

  log("\n✅ All tests completed", "green");
}

// Run tests
const command = process.argv[2] || "all";

(async () => {
  switch (command) {
    case "test-nearby-vendors":
      await testNearbyVendors();
      break;
    case "test-order-history":
      await testOrderHistory();
      break;
    case "test-loyalty-points":
      await testLoyaltyPoints();
      break;
    case "test-insights":
      await testCustomerInsights();
      break;
    case "test-recommendations":
      await testRecommendations();
      break;
    case "all":
    default:
      await testAll();
      break;
  }
})();
