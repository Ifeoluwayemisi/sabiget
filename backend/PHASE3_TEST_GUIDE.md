# Phase 3: Customer Experience - Test Guide

Comprehensive testing guide for all Phase 3 customer experience endpoints.

**Prerequisites:**

- Backend running: `npm run dev`
- Test database seeded with vendors, products, orders
- Postman or curl installed

---

## 📋 Test Setup

### 1. Create Test User

First, create a guest user and obtain an access token:

```bash
POST /api/v1/auth/send-otp
Body: { "phone": "+2348123456789" }

# Use OTP from terminal output (if using mock Termii)
POST /api/v1/auth/verify-otp
Body: { "phone": "+2348123456789", "code": "123456" }

Response: { "accessToken": "eyJhbGc...", "refreshToken": "...", "user": { "id": "user_123" } }
```

Save the `accessToken` and `userId` for subsequent tests.

### 2. Create Test Orders

Create completed orders for review/history testing:

```bash
# First order
POST /api/v1/orders
Headers: Authorization: Bearer {accessToken}
Body: {
  "vendorId": "{vendor_id}",
  "items": [
    { "productId": "{product_id}", "quantity": 2 }
  ],
  "deliveryAddress": "123 Main St, Lagos",
  "deliveryLat": 6.5244,
  "deliveryLng": 3.3792
}

# Complete the Paystack payment flow, then mark order as completed
# Run this helper to simulate order completion:
GET /api/v1/orders/{orderId}  # Check status after payment webhook
```

---

## 🧪 Test Cases

### Test 1: Get Nearby Vendors ✅

**Endpoint:** `GET /api/v1/customers/nearby-vendors`

```bash
curl -X GET "http://localhost:5000/api/v1/customers/nearby-vendors?latitude=6.5244&longitude=3.3792&radius=5" \
  -H "Authorization: Bearer {accessToken}"
```

**Expected Response:**

- ✅ Status 200
- ✅ Returns array of vendors with distance sorted (closest first)
- ✅ Each vendor has: id, name, logo, distanceKm, averageRating, acceptanceRate, estimatedDeliveryMinutes

**Validation:**

- [ ] Vendors within radius only
- [ ] Sorted by distance ascending
- [ ] Estimated delivery time calculated
- [ ] Rating and acceptance rate populated

**Edge Cases:**

```bash
# Invalid coordinates
curl -X GET "http://localhost:5000/api/v1/customers/nearby-vendors?latitude=200&longitude=500" \
  -H "Authorization: Bearer {accessToken}"
# Should return 400: Invalid coordinates

# No vendors in radius
curl -X GET "http://localhost:5000/api/v1/customers/nearby-vendors?latitude=50&longitude=50&radius=1" \
  -H "Authorization: Bearer {accessToken}"
# Should return empty vendors array
```

---

### Test 2: Get Vendor Menu ✅

**Endpoint:** `GET /api/v1/customers/vendors/{vendorId}/menu`

```bash
curl -X GET "http://localhost:5000/api/v1/customers/vendors/vendor_123/menu"
```

**Expected Response:**

- ✅ Status 200
- ✅ Vendor info with name, logo
- ✅ Categories array with products grouped
- ✅ Each product has: id, name, price, description, image

**Validation:**

- [ ] Products grouped by category
- [ ] Vendor metrics populated (totalOrders, averageRating, acceptanceRate)
- [ ] Prices in correct format (kobo/naira)

**Edge Cases:**

```bash
# Vendor not found
curl -X GET "http://localhost:5000/api/v1/customers/vendors/invalid_id/menu"
# Should return 404
```

---

### Test 3: Get Order History ✅

**Endpoint:** `GET /api/v1/customers/order-history`

```bash
# Basic request
curl -X GET "http://localhost:5000/api/v1/customers/order-history" \
  -H "Authorization: Bearer {accessToken}"

# With pagination
curl -X GET "http://localhost:5000/api/v1/customers/order-history?page=1&limit=5" \
  -H "Authorization: Bearer {accessToken}"

# With status filter
curl -X GET "http://localhost:5000/api/v1/customers/order-history?status=COMPLETED" \
  -H "Authorization: Bearer {accessToken}"
```

**Expected Response:**

- ✅ Status 200
- ✅ Orders array sorted by createdAt descending
- ✅ Pagination metadata: page, limit, total, totalPages
- ✅ Each order includes: id, status, totalAmount, vendor, itemCount, rating, reviewId

**Validation:**

- [ ] Most recent orders first
- [ ] Pagination works correctly
- [ ] Status filter applied
- [ ] Review status (rating/reviewId) populated if exists

**Edge Cases:**

```bash
# Without auth token
curl -X GET "http://localhost:5000/api/v1/customers/order-history"
# Should return 401

# Limit exceeds max
curl -X GET "http://localhost:5000/api/v1/customers/order-history?limit=100"
# Should cap at 50

# Page out of range
curl -X GET "http://localhost:5000/api/v1/customers/order-history?page=999"
# Should return empty array with pagination info
```

---

### Test 4: Submit Order Review ✅

**Endpoint:** `POST /api/v1/customers/orders/{orderId}/review`

```bash
curl -X POST "http://localhost:5000/api/v1/customers/orders/ord_123/review" \
  -H "Authorization: Bearer {accessToken}" \
  -H "Content-Type: application/json" \
  -d '{
    "rating": 5,
    "comment": "Amazing food and fast delivery!",
    "foodQuality": 5,
    "deliverySpeed": 4,
    "driverBehavior": 5
  }'
```

**Expected Response:**

- ✅ Status 201
- ✅ Review created with id, rating, comment, createdAt
- ✅ Vendor averageRating updated
- ✅ Vendor totalReviews incremented

**Validation:**

- [ ] Rating must be 1-5
- [ ] Comment max 500 characters
- [ ] Optional fields (foodQuality, etc) validated 1-5
- [ ] Authorization: only customer can review their own order
- [ ] Order must be COMPLETED or DELIVERED status
- [ ] No duplicate reviews allowed

**Test Cases:**

```bash
# Invalid rating
curl -X POST "http://localhost:5000/api/v1/customers/orders/ord_123/review" \
  -H "Authorization: Bearer {accessToken}" \
  -d '{ "rating": 10 }'
# Should return 400: Rating must be between 1 and 5

# Comment too long
curl -X POST "http://localhost:5000/api/v1/customers/orders/ord_123/review" \
  -H "Authorization: Bearer {accessToken}" \
  -d '{ "rating": 5, "comment": "' + (560 chars) + '" }'
# Should return 400: Comment must be 500 characters or less

# Duplicate review
curl -X POST "http://localhost:5000/api/v1/customers/orders/ord_123/review" \
  -H "Authorization: Bearer {accessToken}" \
  -d '{ "rating": 5 }'
# First call: 201 Created
# Second call: 400 You have already reviewed this order

# Order not completed
curl -X POST "http://localhost:5000/api/v1/customers/orders/ord_pending/review" \
  -H "Authorization: Bearer {accessToken}" \
  -d '{ "rating": 5 }'
# Should return 400: Can only review completed or delivered orders

# Not customer's order
curl -X POST "http://localhost:5000/api/v1/customers/orders/other_customer_order/review" \
  -H "Authorization: Bearer {accessToken}" \
  -d '{ "rating": 5 }'
# Should return 403: Not authorized to review this order
```

---

### Test 5: Get Vendor Reviews ✅

**Endpoint:** `GET /api/v1/customers/vendors/{vendorId}/reviews`

```bash
# Get recent reviews
curl -X GET "http://localhost:5000/api/v1/customers/vendors/vendor_123/reviews?sortBy=recent&page=1&limit=10"

# Get highest rated
curl -X GET "http://localhost:5000/api/v1/customers/vendors/vendor_123/reviews?sortBy=highest"

# Get lowest rated
curl -X GET "http://localhost:5000/api/v1/customers/vendors/vendor_123/reviews?sortBy=lowest"
```

**Expected Response:**

- ✅ Status 200
- ✅ Vendor info with name, averageRating, totalReviews
- ✅ Reviews array with sorting applied
- ✅ Rating distribution: { 5: count, 4: count, ... }
- ✅ Pagination metadata

**Validation:**

- [ ] Sorting applied correctly (recent = createdAt desc, highest = rating desc, etc)
- [ ] Rating distribution calculated correctly
- [ ] Sum of distribution equals totalReviews
- [ ] Each review includes: rating, comment, user (id, name), quality metrics
- [ ] Pagination works

**Edge Cases:**

```bash
# Vendor not found
curl -X GET "http://localhost:5000/api/v1/customers/vendors/invalid/reviews"
# Should return 404

# No reviews yet
curl -X GET "http://localhost:5000/api/v1/customers/vendors/vendor_new/reviews"
# Should return 200 with empty reviews array and zero distribution
```

---

### Test 6: Get Order Review ✅

**Endpoint:** `GET /api/v1/customers/orders/{orderId}/review`

```bash
# Get review (if exists)
curl -X GET "http://localhost:5000/api/v1/customers/orders/ord_123/review" \
  -H "Authorization: Bearer {accessToken}"

# Get review (not submitted yet)
curl -X GET "http://localhost:5000/api/v1/customers/orders/ord_456/review" \
  -H "Authorization: Bearer {accessToken}"
```

**Expected Response (with review):**

- ✅ Status 200
- ✅ Review object with full details (rating, comment, quality metrics)
- ✅ Vendor info included

**Expected Response (no review):**

- ✅ Status 200
- ✅ review: null
- ✅ Message: "No review found for this order"

**Validation:**

- [ ] Authorization: only customer can view their review
- [ ] Full review details returned if exists
- [ ] Proper response if no review yet

---

### Test 7: Get Loyalty Points ✅

**Endpoint:** `GET /api/v1/customers/loyalty-points`

```bash
curl -X GET "http://localhost:5000/api/v1/customers/loyalty-points" \
  -H "Authorization: Bearer {accessToken}"
```

**Expected Response:**

- ✅ Status 200
- ✅ loyaltyPoints: Current balance
- ✅ pointsEarned: Total earned lifetime
- ✅ pointsRedeemed: Total redeemed lifetime
- ✅ tier: STANDARD | LOYAL | PLATINUM
- ✅ earningRate: 0.05 (first 3 orders) or 0.02 (after)
- ✅ nextTier: { name, ordersNeeded, ordersCompleted }

**Validation:**

- [ ] Tier matches orderCount (STANDARD: <4, LOYAL: 4-9, PLATINUM: 10+)
- [ ] Earning rate correct based on orderCount
- [ ] Points calculations correct

---

### Test 8: Redeem Loyalty Points ✅

**Endpoint:** `POST /api/v1/customers/loyalty-points/redeem`

```bash
# Redeem 100 points (for ₦100 discount)
curl -X POST "http://localhost:5000/api/v1/customers/loyalty-points/redeem" \
  -H "Authorization: Bearer {accessToken}" \
  -H "Content-Type: application/json" \
  -d '{ "pointsToRedeem": 100 }'
```

**Expected Response:**

- ✅ Status 200
- ✅ Message: "Redeemed X points for ₦Y discount"
- ✅ pointsRedeemed: X
- ✅ discountNaira: Y (same as X for 1:1 conversion)
- ✅ remainingPoints: Updated balance

**Validation:**

- [ ] Minimum 50 points required
- [ ] User has sufficient points
- [ ] Points deducted from balance
- [ ] pointsRedeemed incremented
- [ ] Discount calculated correctly (1:1)

**Test Cases:**

```bash
# Below minimum
curl -X POST "http://localhost:5000/api/v1/customers/loyalty-points/redeem" \
  -d '{ "pointsToRedeem": 25 }'
# Should return 400: Minimum 50 points required for redemption

# Insufficient balance
curl -X POST "http://localhost:5000/api/v1/customers/loyalty-points/redeem" \
  -d '{ "pointsToRedeem": 1000 }'
# Should return 400: Insufficient loyalty points

# Valid redemption twice
# First call: 200 OK with updated balance
# Second call (different amount, sufficient balance): 200 OK
```

---

### Test 9: Get Customer Insights ✅

**Endpoint:** `GET /api/v1/customers/insights`

```bash
curl -X GET "http://localhost:5000/api/v1/customers/insights" \
  -H "Authorization: Bearer {accessToken}"
```

**Expected Response:**

- ✅ Status 200
- ✅ insights object with:
  - totalOrders: Count of completed orders
  - totalSpent: Sum of order totals
  - avgOrderValue: totalSpent / totalOrders
  - recentOrdersThisMonth: Count of orders in last 30 days
  - frequencyPerWeek: Orders per week (30-day average)
  - favoriteVendor: Most frequently ordered vendor
  - loyaltyTier: Current tier
  - pointsBalance: Current loyalty points

**Validation:**

- [ ] Calculations correct (especially avgOrderValue)
- [ ] 30-day window working correctly
- [ ] Favorite vendor is most frequently ordered
- [ ] All fields populated

---

### Test 10: Get Personalized Recommendations ✅

**Endpoint:** `GET /api/v1/customers/recommendations`

```bash
curl -X GET "http://localhost:5000/api/v1/customers/recommendations?latitude=6.5244&longitude=3.3792&radius=5" \
  -H "Authorization: Bearer {accessToken}"
```

**Expected Response:**

- ✅ Status 200
- ✅ recommendations array with up to 5 vendors
- ✅ Each includes: id, name, logo, distanceKm, rating, isFavorite, reason

**Validation:**

- [ ] Favorite vendors prioritized first (isFavorite: true)
- [ ] Then sorted by rating
- [ ] Within specified radius
- [ ] Reason provided ("You frequently order from here" or "Highly rated in your area")
- [ ] Max 5 recommendations

**Test Cases:**

```bash
# Missing coordinates
curl -X GET "http://localhost:5000/api/v1/customers/recommendations" \
  -H "Authorization: Bearer {accessToken}"
# Should return 400: Latitude and longitude required

# Invalid coordinates
curl -X GET "http://localhost:5000/api/v1/customers/recommendations?latitude=500&longitude=500" \
  -H "Authorization: Bearer {accessToken}"
# Should return 400: Invalid coordinates

# Custom radius
curl -X GET "http://localhost:5000/api/v1/customers/recommendations?latitude=6.5244&longitude=3.3792&radius=20"
# Should return recommendations within 20km
```

---

### Test 11: Create Member Account (Conversion) ✅

**Endpoint:** `POST /api/v1/customers/create-account`

```bash
curl -X POST "http://localhost:5000/api/v1/customers/create-account" \
  -H "Authorization: Bearer {guestAccessToken}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "SecurePass123!"
  }'
```

**Expected Response:**

- ✅ Status 200
- ✅ User converted from GUEST to MEMBER
- ✅ New accessToken and refreshToken issued
- ✅ User object with updated role: "MEMBER"

**Validation:**

- [ ] Password required and stored securely (hashed)
- [ ] Email validation
- [ ] Name updated
- [ ] Role changed: GUEST → MEMBER
- [ ] New tokens issued

---

## 🔄 Integration Tests

### Test 12: Complete Order-to-Review Flow

```bash
# 1. Create order
POST /api/v1/orders
# Get orderId from response

# 2. Complete payment (simulate webhook)
# Manually run: GET /api/v1/orders/{orderId}

# 3. Check loyalty points before
GET /api/v1/customers/loyalty-points

# 4. Mark order as completed
# Trigger via admin endpoint or webhook simulation

# 5. Check loyalty points after
GET /api/v1/customers/loyalty-points
# Should show increased loyaltyPoints and pointsEarned

# 6. Submit review
POST /api/v1/customers/orders/{orderId}/review

# 7. Check order history
GET /api/v1/customers/order-history

# 8. View vendor reviews
GET /api/v1/customers/vendors/{vendorId}/reviews

# Validation:
# - Points increased by correct amount (5% or 2% of food cost)
# - Order appears in history with review
# - Vendor rating updated
```

### Test 13: Authorization & Security

```bash
# Without token
GET /api/v1/customers/loyalty-points
# Should return 401

# With invalid token
GET /api/v1/customers/loyalty-points \
  -H "Authorization: Bearer invalid_token"
# Should return 401

# Try to access other user's data
GET /api/v1/customers/order-history \
  -H "Authorization: Bearer token_of_user_B"
# Should only return user_B's orders

# Try to review order not owned
POST /api/v1/customers/orders/other_users_order/review \
  -H "Authorization: Bearer {accessToken}"
# Should return 403
```

---

## 📊 Loyalty Points Validation

**Points Calculation:**

- First 3 orders: 5% of food cost
- After 3 orders: 2% of food cost
- Conversion: 100 points = ₦100 (1:1 ratio)

**Example:**

```
Order 1: ₦3000 food cost × 5% = 150 points
Order 2: ₦2500 food cost × 5% = 125 points
Order 3: ₦3500 food cost × 5% = 175 points
Order 4: ₦4000 food cost × 2% = 80 points
Order 5: ₦3000 food cost × 2% = 60 points

Total: 590 points
Tier: LOYAL (4 completed orders)
Earning Rate: 2% (after 3 orders)
```

---

## 🐛 Known Issues & Workarounds

### Issue 1: Loyalty Points Not Updating

**Cause:** Order completion webhook not firing
**Workaround:** Manually trigger via admin endpoint or test database

### Issue 2: Vendor Rating Calculation Incorrect

**Cause:** Floating point precision
**Solution:** Use .toFixed(1) for display, actual value in DB

### Issue 3: Location Validation Too Strict

**Cause:** Haversine formula expects valid coordinates
**Fix:** Use test coordinates: lat 6.5244, lng 3.3792 (Lagos, Nigeria)

---

## ✅ Checklist for Complete Phase 3 Validation

- [ ] Test 1: Nearby Vendors - All cases pass
- [ ] Test 2: Vendor Menu - All cases pass
- [ ] Test 3: Order History - All cases pass
- [ ] Test 4: Submit Review - All cases pass
- [ ] Test 5: Vendor Reviews - All cases pass
- [ ] Test 6: Order Review - All cases pass
- [ ] Test 7: Loyalty Points - Balance correct
- [ ] Test 8: Redeem Points - Balance updates
- [ ] Test 9: Customer Insights - Calculations accurate
- [ ] Test 10: Recommendations - Priorities correct
- [ ] Test 11: Create Account - Conversion successful
- [ ] Test 12: Order-to-Review Flow - Complete cycle works
- [ ] Test 13: Authorization - Properly enforced
- [ ] All error cases handled correctly
- [ ] Database state consistent after operations

---

**Last Updated:** Phase 3 Implementation Complete
**Status:** Ready for production testing
