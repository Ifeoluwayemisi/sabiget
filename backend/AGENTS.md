# SabiGet Backend — AGENTS.md

## 1. PURPOSE

This file defines backend-specific engineering rules for AI coding agents working inside the `backend/` directory of the SabiGet repository.

The backend is an existing production-oriented Node.js API.

Do NOT treat this directory as a greenfield project.

Before modifying backend code:

1. Inspect the existing implementation.
2. Trace the relevant request/data flow.
3. Check existing services/controllers/routes.
4. Check Prisma models and migrations when database behavior is involved.
5. Check tests.
6. Make the smallest safe change.
7. Verify the change.

The backend is the authoritative source for SabiGet business logic, security, persistence, payment state, order state, and authorization.

---

# 2. BACKEND STACK

The backend currently uses:

- Node.js
- Express.js
- JavaScript
- Prisma ORM
- PostgreSQL
- Redis
- Socket.IO
- JWT
- Paystack
- Termii
- Helmet
- CORS
- Morgan
- Express rate limiting

Do not introduce another backend framework or ORM without explicit approval.

Do not migrate Express to another framework merely for preference.

---

# 3. BACKEND ARCHITECTURE

The backend generally follows this responsibility flow:

```text
HTTP Request
    ↓
Route
    ↓
Middleware
    ↓
Controller
    ↓
Service
    ↓
Prisma / External Service
    ↓
Response
````

Where applicable:

```text
External Webhook
    ↓
Webhook Route
    ↓
Webhook Controller/Handler
    ↓
Business Service
    ↓
Database / Payment State
```

Keep responsibilities separated.

Routes should primarily define endpoints and middleware.

Controllers should handle HTTP concerns.

Services should contain business logic.

Prisma/database access should not be randomly scattered throughout controllers.

---

# 4. CURRENT SERVER

The main backend entry point is:

```text
app.js
```

It currently handles infrastructure such as:

* Express initialization.
* Middleware.
* CORS.
* Helmet.
* Morgan.
* Rate limiting.
* JSON parsing.
* Route registration.
* Socket.IO initialization.
* Health checks.
* Background workers.

Do not move infrastructure into unrelated feature files without a clear reason.

---

# 5. API BASE PATH

The backend API uses:

```text
/api/v1
```

Do not casually change the API version.

Existing routes include:

```text
/auth
/vendors
/products
/orders
/customers
/admin
/webhooks
```

Always inspect the actual route registration before assuming an endpoint exists.

---

# 6. HEALTH CHECK

The backend exposes:

```http
GET /health
```

Health checks should remain lightweight.

Do not make the health endpoint depend on expensive business logic.

If readiness/liveness endpoints are introduced, preserve compatibility with the existing health endpoint unless explicitly instructed otherwise.

---

# 7. ROUTING RULES

Existing route files include:

```text
authRoutes.js
vendorRoutes.js
productRoutes.js
orderRoutes.js
customerRoutes.js
adminRoutes.js
webhookRoutes.js
```

Before creating a new route:

1. Search for an existing endpoint.
2. Determine whether the functionality already exists under another route.
3. Check whether extending an existing endpoint is more appropriate.
4. Check frontend consumers.
5. Check tests.

Do not create duplicate endpoints.

---

# 8. CONTROLLER RULES

Controllers should:

* Parse HTTP input.
* Invoke the appropriate service.
* Return appropriate HTTP status codes.
* Return consistent responses.
* Handle expected request-level errors.

Controllers should NOT contain large blocks of business logic.

Avoid:

```text
Route → massive controller → Prisma → payment API → random logic
```

Prefer:

```text
Route
→ Controller
→ Service
→ Repository/Prisma/external integration
```

If existing code does not perfectly follow this structure, improve it incrementally rather than rewriting the entire backend.

---

# 9. SERVICE LAYER

Business rules belong primarily in services.

Important business domains include:

* Authentication.
* Customers.
* Vendors.
* Products.
* Orders.
* Payments.
* Loyalty.
* Refunds.
* DVC.
* Vendor ranking.
* Location discovery.

Services should be reusable from:

* HTTP controllers.
* Workers.
* Webhooks.
* Realtime handlers.

Do not duplicate business logic between controllers and workers.

---

# 10. DATABASE

The database is PostgreSQL.

Prisma is the ORM.

The Prisma schema is the authoritative database model.

Before modifying database behavior:

1. Inspect `schema.prisma`.
2. Inspect relevant migrations.
3. Search for all consumers of affected models.
4. Check service logic.
5. Check tests.

Never make a schema change without understanding its relationship impact.

---

# 11. PRISMA RULES

Use Prisma consistently with the existing project.

Do not introduce a second ORM.

Avoid unnecessary queries.

Prefer selecting only required fields when performance or security benefits from it.

Be especially careful with:

* Nested writes.
* Transactions.
* Concurrent updates.
* Unique constraints.
* Foreign keys.
* Nullable relationships.
* Cascading behavior.

Do not expose entire Prisma objects directly to clients when they contain internal or sensitive fields.

Map database records to appropriate API responses where necessary.

---

# 12. DATABASE TRANSACTIONS

Use transactions when multiple database operations must succeed or fail together.

Examples include:

* Creating an order and its order items.
* Updating payment/order state together.
* Loyalty balance changes.
* Refund-related state transitions.
* Critical inventory updates.

Avoid transactions around external network calls unless the architecture specifically supports that pattern.

Remember:

Database transactions cannot magically roll back an external Paystack request.

Design external side effects carefully.

---

# 13. ORDER SYSTEM

Orders are one of the most sensitive backend domains.

Known order states include:

```text
UNPAID
PENDING
ACCEPTED
PREPARING
OUT_FOR_DELIVERY
DELIVERED
COMPLETED
CANCELLED_CUSTOMER
REJECTED_VENDOR
AUTO_KILLED
REFUNDED
```

Do not add or rename statuses casually.

Before changing order transitions, inspect:

* `orderService.js`
* `orderController.js`
* `orderRoutes.js`
* Prisma schema
* Payment integration
* Webhooks
* Expiration worker
* Vendor dashboard
* Customer order UI
* Tests

---

# 14. ORDER STATE MACHINE

Treat order states as a state machine.

Do not allow arbitrary transitions.

For every transition ask:

```text
Current state
+
Actor
+
Requested transition
+
Required conditions
=
Allowed or rejected
```

Examples:

Customer should not be able to:

```text
COMPLETED → PREPARING
```

Vendor should not be able to arbitrarily mark:

```text
PENDING → COMPLETED
```

Frontend requests must never bypass backend transition rules.

---

# 15. ORDER CONCURRENCY

Assume simultaneous requests can happen.

Potential race conditions include:

* Vendor accepts while auto-kill runs.
* Customer cancels while vendor accepts.
* Payment webhook arrives while frontend verifies payment.
* Duplicate checkout requests.
* Duplicate webhook events.
* Vendor updates status twice.
* DVC is submitted simultaneously.

Use:

* Database constraints.
* Transactions.
* Idempotency.
* Atomic updates.
* State checks.

Do not rely on JavaScript timing alone.

---

# 16. GUEST CHECKOUT

Guest checkout is a core SabiGet feature.

Do NOT make account registration mandatory before checkout.

The backend must support:

```text
Guest
→ phone verification
→ guest/shadow user
→ order
→ optional member upgrade
```

Do not break guest checkout while improving member authentication.

---

# 17. CUSTOMER AUTHENTICATION

Customer authentication includes:

* Guest authentication.
* OTP verification.
* Member login.
* Guest-to-member conversion.
* JWT access tokens.
* Refresh tokens.

Relevant files may include:

```text
authController.js
memberAuthController.js
authService.js
memberAuthService.js
auth.js
```

Always inspect actual current files before assuming exact responsibilities.

---

# 18. VENDOR AUTHENTICATION

Vendor authentication is separate from customer authentication.

It may include:

* Vendor signup.
* Vendor login.
* Vendor role enforcement.
* Vendor 2FA.
* Vendor session handling.

Do not accidentally expose customer authentication endpoints as vendor authentication mechanisms.

Vendor authorization must be enforced server-side.

---

# 19. RBAC

Known roles include:

```text
GUEST
MEMBER
VENDOR
ADMIN
```

Role checks must happen on the backend.

Never trust a role supplied by the client.

Never allow:

```text
req.body.role
```

to determine authorization.

The authenticated identity must come from trusted server-side token/session validation.

---

# 20. JWT

JWT implementation must preserve:

* Secret security.
* Expiration.
* Issuer/audience behavior if already configured.
* Refresh token flow.
* Role information where appropriate.
* User identity.

Never hardcode JWT secrets.

Never log JWT secrets.

Never expose refresh tokens through API responses unnecessarily.

Before modifying token behavior, inspect all frontend consumers.

---

# 21. REFRESH TOKENS

Refresh tokens are security-sensitive.

If refresh tokens are persisted in PostgreSQL:

* Preserve revocation behavior.
* Preserve expiration.
* Preserve token rotation behavior if implemented.
* Do not return raw database records to clients.

Do not silently remove refresh token persistence.

---

# 22. OTP / TERMII

Termii is the current OTP provider.

OTP logic should be:

* Time-limited.
* Rate-limited.
* Single-use where appropriate.
* Protected against brute force.
* Safe to retry.
* Never logged in production.

Do not return OTP codes in production API responses.

Development fallback behavior must remain explicitly distinguishable from production behavior.

---

# 23. PASSWORDS

Passwords must never be stored in plaintext.

Do not log passwords.

Do not return password hashes.

Use the existing password hashing mechanism unless there is a justified security migration.

---

# 24. PAYMENT ARCHITECTURE

Paystack is the current payment provider.

Payment logic must remain backend-controlled.

Backend responsibilities include:

* Payment initialization.
* Payment reference generation.
* Amount validation.
* Payment verification.
* Webhook processing.
* Idempotency.
* Refunds.
* Payment status persistence.

The frontend must NOT determine payment success.

---

# 25. PAYMENT AMOUNTS

Never trust client-supplied totals.

The backend should calculate/validate the authoritative order amount using:

* Product data.
* Product prices.
* Quantities.
* Applicable service fees.
* Other legitimate charges.

The client may send cart information.

The backend must determine the actual payable amount.

---

# 26. PAYSTACK WEBHOOKS

Webhook processing must be idempotent.

Assume Paystack may:

* Retry events.
* Send duplicate events.
* Send events after frontend navigation.
* Deliver events in unexpected timing.

Webhook handlers should:

1. Validate the request.
2. Identify the event.
3. Check idempotency/logging.
4. Update appropriate state.
5. Avoid duplicate side effects.
6. Return appropriate responses.

Do not rely exclusively on the browser to confirm payments.

---

# 27. REFUNDS

Refunds are financially sensitive.

Before modifying refund logic, inspect:

* Order state.
* Payment state.
* Paystack integration.
* Refund records.
* Webhooks.
* Admin override logic.
* Auto-kill behavior.

Never trigger duplicate refunds.

Refund operations must be idempotent wherever possible.

---

# 28. AUTOMATIC ORDER EXPIRATION

The backend contains a background worker that checks expired pending orders.

It currently runs approximately every minute.

The worker should:

* Find eligible expired orders.
* Safely transition them.
* Trigger required refund behavior.
* Avoid duplicate processing.
* Log meaningful results.

The worker must remain backend-authoritative.

Do not move expiration logic to frontend timers.

---

# 29. DELIVERY VERIFICATION CODE

DVC validation belongs entirely to the backend.

Known configuration includes:

```env
DVC_LENGTH=6
DVC_LOCKOUT_MINUTES=15
DVC_MAX_ATTEMPTS=3
```

However, always read current configuration before assuming values.

The backend must enforce:

* Code format.
* Attempt limits.
* Lockout.
* Correct order ownership/context.
* Valid order state.
* Successful verification.
* Delivery timestamp/state transition.

Do not trust a frontend claim that the DVC is valid.

---

# 30. LOYALTY

Current business rule:

```text
100 points = ₦50
```

Current earning configuration includes:

```env
LOYALTY_POINTS_FIRST_3_ORDERS_RATE=0.05
LOYALTY_POINTS_DEFAULT_RATE=0.02
```

Always inspect current configuration.

Loyalty calculations belong to the backend.

Do not allow clients to submit:

```text
pointsToAdd
pointsBalance
pointsEarned
```

as authoritative values.

---

# 31. VENDOR DISCOVERY

Vendor discovery uses customer location.

The backend is responsible for authoritative:

* Coordinates.
* Distance.
* Service radius.
* Vendor availability.
* Eligibility.

Use the existing location utility/service rather than creating duplicate distance logic.

If Haversine/PostGIS logic already exists, reuse it.

Do not create multiple competing implementations of vendor distance calculations.

---

# 32. VENDOR AVAILABILITY

Vendor availability should reflect backend state.

Potential states may include:

* Active.
* Offline.
* Unavailable.
* Unverified.
* Suspended.

Inspect the existing schema and service logic before introducing additional states.

Do not allow frontend-only availability.

---

# 33. VENDOR MANAGEMENT

Vendor functionality includes:

* Onboarding.
* Verification.
* Profile.
* Location.
* Service radius.
* Products.
* Menu.
* Inventory.
* Order acceptance.
* Preparation.
* Delivery status.

Vendor-specific operations must verify that the authenticated vendor owns or has permission over the affected resource.

Do not trust:

```text
vendorId
```

from the request body when identity can be derived from the authenticated session.

---

# 34. PRODUCT MANAGEMENT

Products belong to vendors.

Backend must enforce ownership.

Validate:

* Product existence.
* Vendor ownership.
* Price.
* Availability.
* Stock.
* Quantity.
* Category relationship.

Never allow a vendor to modify another vendor's product.

---

# 35. INVENTORY

Inventory changes should be concurrency-safe where inventory is financially/business critical.

Consider race conditions such as:

```text
Customer A buys final item
Customer B buys final item
```

Do not rely only on:

```text
if (stock > 0)
```

followed by a separate update if the operation needs atomicity.

Use appropriate database mechanisms.

---

# 36. ADMIN

Admin functionality is privileged.

Admin endpoints may include:

* Dashboard metrics.
* Vendor verification.
* Vendor management.
* Order monitoring.
* Refund/emergency actions.
* Audit operations.

Every admin endpoint must enforce admin authorization server-side.

Do not expose admin data through customer/vendor endpoints.

---

# 37. AUDITING

Sensitive administrative and financial actions should be auditable where the existing system supports it.

Examples:

* Vendor verification.
* Manual refund.
* Vendor suspension.
* Sensitive order overrides.

Preserve existing `AuditLog` behavior.

Do not remove audit logging to simplify code.

---

# 38. SOCKET.IO

Socket.IO is initialized in the backend.

Known room patterns include:

```text
vendor:{vendorId}
customer:{userId}
```

Known events may include:

```text
vendor:join
customer:join
order:accept
order:statusUpdate
order:dvcEntered
order:statusUpdated
connection:success
```

These names are part of the application contract.

Search the repository before changing them.

---

# 39. SOCKET.IO AUTHORIZATION

Do not allow arbitrary users to join privileged rooms.

Validate the identity behind room membership.

For example:

A vendor should only join their own vendor room.

A customer should only join rooms associated with their own orders/account.

Do not rely solely on client-supplied IDs.

---

# 40. SOCKET.IO VS REST

REST/API remains authoritative.

Socket.IO should communicate realtime events.

Example:

```text
Vendor accepts order
        ↓
REST request
        ↓
Backend validates transition
        ↓
Database updated
        ↓
Socket.IO event emitted
```

Do not make a socket event itself the authoritative order mutation unless the existing architecture explicitly requires it.

---

# 41. RATE LIMITING

Existing rate limiting includes general API and OTP-specific controls.

Do not remove rate limiting from sensitive endpoints.

Pay special attention to:

* OTP sending.
* OTP verification.
* Login.
* Refresh.
* Password-related operations.
* Payment-related operations.

Avoid rate limits that accidentally make legitimate workflows unusable.

---

# 42. SECURITY MIDDLEWARE

Existing middleware includes:

* Helmet.
* CORS.
* Morgan.
* Rate limiting.
* JWT authentication.
* Error handling.
* Not-found handling.

Do not disable security middleware to "make development easier" without understanding the consequences.

Development exceptions must be explicit and environment-specific.

---

# 43. CORS

CORS should be configured using trusted frontend origins.

Do not use unrestricted:

```text
*
```

for authenticated production APIs unless there is a deliberate reason and no credential/security conflict.

Check current environment configuration before modifying CORS.

---

# 44. ERROR HANDLING

Use the existing centralized error handling architecture.

Do not create dozens of inconsistent response formats.

Errors should provide clients enough information to react correctly without exposing:

* Stack traces.
* Database credentials.
* SQL details.
* Secrets.
* Internal infrastructure details.

Unexpected errors should be logged appropriately.

---

# 45. HTTP STATUS CODES

Use semantically appropriate status codes.

Examples:

```text
200 — successful retrieval/update
201 — resource created
204 — successful operation without response body
400 — invalid request
401 — unauthenticated
403 — authenticated but forbidden
404 — resource not found
409 — conflict
422 — validation/business-rule failure where appropriate
429 — rate limited
500 — unexpected server error
```

Follow existing project conventions if already established.

Do not change status codes casually because frontend consumers may depend on them.

---

# 46. API RESPONSE CONSISTENCY

Before introducing a new response structure, inspect existing conventions.

Avoid arbitrary mixtures such as:

```json
{"data": ...}
```

and:

```json
{"result": ...}
```

and:

```json
{"success": true, "payload": ...}
```

without reason.

Preserve existing API contracts.

---

# 47. INPUT VALIDATION

Validate all externally supplied input.

Never assume frontend validation is sufficient.

Validate:

* Request body.
* Query parameters.
* Route parameters.
* Headers where relevant.
* Webhook payloads.
* External API responses.

Reject malformed input early.

---

# 48. EXTERNAL API FAILURES

Paystack and Termii can fail.

Handle:

* Timeout.
* Network errors.
* Invalid responses.
* Rate limits.
* Provider outages.

Do not expose raw provider errors to users.

Normalize external failures into safe application errors.

---

# 49. DATABASE CONNECTIONS

Do not repeatedly create database clients per request.

Use the project's existing Prisma client architecture.

Inspect how Prisma is currently instantiated before adding another client.

Ensure graceful shutdown behavior where applicable.

---

# 50. REDIS CONNECTIONS

Use the existing Redis architecture.

Do not create new Redis clients unnecessarily.

Handle Redis unavailable scenarios according to the feature's criticality.

If Redis is optional for a feature, do not make the entire API fail simply because Redis is temporarily unavailable unless that behavior is intentional.

---

# 51. ENVIRONMENT CONFIGURATION

Environment variables must be validated.

Important categories include:

```text
DATABASE_URL
JWT_SECRET
PAYSTACK credentials
TERMII credentials
REDIS_URL
FRONTEND_URL
DVC configuration
LOYALTY configuration
```

Never assume an environment variable exists.

Fail clearly for required production configuration.

Avoid crashing development unnecessarily for optional services.

---

# 52. LOGGING

Use the existing logging approach.

Do not log:

* Passwords.
* OTPs.
* JWTs.
* Payment secrets.
* Authorization headers.
* Database credentials.

Useful logs should identify:

* Request context.
* Resource IDs where safe.
* Operation.
* Failure reason.
* Error class.

---

# 53. TESTING

Backend tests currently cover areas such as:

* Authentication.
* Customer endpoints.
* Vendor/admin endpoints.
* Orders.
* Products.
* Webhooks.

Run relevant tests after changes.

For example:

```powershell
cd backend
npm test
```

Never claim success without running the test command.

---

# 54. TEST DATABASE SAFETY

Tests must not accidentally destroy development or production databases.

Inspect:

* Test environment.
* Prisma configuration.
* Database URL.
* Setup/teardown logic.

Never point automated tests at production.

---

# 55. TESTING PAYMENT FLOWS

Do not use real production payment credentials for automated tests.

Prefer:

* Mocked Paystack responses.
* Test credentials.
* Controlled fixtures.
* Webhook fixtures.

Payment tests should cover:

* Successful initialization.
* Failed initialization.
* Duplicate references.
* Successful payment.
* Failed payment.
* Duplicate webhook.
* Refund.
* Duplicate refund attempt.

---

# 56. TESTING ORDER RACES

Where practical, test race-sensitive behavior.

Examples:

* Auto-kill vs vendor acceptance.
* Customer cancellation vs vendor acceptance.
* Duplicate checkout.
* Duplicate webhook.
* Repeated DVC attempt.
* Concurrent inventory changes.

---

# 57. TESTING AUTHORIZATION

Test that:

* Customer cannot access vendor resources.
* Vendor cannot access another vendor's resources.
* Vendor cannot access admin endpoints.
* Customer cannot access admin endpoints.
* Guest cannot access protected member operations.
* Unauthenticated users receive appropriate responses.

---

# 58. MANUAL TESTING

Use:

```text
TESTING_GUIDE.md
```

for end-to-end workflows.

When implementing frontend/backend integration, verify both sides together.

Do not assume a passing backend test means the frontend flow works.

---

# 59. BACKGROUND WORKERS

Background workers must:

* Avoid duplicate processing.
* Handle exceptions without crashing the server.
* Log meaningful failures.
* Respect database state.
* Be safe during server restarts.

Do not allow one failed worker execution to terminate the backend process.

---

# 60. WEBHOOK PROCESSING

Webhook handlers should be resilient.

Never perform expensive synchronous operations unnecessarily.

Persist enough information to support:

* Idempotency.
* Debugging.
* Auditability.

Existing webhook logging must be preserved.

---

# 61. API IDEMPOTENCY

Idempotency is particularly important for:

* Checkout.
* Payment initialization.
* Payment webhooks.
* Refunds.
* Order transitions.

If the repository already uses idempotency references, reuse the existing mechanism.

Do not introduce multiple incompatible idempotency systems.

---

# 62. DATA OWNERSHIP

Every resource operation must verify ownership or authorization.

Examples:

```text
Customer → their own orders
Vendor → their own products
Vendor → their own orders
Admin → privileged resources
```

Never rely on IDs alone.

---

# 63. SECURITY BOUNDARY

The backend is the security boundary.

The following are NEVER trusted simply because they came from the frontend:

```text
role
userId
vendorId
price
total
paymentStatus
loyaltyBalance
dvcVerified
refundApproved
orderStatus
```

Derive or verify these values server-side.

---

# 64. MIGRATIONS

When changing `schema.prisma`:

* Generate an appropriate migration.
* Inspect the generated migration.
* Ensure it does not unexpectedly drop data.
* Update dependent code.
* Update tests.
* Verify Prisma client generation.

Never use destructive resets on a real database.

---

# 65. DEPENDENCIES

Before installing a backend dependency:

1. Search `package.json`.
2. Check whether the functionality already exists.
3. Determine whether the dependency is maintained.
4. Consider security implications.
5. Consider production bundle/runtime impact.

Do not install duplicate packages.

---

# 66. CODE STYLE

Follow the existing backend code style.

Do not perform large formatting changes unrelated to the task.

Avoid mixing architectural styles unnecessarily.

Consistency is more valuable than personal preference.

---

# 67. FILE CREATION

Before creating a file:

* Search for an existing equivalent.
* Check existing naming conventions.
* Check imports.
* Determine whether the new file genuinely improves separation.

Do not create:

```text
orderService2.js
authServiceNew.js
vendorServiceFinal.js
```

to avoid understanding existing code.

---

# 68. REFACTORING

Refactor only when there is a concrete benefit.

Good reasons:

* Removing duplicated business logic.
* Fixing a clear architectural boundary.
* Improving testability.
* Fixing security problems.
* Reducing severe complexity.

Bad reasons:

* Personal naming preference.
* Making the code "look cleaner."
* Replacing an existing pattern with a fashionable one.

---

# 69. PRODUCTION READINESS

Before declaring a backend feature production-ready, verify:

* Authentication.
* Authorization.
* Validation.
* Database behavior.
* Error handling.
* Logging.
* Rate limiting.
* External API failures.
* Idempotency.
* Concurrency.
* Tests.
* Environment configuration.

---

# 70. BACKEND TASK WORKFLOW

For every backend task:

### Phase 1 — Investigate

Inspect:

* Route.
* Controller.
* Service.
* Prisma model.
* External integration.
* Tests.

### Phase 2 — Plan

Identify:

* Exact bug/feature.
* Files affected.
* Business rules.
* Security implications.
* Tests required.

### Phase 3 — Implement

Make the smallest safe change.

### Phase 4 — Test

Run targeted tests.

### Phase 5 — Regression Test

Run broader tests when shared code was changed.

### Phase 6 — Review

Inspect the diff.

### Phase 7 — Report

State:

* Changes.
* Tests.
* Results.
* Limitations.
* Next recommended step.

---

# 71. SESSION CONTINUATION

When continuing from a previous OpenCode session:

DO NOT assume previous work was completed.

First inspect:

```powershell
git status
git diff
```

Then inspect relevant files.

Verify actual implementation.

Continue from repository state.

---

# 72. STOP CONDITIONS

Ask for clarification before proceeding when:

* A database migration could destroy data.
* Payment architecture must change.
* Authentication architecture must change.
* A core order state must be renamed.
* A business rule is ambiguous.
* Existing behavior conflicts with explicit requirements.
* Production secrets are required.
* A major architectural rewrite appears necessary.

---

# 73. FINAL BACKEND PRINCIPLE

The SabiGet backend is the authoritative engine of the marketplace.

Protect:

```text
AUTHENTICATION
AUTHORIZATION
PAYMENTS
ORDERS
LOYALTY
DVC
DATABASE INTEGRITY
VENDOR OWNERSHIP
AUDITABILITY
```

Above all:

```text
INSPECT FIRST.
TRACE THE FLOW.
REUSE EXISTING LOGIC.
CHANGE THE SMALLEST SURFACE.
TEST IT.
VERIFY IT.
```

Do not optimize for writing more code.

Optimize for making the existing SabiGet system more reliable.
