# SabiGet Manual Testing Guide

This guide is designed for manual end-to-end validation of the marketplace flow before continuing with additional features.

The goal is to validate the real product flow with real API requests and UI interaction, not only unit tests.

---

## 1. Prerequisites

Before testing, make sure the project is installed and running:

- Node.js installed
- PostgreSQL available for the backend Prisma setup
- Environment variables configured for both backend and frontend
- Dependencies installed at the repo root and inside frontend/backend

From the repo root:

```bash
npm install
```

Start both apps:

```bash
npm run dev
```

Expected:

- Backend runs on http://localhost:5000
- Frontend runs on http://localhost:3000

---

## 2. Core Manual Test Checklist

### A. Landing page and auth flow

1. Open http://localhost:3000
2. Confirm the landing page loads correctly
3. Click Sign In
4. Test Guest OTP flow
5. Test Member login flow
6. Test Vendor login flow

#### Guest OTP test

Request body example:

```json
{
  "phone": "+2348123456789"
}
```

Endpoint:

```http
POST /api/v1/auth/send-otp
```

Expected:

- OTP sent successfully
- user can proceed to OTP verification

OTP verification request:

```json
{
  "phone": "+2348123456789",
  "code": "482917"
}
```

Endpoint:

```http
POST /api/v1/auth/verify-otp
```

Expected:

- JWT tokens returned
- user is authenticated in the app

#### Member login example

```json
{
  "phone": "+2348123456789",
  "password": "TestPass123"
}
```

Endpoint:

```http
POST /api/v1/auth/login
```

Expected:

- Login success
- accessToken saved in localStorage

#### Vendor login example

```json
{
  "email": "vendor@sabiget.com",
  "password": "TestPass123"
}
```

Endpoint:

```http
POST /api/v1/auth/vendor/login
```

Expected:

- Vendor login success
- user is redirected or can access vendor dashboard

---

### B. Nearby vendors and menu flow

1. Open the home page while signed in
2. Confirm nearby vendors load
3. Click a vendor card
4. Confirm menu modal opens
5. Add items to cart
6. Fill delivery address
7. Confirm guest checkout or member checkout works

#### Guest checkout example

```json
{
  "phone": "+2348123456789",
  "vendorId": "vendor_123",
  "deliveryAddress": "12 Lekki Phase 1, Lagos",
  "deliveryLat": 6.6018,
  "deliveryLng": 3.3515,
  "items": [
    {
      "productId": "prod_123",
      "quantity": 2,
      "specialRequests": "No onions"
    }
  ]
}
```

Endpoint:

```http
POST /api/v1/orders/guest-checkout
```

Expected:

- order created
- authorizationUrl returned by Paystack
- latest order ID stored locally

#### Member checkout example

```http
POST /api/v1/orders
Authorization: Bearer <accessToken>
```

Request body:

```json
{
  "vendorId": "vendor_123",
  "deliveryAddress": "12 Lekki Phase 1, Lagos",
  "deliveryLat": 6.6018,
  "deliveryLng": 3.3515,
  "items": [
    {
      "productId": "prod_123",
      "quantity": 1,
      "specialRequests": "Extra sauce"
    }
  ]
}
```

Expected:

- response includes orderId
- authorizationUrl returned
- redirect to paystack payment flow

---

### C. Order status and lifecycle flow

Once an order is created, test the lifecycle.

#### Get order details

```http
GET /api/v1/orders/:orderId
Authorization: Bearer <accessToken>
```

Expected:

- order details returned
- status shown (UNPAID, PENDING, ACCEPTED, etc.)

#### Vendor accepts order

```http
POST /api/v1/orders/:orderId/accept
Authorization: Bearer <vendorAccessToken>
```

Expected:

- returns success
- status becomes ACCEPTED

#### Vendor marks out for delivery

```http
POST /api/v1/orders/:orderId/out-for-delivery
Authorization: Bearer <vendorAccessToken>
```

Expected:

- status becomes OUT_FOR_DELIVERY

#### Vendor verifies DVC code

```http
POST /api/v1/orders/:orderId/verify-dvc
Authorization: Bearer <vendorAccessToken>
```

Request body:

```json
{
  "dvcCode": "AB12CD"
}
```

Expected:

- status becomes DELIVERED

#### Vendor completes order

```http
POST /api/v1/orders/:orderId/complete
Authorization: Bearer <vendorAccessToken>
```

Expected:

- status becomes COMPLETED

---

### D. Customer order history test

1. Sign in as a customer
2. Open http://localhost:3000/orders
3. Confirm your orders are visible
4. Confirm each order shows status and total amount
5. Confirm the page handles empty states correctly

---

### E. Vendor dashboard test

1. Sign in as vendor
2. Open http://localhost:3000/vendor-dashboard
3. Confirm dashboard loads stats
4. Confirm recent orders appear
5. Accept an order from the dashboard
6. Move order through statuses from the dashboard
7. Confirm revenue summary updates

---

### F. Cancellations and refund flow

#### Customer cancel before vendor accepts

```http
POST /api/v1/orders/:orderId/cancel
Authorization: Bearer <accessToken>
```

Request body:

```json
{
  "reason": "Changed my mind"
}
```

Expected:

- order status set to CANCELLED_CUSTOMER
- refund initiated

#### Vendor reject order

```http
POST /api/v1/orders/:orderId/reject
Authorization: Bearer <vendorAccessToken>
```

Request body:

```json
{
  "reason": "Out of stock"
}
```

Expected:

- order rejected
- refund initiated

---

## 3. What to verify manually in the UI

- login modal works correctly for each role
- menu opens and shows products
- cart quantity updates correctly
- checkout succeeds with guest or member flow
- order tracking card shows correct status
- customer order history reflects real backend data
- vendor dashboard reflects recent orders and stats
- status transitions happen without page refresh where expected

---

## 4. Pass/Fail criteria

Mark each test as PASS or FAIL based on these conditions:

- correct HTTP status code
- correct response body or error message
- correct app behavior in browser
- data updated in the UI after action
- no console errors or broken flow

---

## 5. Recommended testing order

1. Auth flows
2. Vendor and product data
3. Checkout flow
4. Order status lifecycle
5. Customer order history
6. Vendor dashboard
7. Cancel/reject/refund path
8. Final regression pass

This is the safest way to validate the app before adding more features.

---

## 6. Notes for this project

This approach is good because it validates the real integration between:

- frontend UI
- backend routes
- Prisma database
- Paystack payment flow
- order lifecycle state transitions

It reduces the risk of shipping features that appear correct in the browser but fail in the actual app flow.
