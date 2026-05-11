# SabiGet Backend API

A production-ready Node.js/Express backend for SabiGet - a food delivery platform with real-time vendor management, payment processing, and customer loyalty features.

**Current Status:** Phase 1 ✅ Phase 2 ✅ (Core foundation complete)

## 🚀 Quick Start

### Prerequisites

- Node.js 22.18+
- PostgreSQL 12+
- Paystack account (for payments)
- Termii account (for WhatsApp/SMS)

### Installation

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env  # Then fill in your credentials

# Initialize database
npx prisma migrate dev

# Start development server
npm run dev
```

The server will start on `http://localhost:5000`

### Environment Variables

```env
# Server
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/sabiget

# JWT Secrets (use strong random values in production)
JWT_ACCESS_SECRET=your_access_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here

# Paystack
PAYSTACK_PUBLIC_KEY=pk_test_xxxxx
PAYSTACK_SECRET_KEY=sk_test_xxxxx

# Termii
TERMII_API_KEY=your_termii_key
```

---

## 📁 Project Structure

```
backend/src/
├── app.js                    # Express server + Socket.io setup
├── middleware/
│   ├── auth.js              # JWT verification & RBAC
│   ├── rateLimiter.js       # Rate limiting (OTP, login, checkout)
│   └── errorHandler.js      # Global error handling
├── routes/
│   ├── authRoutes.js        # OTP, login, create-account, refresh, logout
│   ├── orderRoutes.js       # Order CRUD, accept/reject, DVC, complete
│   ├── vendorRoutes.js      # Vendor profile, payment setup, menu
│   ├── customerRoutes.js    # Nearby vendors, menu browsing, order tracking
│   ├── productRoutes.js     # Product CRUD
│   ├── adminRoutes.js       # Dashboard, vendor approval, disputes
│   └── webhookRoutes.js     # Paystack charge.success/failed
├── controllers/
│   ├── authController.js    # OTP & token endpoints
│   ├── memberAuthController.js  # Member login/signup
│   ├── orderController.js   # Order operations stub
│   └── vendorController.js  # Vendor operations stub
├── services/
│   ├── authService.js       # OTP generation, verification
│   ├── memberAuthService.js # Member account creation, login
│   └── orderService.js      # Order lifecycle, auto-kill, refunds
├── utils/
│   ├── jwt.js               # JWT generation & verification
│   ├── password.js          # bcryptjs password hashing
│   ├── generators.js        # OTP, DVC, idempotency key generation
│   ├── termii.js            # WhatsApp/SMS integration
│   ├── paystack.js          # Payment processing
│   └── location.js          # Geolocation, distance calculation (Haversine)
└── test/
    ├── orderRoutes.test.js
    ├── authRoutes.test.js
    ├── webhookRoutes.test.js
    └── orderService.test.js
```

---

## 🔐 Authentication Endpoints

### 1. Send OTP

```bash
POST /api/v1/auth/send-otp
Body: { phone: "+2348123456789" }

Response:
{
  "success": true,
  "message": "OTP sent via WhatsApp, SMS fallback scheduled",
  "channel": "WHATSAPP",
  "otpId": "cmosgfpep0000b3gq6sm6cpq0",
  "expiresIn": "10 minutes"
}
```

### 2. Verify OTP

```bash
POST /api/v1/auth/verify-otp
Body: { phone: "+2348123456789", code: "482917" }

Response:
{
  "success": true,
  "user": {
    "id": "user_123",
    "phone": "+2348123456789",
    "role": "GUEST",
    "loyaltyPoints": 0
  },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "expiresIn": "15 minutes"
}
```

### 3. Create Member Account

```bash
POST /api/v1/auth/create-account
Headers: Authorization: Bearer {accessToken}
Body: {
  "password": "SecurePass123!",
  "name": "John Doe",
  "email": "john@example.com"
}

Response:
{
  "success": true,
  "user": {
    "id": "user_123",
    "phone": "+2348123456789",
    "role": "MEMBER",
    "loyaltyPoints": 0
  },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

### 4. Login

```bash
POST /api/v1/auth/login
Body: {
  "phone": "+2348123456789",
  "password": "SecurePass123!"
}

Response: (same as verify-otp)
```

### 5. Refresh Access Token

```bash
POST /api/v1/auth/refresh-token
Body: { refreshToken: "eyJ..." }

Response:
{
  "success": true,
  "accessToken": "eyJ...",
  "expiresIn": "15 minutes"
}
```

### 6. Logout

```bash
POST /api/v1/auth/logout
Headers: Authorization: Bearer {accessToken}
Body: { refreshToken: "eyJ..." }

Response:
{
  "success": true,
  "message": "Logged out successfully"
}
```

### 7. Get Current User

```bash
GET /api/v1/auth/me
Headers: Authorization: Bearer {accessToken}

Response:
{
  "success": true,
  "user": {
    "id": "user_123",
    "phone": "+2348123456789",
    "email": "john@example.com",
    "name": "John Doe",
    "role": "MEMBER",
    "loyaltyPoints": 250,
    "orderCount": 5,
    "createdAt": "2025-05-11T10:30:00Z"
  }
}
```

---

## 📦 Order Endpoints

### Create Order

```bash
POST /api/v1/orders
Headers: Authorization: Bearer {accessToken}
Body: {
  "vendorId": "vendor_123",
  "items": [
    { "productId": "prod_123", "quantity": 2, "specialRequests": "No onions" },
    { "productId": "prod_124", "quantity": 1 }
  ],
  "deliveryAddress": "123 Main St, Lagos",
  "deliveryLat": 6.5244,
  "deliveryLng": 3.3792
}

Response:
{
  "success": true,
  "orderId": "ord_abc123",
  "authorizationUrl": "https://checkout.paystack.com/...",
  "paystackAccessCode": "vbn32wvs...",
  "reference": "SG-ORD-1715425800000-ABC1234D",
  "expiresIn": "1 hour"
}
```

### Get Order Details

```bash
GET /api/v1/orders/:id
Headers: Authorization: Bearer {accessToken}

Response:
{
  "success": true,
  "order": {
    "id": "ord_abc123",
    "status": "PENDING",
    "totalAmount": 4500,
    "foodCost": 3800,
    "serviceFee": 500,
    "platformFee": 200,
    "paymentReference": "SG-ORD-...",
    "dvcCode": "XJ42K9",
    "acceptanceDeadline": "2025-05-11T10:45:00Z",
    "items": [ { "productId": "...", "quantity": 2, ... } ],
    "vendor": { "id": "...", "name": "Restaurant Name", ... },
    "createdAt": "2025-05-11T10:35:00Z"
  }
}
```

### Accept Order (Vendor)

```bash
POST /api/v1/orders/:id/accept
Headers: Authorization: Bearer {vendorAccessToken}

Response:
{
  "success": true,
  "message": "Order accepted",
  "orderId": "ord_abc123",
  "status": "ACCEPTED"
}
```

### Reject Order (Vendor)

```bash
POST /api/v1/orders/:id/reject
Headers: Authorization: Bearer {vendorAccessToken}
Body: { reason: "Out of key ingredient" }

Response:
{
  "success": true,
  "message": "Order rejected and refund initiated",
  "orderId": "ord_abc123",
  "status": "REFUNDED"
}
```

### Cancel Order (Customer - before vendor accepts)

```bash
POST /api/v1/orders/:id/cancel
Headers: Authorization: Bearer {customerAccessToken}
Body: { reason: "Changed my mind" }

Response:
{
  "success": true,
  "message": "Order cancelled and refund initiated",
  "orderId": "ord_abc123",
  "status": "REFUNDED"
}
```

### Mark Out for Delivery (Vendor)

```bash
POST /api/v1/orders/:id/out-for-delivery
Headers: Authorization: Bearer {vendorAccessToken}

Response:
{
  "success": true,
  "message": "Order marked out for delivery",
  "status": "OUT_FOR_DELIVERY"
}
```

### Verify DVC (Vendor enters delivery code)

```bash
POST /api/v1/orders/:id/verify-dvc
Headers: Authorization: Bearer {vendorAccessToken}
Body: { dvcCode: "XJ42K9" }

Response:
{
  "success": true,
  "message": "DVC verified successfully. Delivery complete!",
  "orderId": "ord_abc123",
  "status": "DELIVERED"
}
```

### Complete Order (Unlock settlement)

```bash
POST /api/v1/orders/:id/complete
Headers: Authorization: Bearer {vendorAccessToken}

Response:
{
  "success": true,
  "message": "Order completed successfully",
  "status": "COMPLETED"
}
```

---

## 🌍 Vendor & Customer Endpoints

### Find Nearby Vendors

```bash
GET /api/v1/customers/nearby-vendors
Headers: Authorization: Bearer {accessToken}
Query: latitude=6.5244&longitude=3.3792&radius=5

Response:
{
  "success": true,
  "radiusKm": 5,
  "count": 12,
  "vendors": [
    {
      "id": "vendor_123",
      "name": "Restaurant Name",
      "logo": "https://...",
      "distanceKm": 2.3,
      "estimatedDeliveryMinutes": 35,
      "averageRating": 4.8,
      "totalReviews": 245,
      "metrics": {
        "acceptanceRate": 98,
        "avgPreparationTime": 15,
        "meritScore": 92
      }
    }
  ]
}
```

### Get Vendor Menu

```bash
GET /api/v1/customers/vendors/:vendorId/menu

Response:
{
  "success": true,
  "vendor": {
    "id": "vendor_123",
    "name": "Restaurant",
    "logo": "https://...",
    "averageRating": 4.8,
    "categories": [
      {
        "category": "Appetizers",
        "products": [
          {
            "id": "prod_123",
            "name": "Spring Rolls",
            "price": 800,
            "imageUrl": "https://...",
            "preparationTime": 10,
            "tags": ["vegetarian", "fried"]
          }
        ]
      }
    ]
  }
}
```

---

## 📊 Webhook Events

### Paystack charge.success

```bash
POST /api/v1/webhooks/paystack
Header: x-paystack-signature: {hmacSHA512}

Body:
{
  "event": "charge.success",
  "data": {
    "reference": "SG-ORD-1715425800000-ABC1234D",
    "amount": 450000, // in kobo (₦4500)
    "metadata": {
      "orderId": "ord_abc123",
      "vendorId": "vendor_123",
      "userId": "user_123"
    }
  }
}

Automated Actions:
✓ Order status: UNPAID → PENDING
✓ acceptanceDeadline: now + 10 minutes
✓ Vendor notification via Socket.io
```

### Paystack charge.failed

```bash
Automated Actions:
✓ Order status: UNPAID → CANCELLED_CUSTOMER
✓ adminNotes: "Payment failed before order confirmation"
```

---

## 🎯 Phase 3: Customer Experience Endpoints

### Get Nearby Vendors

```bash
GET /api/v1/customers/nearby-vendors?latitude=6.5244&longitude=3.3792&radius=5
Headers: Authorization: Bearer {accessToken}

Response:
{
  "success": true,
  "vendors": [
    {
      "id": "vendor_123",
      "name": "Pizza Palace",
      "logo": "https://...",
      "distanceKm": "0.5",
      "averageRating": 4.8,
      "totalReviews": 142,
      "acceptanceRate": 0.98,
      "estimatedDeliveryMinutes": 15
    }
  ]
}
```

### Get Vendor Menu

```bash
GET /api/v1/customers/vendors/:vendorId/menu
Headers: Authorization: Bearer {accessToken} (optional)

Response:
{
  "success": true,
  "vendor": { "id": "...", "name": "Pizza Palace", ... },
  "categories": [
    {
      "name": "Pizzas",
      "products": [
        {
          "id": "prod_123",
          "name": "Pepperoni",
          "price": 3500,
          "description": "Classic pepperoni pizza",
          "image": "https://..."
        }
      ]
    }
  ],
  "metrics": {
    "totalOrders": 1200,
    "averageRating": 4.8,
    "acceptanceRate": 0.98
  }
}
```

### Get Order History

```bash
GET /api/v1/customers/order-history?page=1&limit=10&status=COMPLETED
Headers: Authorization: Bearer {accessToken}

Query Parameters:
- page: Page number (default: 1)
- limit: Results per page (default: 10, max: 50)
- status: Filter by order status (optional)

Response:
{
  "success": true,
  "orders": [
    {
      "id": "ord_abc123",
      "status": "COMPLETED",
      "totalAmount": 4500,
      "createdAt": "2025-05-10T14:30:00Z",
      "completedAt": "2025-05-10T14:45:00Z",
      "vendor": {
        "id": "vendor_123",
        "name": "Pizza Palace",
        "logo": "https://..."
      },
      "itemCount": 2,
      "rating": 5,
      "reviewId": "rev_123"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 15,
    "totalPages": 2
  }
}
```

### Submit Order Review

```bash
POST /api/v1/customers/orders/:orderId/review
Headers: Authorization: Bearer {accessToken}
Body: {
  "rating": 5,
  "comment": "Amazing food and fast delivery!",
  "foodQuality": 5,
  "deliverySpeed": 4,
  "driverBehavior": 5
}

Validation:
- rating: Required, must be 1-5
- comment: Optional, max 500 chars
- foodQuality, deliverySpeed, driverBehavior: Optional, 1-5 if provided

Response:
{
  "success": true,
  "message": "Review submitted successfully",
  "review": {
    "id": "rev_123",
    "rating": 5,
    "comment": "Amazing food and fast delivery!",
    "createdAt": "2025-05-10T14:50:00Z"
  }
}
```

### Get Vendor Reviews

```bash
GET /api/v1/customers/vendors/:vendorId/reviews?page=1&limit=10&sortBy=recent
Headers: Authorization: Bearer {accessToken} (optional)

Query Parameters:
- page: Page number (default: 1)
- limit: Results per page (default: 10, max: 50)
- sortBy: recent | highest | lowest (default: recent)

Response:
{
  "success": true,
  "vendor": {
    "id": "vendor_123",
    "name": "Pizza Palace",
    "averageRating": 4.8,
    "totalReviews": 143
  },
  "reviews": [
    {
      "id": "rev_123",
      "rating": 5,
      "comment": "Amazing food and fast delivery!",
      "foodQuality": 5,
      "deliverySpeed": 4,
      "driverBehavior": 5,
      "user": {
        "id": "user_123",
        "name": "John D."
      },
      "createdAt": "2025-05-10T14:50:00Z"
    }
  ],
  "ratingDistribution": {
    "5": 120,
    "4": 18,
    "3": 3,
    "2": 2,
    "1": 0
  },
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 143,
    "totalPages": 15
  }
}
```

### Get Order Review

```bash
GET /api/v1/customers/orders/:orderId/review
Headers: Authorization: Bearer {accessToken}

Response:
{
  "success": true,
  "review": {
    "id": "rev_123",
    "rating": 5,
    "comment": "Amazing food and fast delivery!",
    "foodQuality": 5,
    "deliverySpeed": 4,
    "driverBehavior": 5,
    "vendor": {
      "id": "vendor_123",
      "name": "Pizza Palace"
    },
    "createdAt": "2025-05-10T14:50:00Z",
    "updatedAt": "2025-05-10T14:50:00Z"
  }
}
```

### Get Loyalty Points

```bash
GET /api/v1/customers/loyalty-points
Headers: Authorization: Bearer {accessToken}

Response:
{
  "success": true,
  "loyaltyPoints": 350,
  "pointsEarned": 450,
  "pointsRedeemed": 100,
  "tier": "LOYAL",
  "earningRate": 0.02,
  "nextTier": {
    "name": "PLATINUM",
    "ordersNeeded": 10,
    "ordersCompleted": 4
  }
}
```

### Redeem Loyalty Points

```bash
POST /api/v1/customers/loyalty-points/redeem
Headers: Authorization: Bearer {accessToken}
Body: {
  "pointsToRedeem": 100
}

Validation:
- pointsToRedeem: Minimum 50 points
- Must have sufficient points balance

Response:
{
  "success": true,
  "message": "Redeemed 100 points for ₦100 discount",
  "pointsRedeemed": 100,
  "discountNaira": 100,
  "remainingPoints": 250
}
```

### Get Customer Insights

```bash
GET /api/v1/customers/insights
Headers: Authorization: Bearer {accessToken}

Response:
{
  "success": true,
  "insights": {
    "totalOrders": 12,
    "totalSpent": 45000,
    "avgOrderValue": 3750,
    "recentOrdersThisMonth": 3,
    "frequencyPerWeek": "0.8",
    "favoriteVendor": {
      "id": "vendor_123",
      "name": "Pizza Palace",
      "logo": "https://..."
    },
    "loyaltyTier": "LOYAL",
    "pointsBalance": 350
  }
}
```

### Get Personalized Recommendations

```bash
GET /api/v1/customers/recommendations?latitude=6.5244&longitude=3.3792&radius=5
Headers: Authorization: Bearer {accessToken}

Query Parameters:
- latitude: Customer's latitude (required)
- longitude: Customer's longitude (required)
- radius: Search radius in km (default: 5)

Response:
{
  "success": true,
  "recommendations": [
    {
      "id": "vendor_123",
      "name": "Pizza Palace",
      "logo": "https://...",
      "distanceKm": "0.5",
      "rating": 4.8,
      "isFavorite": true,
      "reason": "You frequently order from here"
    },
    {
      "id": "vendor_456",
      "name": "Burger King",
      "logo": "https://...",
      "distanceKm": "1.2",
      "rating": 4.6,
      "isFavorite": false,
      "reason": "Highly rated in your area"
    }
  ]
}
```

---

## ⚡ Rate Limiting

| Endpoint                                                 | Limit    | Window              |
| -------------------------------------------------------- | -------- | ------------------- |
| POST /auth/send-otp                                      | 3        | 1 hour (per phone)  |
| POST /auth/login, /auth/verify-otp, /auth/create-account | 5 failed | 15 minutes (per IP) |
| POST /orders (checkout)                                  | 10       | 1 hour (per IP)     |
| General API                                              | 100      | 15 minutes (per IP) |

---

## 🗄️ Database Schema Overview

### User

```
id (CUID)
phone (unique)
email (optional)
name
password (optional, NULL for GUEST)
role (GUEST | MEMBER | VENDOR | ADMIN | SUPER_ADMIN)
loyaltyPoints, pointsEarned, pointsRedeemed
isVerified, verifiedAt, lastLoginAt
createdAt, updatedAt
```

### Order

```
id (CUID)
userId, vendorId
status (UNPAID | PENDING | ACCEPTED | OUT_FOR_DELIVERY | DELIVERED | COMPLETED | CANCELLED_* | REFUNDED)
totalAmount, foodCost, serviceFee, platformFee
paymentReference, paystackAccessCode
dvcCode (6-char), dvcAttempts (0-3), dvcLockedUntil (nullable)
acceptanceDeadline (nullable), autoKilledAt (nullable)
deliveryAddress, deliveryLat, deliveryLng
createdAt, acceptedAt, preparedAt, deliveredAt, completedAt, cancelledAt, refundInitiatedAt, refundCompletedAt
```

### RefreshToken

```
id (CUID)
token (unique)
userId (CASCADE delete)
revokedAt (nullable), expiresAt
createdAt
```

---

## 🔌 Real-time Socket.io Events

### Vendor Joins Channel

```javascript
socket.emit("vendor:join", vendorId);
socket.on("connection:success", {
  vendorId,
  message: "Connected to vendor notifications",
});
```

### New Order Alert

```javascript
socket.on("order:new", {
  orderId,
  vendorId,
  status,
  totalAmount,
  deliveryAddress,
  acceptanceDeadline,
  customer: { id, name, phone },
  items: [{ quantity, totalPrice, product: { name } }],
});
```

### Order Status Update

```javascript
socket.emit("order:statusUpdate", { vendorId, orderId, status });
socket.on("order:statusUpdated", { orderId, status });
```

---

## ✅ Phase Checklist

### Phase 1: Stabilization ✅

- [x] JWT payload standardized: `{ userId, role }`
- [x] Order statuses aligned to Prisma schema
- [x] Refresh token generation consistent
- [x] Consolidated DVC utilities (removed duplicates)
- [x] Consolidated location utilities (removed duplicates)
- [x] README updated with current state

### Phase 2: Core Transaction Flow ✅

- [x] Paystack webhook: charge.success (UNPAID → PENDING)
- [x] Paystack webhook: charge.failed (UNPAID → CANCELLED_CUSTOMER)
- [x] Vendor reject flow with refund handling
- [x] Customer cancel flow with refund handling
- [x] 10-minute auto-kill timer for unaccepted orders
- [x] DVC completion: ACCEPTED → OUT_FOR_DELIVERY → DELIVERED → COMPLETED

### Phase 3: Customer Experience ✅

- [x] Nearby vendors endpoint with distance sorting
- [x] Vendor menu endpoint with categories
- [x] Customer order tracking with full details
- [x] Loyalty points balance and tier system
- [x] Order history with pagination and status filtering
- [x] Review submission with rating aggregation
- [x] Vendor reviews listing with sorting and distribution
- [x] Customer insights (spend, frequency, preferences)
- [x] Personalized vendor recommendations
- [x] Loyalty points redemption (50+ points = discount)
- [x] Automatic points crediting on order completion

### Phase 4: Vendor Operations ⏳

- [ ] Vendor dashboard stats
- [ ] KYB field validation
- [ ] Vendor metrics updates from order events
- [ ] Real-time vendor alerts enhancement

### Phase 5: Admin Operations ⏳

- [ ] Vendor approval/rejection
- [ ] Vendor deactivation with audit logs
- [ ] Order list/detail for investigations
- [ ] Force refund flow
- [ ] Disputes and audit log queries
- [ ] Dashboard analytics

### Phase 6: Reliability ⏳

- [ ] Unit tests for auth services
- [ ] Integration tests for auth/order/webhook flows
- [ ] Test: payment failure, OTP expiry, invalid DVC, unauthorized access

---

## 🧪 Testing

```bash
npm test                          # Run all tests
npm test -- authService.test.js   # Specific file
npm run test:watch                # Watch mode
npm run test:coverage             # Coverage report
```

---

## 📝 Development Notes

### Common Tasks

**View server logs:**

```bash
npm run dev  # With nodemon auto-reload
```

**Reset database:**

```bash
npx prisma migrate reset  # ⚠️ Caution: Deletes all data!
```

**Seed test data:**

```bash
npx prisma db seed
```

**Check Prisma:**

```bash
npx prisma studio  # GUI at http://localhost:5555
```

---

## 🛟 Troubleshooting

| Issue                     | Solution                                              |
| ------------------------- | ----------------------------------------------------- |
| JWT token rejected        | Ensure `JWT_ACCESS_SECRET` & `JWT_REFRESH_SECRET` set |
| Paystack returns 401      | Verify `PAYSTACK_SECRET_KEY` is correct               |
| OTP not sending           | Check `TERMII_API_KEY` and network connection         |
| Database connection error | Verify `DATABASE_URL` format and PostgreSQL running   |
| Rate limiter blocking     | Wait for time window or restart server                |

---

**Last Updated:** May 2025  
**Maintainers:** SabiGet Development Team  
**License:** TBD

- **Guests earn**, can't redeem (encourages account creation)
- **Redemption gated**: Set password → unlock points
- **Formula**:
  - First 3 orders: 5% of food cost
  - Orders 4+: 2% of food cost
  - Applied on checkout: "You have ₦450 in points available!"

---

## 🛠️ API Endpoints (Summary)

### Auth

- `POST /api/v1/auth/send-otp` - Send OTP via WhatsApp/SMS
- `POST /api/v1/auth/verify-otp` - Verify OTP, get JWT tokens
- `POST /api/v1/auth/create-account` - Convert authenticated GUEST to MEMBER
- `POST /api/v1/auth/login` - Login with phone + password
- `GET /api/v1/auth/me` - Get current authenticated user
- `POST /api/v1/auth/refresh-token` - Get new access token
- `POST /api/v1/auth/logout` - Logout

### Customers

- `GET /api/v1/customers/nearby-vendors` - Find vendors (5km radius)
- `GET /api/v1/customers/vendors/:id/menu` - Browse menu
- `GET /api/v1/customers/orders/:id` - Track order
- `GET /api/v1/customers/loyalty-points` - Check points balance
- `POST /api/v1/customers/create-account` - Convert GUEST → MEMBER

### Orders

- `POST /api/v1/orders` - Create order
- `PUT /api/v1/orders/:id/accept` - Vendor accepts order
- `PUT /api/v1/orders/:id/status` - Update status (PREPARING, OUT_FOR_DELIVERY)
- `POST /api/v1/orders/:id/dvc-verify` - Enter DVC code
- `POST /api/v1/orders/:id/dispute` - Report issue

### Vendors

- `POST /api/v1/vendors/register` - Vendor signup (KYB upload)
- `GET /api/v1/vendors/me` - Get own profile
- `PUT /api/v1/vendors/me` - Update profile
- `POST /api/v1/vendors/me/products` - Add product
- `GET /api/v1/vendors/me/orders` - Incoming orders queue

### Admin

- `GET /api/v1/admin/vendors?pending` - Pending vendor approvals
- `PUT /api/v1/admin/vendors/:id/verify` - Approve vendor KYB
- `PUT /api/v1/admin/orders/:id/force-refund` - Manual refund
- `GET /api/v1/admin/dashboard` - Revenue, GMV, vendor heatmaps
- `GET /api/v1/admin/audit-logs` - Compliance audit trail

### Webhooks

- `POST /api/v1/webhooks/paystack` - Paystack callbacks

---

## 📊 Database Entities

### Core Models

- **User**: Customers (GUEST/MEMBER), Vendors, Admins
- **Vendor**: Business info, location, KYB status, Paystack sub-account
- **Product**: Menu items with pricing & availability
- **Order**: State machine, payment tracking, DVC code
- **OrderItem**: Line items in orders

### Support Models

- **OTPLog**: Track OTP requests for rate limiting
- **WebhookLog**: Paystack callback history
- **VendorMetrics**: Rankings, acceptance rates, etc.
- **AuditLog**: Admin actions for compliance (NDPA)
- **RateLimitLog**: Rate limit tracking
- **PaymentSettlement**: T+1 vendor payouts
- **DisputeReport**: Customer dispute management

---

## 🔐 Security & Compliance

### OWASP Top 10

- ✅ Authentication via JWT (not sessions)
- ✅ Rate limiting prevents brute-force
- ✅ HTTPS ready (deploy to Vercel/Railway)
- ✅ CORS configured for frontend origin
- ✅ Helmet adds security headers
- ✅ Password hashing via bcryptjs
- ✅ SQL injection prevented (Prisma ORM)
- ✅ CSRF protection (stateless JWT)

### Nigerian Compliance

- ✅ **NDPA**: Audit logs track all admin access
- ✅ **CBN**: KYB verification for vendors before payout
- ✅ **CAC**: Vendor registration number verified
- ✅ **NIN/BVN**: Required for vendor withdrawals
- ✅ **No COD**: Pre-payment model prevents fraud

---

## 🚀 Deployment

### Development

```bash
npm run dev  # Runs on http://localhost:5000
```

### Production (Railway)

```bash
# Connect your GitHub repo to Railway
# Railway auto-deploys on git push
# Set environment variables in Railway dashboard
npm run prisma:migrate:deploy  # Run migrations
npm start
```

### Environment Setup

```bash
# Example production variables
DATABASE_URL=postgresql://user:pass@railway.railway.internal:5432/sabiget
NODE_ENV=production
PAYSTACK_SECRET_KEY=sk_live_xxxxx
FRONTEND_URL=https://sabiget.vercel.app
```

---

## 📋 TODO: Implementation Roadmap

### Phase 1: Core Auth (Week 1)

- [x] Implement OTP logic (Termii integration)
- [x] JWT token generation & refresh
- [x] User creation (GUEST signup)
- [ ] Rate limiting tests

### Phase 2: Payments (Week 2)

- [ ] Paystack sub-account creation (vendor onboarding)
- [ ] Order creation with split payment
- [ ] Webhook receiver for payment confirmation
- [ ] Refund logic (reverse-split)

### Phase 3: Order Management (Week 2-3)

- [ ] Order state machine implementation
- [ ] 10-min auto-kill timer
- [ ] DVC code generation & verification
- [ ] Vendor order acceptance flow

### Phase 4: Marketplace (Week 3)

- [ ] Geolocation filtering (5km radius)
- [ ] Vendor nearby search
- [ ] Product catalog browsing
- [ ] Shopping cart logic

### Phase 5: Realtime & Notifications (Week 4)

- [ ] Socket.io vendor notifications
- [ ] SMS fallback (Termii)
- [ ] Order status updates to customers
- [ ] WhatsApp messages

### Phase 6: Admin & Analytics (Week 4-5)

- [ ] Admin dashboard skeleton
- [ ] Vendor approval flow (KYB)
- [ ] Revenue reports (GMV, payouts)
- [ ] Vendor heatmaps
- [ ] Dispute management

### Phase 7: Testing & DevOps (Week 5)

- [ ] Unit tests (controllers, services)
- [ ] Integration tests (API endpoints)
- [ ] Load testing
- [ ] Database optimization
- [ ] Docker setup
- [ ] CI/CD pipeline (GitHub Actions)

---

## 📞 Support & Debugging

### Common Issues

**Prisma Client Error**

```bash
npm run prisma:generate
npm run prisma:migrate
```

**Database Connection Failed**

```bash
# Check DATABASE_URL in .env
# Verify PostgreSQL is running
psql -U postgres -h localhost
```

**Paystack Webhook Not Firing**

- Confirm webhook URL in Paystack dashboard
- Check x-paystack-signature verification
- View webhook logs in Paystack dashboard

**Socket.io Not Connecting**

- Check CORS origin matches frontend URL
- Verify Socket.io is listening (check app.js logs)
- Use Socket.io debugging: `localStorage.debug = '*'`

---

## 📚 References

- **Paystack Docs**: https://paystack.com/docs/api/
- **Termii Docs**: https://termii.com/docs/
- **Prisma ORM**: https://www.prisma.io/docs/
- **Express.js**: https://expressjs.com/
- **Socket.io**: https://socket.io/docs/

---

**Last Updated**: May 10, 2026
**Status**: Core auth is implemented, payments/orders are partially implemented, and customer/admin flows are still in progress
