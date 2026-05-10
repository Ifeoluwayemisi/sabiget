# SabiGet Backend - Setup & Documentation

## 🚀 Quick Start

### Prerequisites

- Node.js (v16+)
- PostgreSQL (v12+)
- Redis (optional, for caching)
- Paystack account (for payments)
- Termii account (for WhatsApp/SMS)

### Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Setup database
npm run prisma:migrate

# Create .env file (copy from .env.example and fill in values)
cp .env.example .env

# Start development server
npm run dev
```

### Environment Variables

See `.env.example` for all required variables:

- `DATABASE_URL` - PostgreSQL connection
- `JWT_ACCESS_SECRET` & `JWT_REFRESH_SECRET` - For token signing
- `PAYSTACK_SECRET_KEY` - Paystack integration
- `TERMII_API_KEY` - SMS/WhatsApp service
- `REDIS_URL` - For caching (optional)

---

## 📁 Project Structure

```
backend/
├── prisma/
│   └── schema.prisma          # Database models
├── src/
│   ├── app.js                 # Main Express server
│   ├── middleware/
│   │   ├── auth.js            # JWT verification & role checks
│   │   ├── errorHandler.js    # Global error handling
│   │   └── rateLimiter.js     # Rate limiting for OTP, login, checkout
│   ├── routes/
│   │   ├── authRoutes.js      # OTP, JWT, login
│   │   ├── vendorRoutes.js    # Vendor profile, products
│   │   ├── orderRoutes.js     # Order creation, status updates, DVC
│   │   ├── productRoutes.js   # Product management
│   │   ├── customerRoutes.js  # Customer search, orders, loyalty
│   │   ├── adminRoutes.js     # Admin dashboard, vendor approval, refunds
│   │   └── webhookRoutes.js   # Paystack webhooks
│   ├── controllers/           # Route handlers for auth and core flows
│   ├── services/              # Auth/business logic services
│   └── utils/
│       ├── jwt.js             # Token generation & verification
│       ├── paystack.js        # Paystack API integration
│       ├── termii.js          # WhatsApp/SMS integration
│       ├── dvc.js             # Delivery verification code utilities
│       ├── location.js        # Geolocation & Haversine formula
│       ├── generators.js      # ID/reference generators
│       ├── geolocation.js     # PostGIS queries
│       └── password.js        # Password hashing
├── package.json
├── .env                       # Environment variables (DON'T COMMIT)
├── .env.example               # Template for .env
└── README.md                  # This file
```

---

## 🔑 Key Features

### 1. Authentication Flow

- **Passwordless OTP**: WhatsApp first (via Termii), SMS fallback
- **JWT Strategy**: 15-min access token + 7-day refresh token
- **Roles**: GUEST → MEMBER (on account creation), VENDOR, ADMIN, SUPER_ADMIN
- **Rate Limiting**: 3 OTP per phone/hour, 5 login failures per IP/15min

### 2. Payment Integration (Paystack)

- **Sub-accounts**: Vendors get individual Paystack sub-accounts for T+1 settlement
- **Split Payment**: Automatic split at checkout
  - Food Cost → Vendor Sub-account
  - Service Fee (₦500) → SabiGet Main Account
- **Refunds**: Reverse-split when customer cancels post-accept or auto-kill triggers

### 3. Order State Machine

```
UNPAID
  ↓ (Webhook confirms payment)
PENDING (10-min auto-kill timer starts)
  ↓ (Vendor accepts or timeout)
ACCEPTED → PREPARING → OUT_FOR_DELIVERY → DELIVERED (DVC entered) → COMPLETED
```

### 4. Delivery Verification (DVC)

- **6-char alphanumeric code** (e.g., "XJ42K9")
- **Verbal handshake**: Rider shows code to customer, enters it in app
- **3-attempt lockout**: After 3 wrong entries, order locked for 15 mins
- **Final proof**: Money unlocked only after DVC entry

### 5. Vendor Meritocracy

- **Rank Score**: Based on
  - Acceptance rate (%)
  - Avg preparation time
  - Cancellation rate
  - DVC success rate
  - Customer retention
- **Admin Flags**:
  - 40+ min preparing: Yellow flag + "Ping Vendor" button
  - 55+ min preparing: Red flag + "Force Refund" button

### 6. Real-time Notifications

- **Socket.io**: Vendor gets instant order alerts + status updates
- **Fallback**: SMS sent if Socket.io silent for 5+ mins on first order
- **Traffic Light UI**: Vendor sees 🟢 online / 🔴 disconnected status

### 7. Loyalty Points

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
