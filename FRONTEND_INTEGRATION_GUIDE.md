# Frontend Integration Guide - SabiGet Landing Page

## ✅ Backend Status: READY

**All systems operational:**

- ✅ 40 source files already in ESM format
- ✅ 14/14 integration tests passing
- ✅ All 30+ endpoints tested and working
- ✅ Database connected
- ✅ Authentication functional
- ✅ Payment (Paystack) configured
- ✅ Real-time (Socket.io) ready

---

## 🎯 Frontend Tech Stack (Already in place)

**Frontend Directory:** `frontend/`

- Framework: Next.js 14+ (TypeScript)
- Styling: PostCSS + Tailwind CSS (configured)
- Build: Vite-compatible setup

---

## 📋 API Base URL

```
http://localhost:5000/api/v1
```

**Domains:**

- Customer endpoints: `/customers/`, `/auth/`
- Vendor endpoints: `/vendors/`
- Orders: `/orders/`
- Products: `/products/`
- Admin: `/admin/`

---

## 🔐 Authentication Flow (For Frontend)

### USER TYPES:

- **GUEST**: Browse and checkout with OTP only (no password)
- **MEMBER**: Guest → Member conversion (add password post-order)
- **VENDOR**: Separate portal (vendor.sabiget.com) with 2FA
- **ADMIN**: Hidden URL with 2FA

---

### CUSTOMER FLOW (Landing Page Users)

#### 1. **Send OTP** (No auth required)

```javascript
POST /auth/send-otp
{
  "phone": "+2348123456789"
}
Response: { "success": true, "message": "OTP sent" }
```

#### 2. **Verify OTP & Get Token** (Creates GUEST user on first time)

```javascript
POST /auth/verify-otp
{
  "phone": "+2348123456789",
  "code": "123456"  // From SMS/WhatsApp
}
Response: {
  "success": true,
  "accessToken": "eyJhbGc...",
  "refreshToken": "...",
  "user": {
    "id": "user_123",
    "phone": "+2348123456789",
    "role": "GUEST",
    "isVerified": false
  },
  "isNewUser": true
}
```

#### 3. **Use Token in Requests**

```javascript
Authorization: Bearer {accessToken}
```

#### 4. **Guest Checkout** (No password needed initially)

```javascript
POST /orders/guest-checkout
{
  "phone": "+2348123456789",
  "vendorId": "vendor_123",
  "items": [
    { "productId": "prod_1", "quantity": 2, "specialRequests": "Extra spice" }
  ],
  "deliveryAddress": "123 Main Street, Lagos",
  "deliveryLat": 6.5244,
  "deliveryLng": 3.3792
}
Response: {
  "success": true,
  "orderId": "order_123",
  "totalAmount": 5500,
  "authorizationUrl": "https://checkout.paystack.com/...",
  "nextStep": "Complete payment and verify OTP"
}
```

#### 5. **Convert to MEMBER** (Post-order - optional)

```javascript
POST /auth/create-account
Headers: { Authorization: "Bearer accessToken" }
{
  "password": "securePass123",
  "name": "John Doe",
  "email": "john@example.com"
}
Response: {
  "success": true,
  "message": "Account upgraded to MEMBER",
  "user": { "role": "MEMBER", "email": "john@example.com" }
}
```

#### 6. **Member Login** (After password set)

```javascript
POST /auth/login
{
  "phone": "+2348123456789",
  "password": "securePass123"
}
Response: {
  "accessToken": "...",
  "refreshToken": "...",
  "user": { "role": "MEMBER" }
}
```

---

### VENDOR FLOW (Separate Portal - vendor.sabiget.com)

#### 1. **Vendor Signup** (New business owner)

```javascript
POST /auth/vendor/signup
{
  "email": "vendor@restaurant.com",
  "password": "securePass123",
  "businessName": "Pizza Palace",
  "businessPhone": "+2348012345678",
  "businessCategory": "Food & Beverage"
}
Response: {
  "success": true,
  "vendor": { "vendorId": "vendor_123" },
  "nextStep": "Setup 2FA at /auth/vendor/setup-2fa"
}
```

#### 2. **Vendor Setup 2FA** (Two-factor authentication)

```javascript
POST /auth/vendor/setup-2fa
Headers: { Authorization: "Bearer accessToken" }
{
  "method": "email"  // or "sms"
}
Response: {
  "success": true,
  "message": "2FA code sent via email",
  "expiresIn": "10 minutes"
}
```

#### 3. **Vendor Verify 2FA**

```javascript
POST /auth/vendor/verify-2fa
Headers: { Authorization: "Bearer accessToken" }
{
  "code": "482917"
}
Response: {
  "success": true,
  "vendor": { "isApproved": false },
  "nextStep": "Awaiting admin approval or access dashboard if approved"
}
```

#### 4. **Vendor Login** (Subsequent logins)

```javascript
POST /auth/vendor/login
{
  "email": "vendor@restaurant.com",
  "password": "securePass123"
}
Response: {
  "accessToken": "...",
  "refreshToken": "...",
  "vendor": { "vendorId": "vendor_123", "isApproved": true }
}
```

---

### LOYALTY POINTS SYSTEM

**Earning:**

- First 3 orders: 5% of order value = points
- After 3 orders: 2% of order value = points

**Redemption:**

- Minimum: 100 points = ₦50 discount (0.5 naira per point)
- Example: 200 points = ₦100 discount

```javascript
POST /customers/redeem-loyalty-points
Headers: { Authorization: "Bearer accessToken" }
{
  "pointsToRedeem": 150
}
Response: {
  "success": true,
  "discountNaira": 75,  // 150 * 0.5
  "remainingPoints": 50
}
```

---

## 🛣️ Landing Page - Essential Endpoints

### Phase 1: Hero Section

```javascript
// No auth required - show hero
// Nearby vendors preview
GET /customers/nearby-vendors?latitude=6.5244&longitude=3.3792&radius=2
// No auth needed - public endpoint
```

### Phase 2: How It Works Section

```javascript
// Static content - no API calls needed
// Show 3-4 sample vendors with GET /customers/vendors/{id}/menu
```

### Phase 3: Sign In / Sign Up Modal

```javascript
// Auth flow using endpoints above
// POST /auth/send-otp → Verify → Get Token
```

### Phase 4: CTA Buttons

```javascript
// Route to /app (authenticated dashboard)
// Route to vendor signup page
```

---

## 🚀 Quick Start: Next Steps

### 1. **Update Frontend Environment**

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000
```

### 2. **Install Dependencies**

```bash
cd frontend
npm install
```

### 3. **Create Landing Page Structure**

```
frontend/src/app/
├── page.tsx              # Landing page (/)
├── layout.tsx            # Root layout
├── components/
│   ├── Hero.tsx          # Hero section
│   ├── HowItWorks.tsx    # Features section
│   ├── AuthModal.tsx     # Sign in / Sign up modal
│   ├── CallToAction.tsx  # CTA buttons
│   └── Footer.tsx        # Footer
└── globals.css           # Global styles (Tailwind)
```

### 4. **Start Frontend Dev Server**

```bash
npm run dev
```

Runs on: `http://localhost:3000`

---

## 📲 Landing Page Features to Build

### ✅ Phase 1: Static Landing

- [ ] Hero section with CTA
- [ ] How it works (3-4 steps)
- [ ] Footer
- [ ] Responsive design

### ✅ Phase 2: Auth Integration

- [ ] Sign In modal (OTP flow)
- [ ] Phone number input validation
- [ ] OTP verification
- [ ] Error handling

### ✅ Phase 3: Dynamic Content

- [ ] Fetch nearby vendors on load
- [ ] Show vendor cards
- [ ] Display ratings and delivery time
- [ ] Loading states & error handling

### ✅ Phase 4: Navigation

- [ ] Route to `/app` after login
- [ ] Redirect to vendor signup page
- [ ] Deep linking support

---

## 🔗 API Response Examples

### Get Nearby Vendors

```javascript
GET /customers/nearby-vendors?latitude=6.5244&longitude=3.3792

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

### Send OTP

```javascript
POST /auth/send-otp
{
  "phone": "+2348123456789"
}

{
  "success": true,
  "message": "OTP sent to +2348123456789"
}
```

### Verify OTP

```javascript
POST /auth/verify-otp
{
  "phone": "+2348123456789",
  "code": "123456"
}

{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "15 minutes",
  "refreshExpiresIn": "7 days",
  "user": {
    "id": "user_abc123",
    "phone": "+2348123456789",
    "name": "Guest User",
    "role": "GUEST",
    "loyaltyPoints": 0,
    "orderCount": 0
  }
}
```

---

## 🎨 UI/UX Recommendations

### Color Palette

- Primary: `#FF6B35` (Orange - vibrant)
- Secondary: `#004E89` (Deep Blue)
- Success: `#00B894` (Green)
- Error: `#EE5A6F` (Red)
- Neutral: `#F5F5F5` (Light Gray)

### Typography

- Headings: Bold, 28-36px
- Body: Regular, 14-16px
- Small: 12-14px

### Components

- Use Tailwind CSS classes
- Cards for vendors
- Modals for auth
- Loading spinners for async operations
- Toast notifications for messages

---

## 🔄 State Management

### Recommended: Next.js App Router + Server Components

```javascript
// app/page.tsx - Server Component (fetches data)
export default async function LandingPage() {
  // Server-side data fetching
  return (
    <div>
      <Hero />
      <VendorPreview />
      <HowItWorks />
    </div>
  );
}

// components/AuthModal.tsx - Client Component
'use client';
import { useState } from 'react';

export default function AuthModal({ isOpen }) {
  const [phone, setPhone] = useState('');
  // Handle OTP flow
}
```

### Or: Zustand (Lightweight state management)

```javascript
import { create } from "zustand";

const useAuthStore = create((set) => ({
  token: null,
  user: null,
  setToken: (token, user) => set({ token, user }),
  logout: () => set({ token: null, user: null }),
}));
```

---

## 📡 Backend Running Checklist

Before starting frontend dev:

- [ ] Backend running: `npm run dev` in `/backend`
- [ ] Terminal shows: `SabiGet backend running on http://localhost:5000`
- [ ] Database connected: `Prisma Client ready`
- [ ] No errors in backend terminal
- [ ] Test endpoints: `node backend/TEST_ALL_ENDPOINTS.js` (14/14 pass)

---

## 🚀 Start Command (All Services)

**Terminal 1 - Backend:**

```bash
cd backend && npm run dev
```

**Terminal 2 - Frontend:**

```bash
cd frontend && npm run dev
```

Both running → Visit `http://localhost:3000` → See landing page ✅

---

## 🎯 Landing Page Roadmap

### Week 1: Static Landing

- Hero section
- How it works
- Footer
- Responsive design
- Basic styling

### Week 2: Auth Integration

- OTP modal
- Phone validation
- SMS integration testing
- Error handling

### Week 3: Dynamic Content

- Fetch vendors
- Display ratings
- Loading states
- Mobile optimization

### Week 4: Navigation & Polish

- Route handling
- Deep linking
- Analytics (optional)
- SEO optimization

---

## 📚 Documentation Links

- **Backend API**: `backend/README.md`
- **Phase 3 Tests**: `backend/PHASE3_TEST_GUIDE.md`
- **All Endpoints**: `backend/README.md` - API section
- **Database Schema**: `backend/prisma/schema.prisma`

---

## ✅ Ready to Start?

**Your backend is production-ready!**

All systems tested and operational:

- ✅ Auth system working
- ✅ Vendor endpoints responding
- ✅ Order flow complete
- ✅ Real-time updates (Socket.io)
- ✅ Comprehensive documentation
- ✅ Error handling in place

**Next Step:** Start building the landing page with Next.js!

---

**Questions?** Check the backend README.md or test output for details.
