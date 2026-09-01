# SabiGet Frontend — AGENTS.md

## 1. PURPOSE

This file defines frontend-specific engineering rules for AI coding agents working inside the `frontend/` directory of the SabiGet repository.

SabiGet is an existing production-oriented marketplace application.

The frontend is NOT a greenfield application.

Before modifying frontend code:

1. Inspect the existing implementation.
2. Trace the relevant user flow.
3. Inspect the backend API contract.
4. Inspect existing frontend API calls and types.
5. Reuse existing components and utilities.
6. Make the smallest safe change.
7. Test the affected flow.
8. Verify the result in the browser where applicable.

Do not rewrite working UI merely because a different implementation style is preferred.

---

# 2. FRONTEND STACK

The frontend currently uses:

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Framer Motion
- Lucide Icons
- Socket.IO Client
- PWA capabilities

Do not introduce another frontend framework.

Do not migrate Next.js, React, or the styling system without explicit approval.

---

# 3. FRONTEND ARCHITECTURE

The frontend should follow a feature-oriented architecture where practical.

The conceptual structure is:

```text
Page
  ↓
Feature / UI Component
  ↓
Hook / State
  ↓
API Client
  ↓
Backend API
````

For realtime features:

```text
Page
  ↓
Feature Component
  ↓
Socket.IO Client
  ↓
Backend Socket.IO Server
```

Keep responsibilities separated.

Pages should compose application features.

Components should handle presentation and local interaction.

Hooks should encapsulate reusable stateful behavior.

API utilities should handle communication with the backend.

Do not put large amounts of API, authentication, payment, and business logic directly inside JSX components.

---

# 4. CURRENT APPLICATION STRUCTURE

The frontend currently contains major application areas such as:

```text
/
 /orders
 /vendor-dashboard
```

The landing experience includes:

* Hero.
* Nearby vendor discovery.
* Vendor cards.
* Vendor menus.
* Cart.
* Checkout.
* Authentication.
* Footer.

Existing important components include:

```text
HomePage.tsx
AuthModal.tsx
MenuModal.tsx
OrderStatusCard.tsx
VendorDashboardPage.tsx
CustomerOrdersPage.tsx
```

Always inspect the current repository before assuming exact locations.

---

# 5. NEXT.JS APP ROUTER

Use the existing Next.js routing architecture.

Before creating a route:

1. Check whether the route already exists.
2. Inspect its current implementation.
3. Check whether the feature belongs in an existing route.
4. Check backend/API dependencies.
5. Check whether the route requires authentication.

Do not create duplicate pages for the same user journey.

---

# 6. SERVER VS CLIENT COMPONENTS

Next.js Server Components are preferred by default where appropriate.

Use:

```text
"use client"
```

only when the component genuinely requires browser/client capabilities such as:

* React state.
* Event handlers.
* Browser APIs.
* `localStorage`.
* Geolocation.
* Socket.IO.
* Interactive animations.
* Client-side authentication state.

Do not turn the entire application into Client Components unnecessarily.

---

# 7. BROWSER APIs

Browser-only APIs include:

```text
localStorage
sessionStorage
navigator.geolocation
window
document
WebSocket
```

Do not access them during server rendering.

Guard browser-specific logic appropriately.

Avoid hydration mismatches.

---

# 8. AUTHENTICATION ARCHITECTURE

SabiGet supports:

```text
GUEST
MEMBER
VENDOR
ADMIN
```

Customer authentication includes:

* Guest OTP.
* Member login.
* Guest-to-member conversion.
* JWT access tokens.
* Refresh tokens.

Vendor authentication is separate and includes:

* Vendor login.
* Vendor signup.
* Vendor-specific authorization.
* Vendor 2FA where implemented.

Do not merge customer and vendor authentication casually.

---

# 9. AUTHENTICATION UI

The existing authentication UI includes:

```text
AuthModal.tsx
```

It supports:

* Guest.
* Member.
* Vendor.

Do not create a second authentication modal unless there is a clear architectural reason.

Extend the existing authentication flow when appropriate.

---

# 10. AUTH TOKENS

The frontend currently uses browser storage for authentication/session information.

Before changing token storage:

1. Inspect how the backend issues tokens.
2. Inspect refresh token behavior.
3. Search every frontend token consumer.
4. Understand current logout behavior.
5. Consider XSS/security implications.

Do not casually migrate authentication storage.

Do not expose tokens in:

* URLs.
* Query strings.
* Logs.
* Error messages.
* Analytics events.

---

# 11. AUTHORIZATION

Frontend authorization is for UX.

It is NOT the security boundary.

Examples:

```text
Customer UI
Vendor dashboard
Admin dashboard
```

may hide or show controls based on authentication state.

However, backend authorization remains authoritative.

Never assume that hiding a button protects an endpoint.

---

# 12. API INTEGRATION

The frontend communicates with the Express backend.

The API base is conceptually:

```text
/api/v1
```

Development commonly uses:

```text
http://localhost:5000/api/v1
```

The exact configured environment variable must be inspected before changing API behavior.

Use environment configuration instead of hardcoding production URLs.

---

# 13. BROWSER API URL VS DOCKER SERVICE URL

Important:

The browser cannot normally resolve:

```text
http://backend:5000
```

That hostname is intended for Docker's internal network.

Browser requests should use a browser-reachable URL such as:

```text
http://localhost:5000
```

in local development or the appropriate public API URL in production.

Do not accidentally expose Docker-internal hostnames to browser-side code.

---

# 14. API CLIENT

Do not scatter raw `fetch()` calls throughout dozens of components if an existing API abstraction exists.

Before creating API utilities:

1. Search the repository.
2. Find existing API helpers.
3. Reuse them.
4. Extend them where appropriate.

A consistent API layer should eventually handle:

* Base URL.
* Headers.
* Authentication.
* JSON parsing.
* Error normalization.
* Refresh behavior.
* Request cancellation where useful.

Do not create multiple competing API clients.

---

# 15. API CONTRACT

The backend is authoritative.

Before consuming an endpoint, inspect:

* Route.
* Controller.
* Service.
* Response shape.
* Error responses.
* Authentication requirements.
* `FRONTEND_INTEGRATION_GUIDE.md`.

Do not invent response fields.

Do not assume an endpoint exists because a UI needs it.

If frontend requirements conflict with the backend implementation, identify the mismatch before changing either side.

---

# 16. TYPESCRIPT

Use TypeScript properly.

Avoid:

```ts
any
```

unless there is a genuinely justified boundary.

Prefer:

```ts
type
interface
unknown
generics
discriminated unions
```

for appropriate cases.

API responses should have typed representations.

Do not blindly cast:

```ts
response as SomeType
```

without validating the actual response shape.

---

# 17. API RESPONSE TYPES

Keep API response types consistent with the backend.

Important domains include:

```text
User
Vendor
Product
Menu
Cart
Order
OrderItem
Payment
Loyalty
Auth
```

Do not duplicate the same type definitions across multiple files.

Create shared frontend types where appropriate.

---

# 18. BUSINESS LOGIC

The frontend should not become the authoritative business logic layer.

Never trust client-side calculations for:

* Payment totals.
* Order totals.
* Loyalty balances.
* Refund amounts.
* Vendor permissions.
* Order status.
* DVC verification.
* Payment success.

Frontend calculations are for presentation and UX.

The backend determines the authoritative values.

---

# 19. GUEST CHECKOUT

Guest checkout is a core SabiGet feature.

The frontend must preserve:

```text
Browse
→ Select vendor
→ Select products
→ Cart
→ Checkout
→ Phone/OTP
→ Payment
→ Order tracking
```

Do not introduce mandatory account creation before checkout.

Avoid unnecessary authentication friction.

---

# 20. SHADOW ACCOUNT

Guest checkout may result in a shadow/guest customer account.

The frontend should not expose internal account mechanics unnecessarily.

The user experience should remain:

```text
Guest
→ Verify phone
→ Order
→ Optionally upgrade account
```

Do not force a password before completing the initial order unless the backend contract explicitly requires it.

---

# 21. CART

Cart behavior must remain predictable.

Cart state should include appropriate information such as:

* Vendor.
* Product.
* Quantity.
* Price snapshot/display.
* Special request where supported.

The frontend should prevent obviously invalid actions, but the backend remains authoritative.

---

# 22. SINGLE-VENDOR CART RULE

Because SabiGet is a multi-vendor marketplace, inspect the current business rule before implementing cross-vendor cart behavior.

If the current architecture assumes one vendor per order:

```text
Cart
→ One Vendor
→ One Order
```

preserve that behavior.

Do not silently create multi-vendor orders.

---

# 23. PRODUCT PRICES

Never treat frontend product prices as authoritative for payment.

The frontend may display:

```text
product.price
```

and calculate an estimated cart total.

But checkout must send enough information for the backend to reconstruct and validate the order.

Do not send a client-controlled:

```text
total
```

and assume the backend should trust it.

---

# 24. CHECKOUT

The checkout experience should be optimized for low friction.

Avoid unnecessary fields.

Guest checkout should remain simple.

Before modifying checkout, inspect:

* Cart state.
* Order API.
* Payment initialization.
* Paystack response.
* Redirect behavior.
* Order ID persistence.
* Error states.

---

# 25. PAYSTACK

Paystack payment operations are backend-authoritative.

The frontend should:

1. Submit checkout data.
2. Receive payment initialization response.
3. Redirect/open the authorized Paystack payment flow.
4. Return to the application.
5. Retrieve order/payment state from the backend.
6. Display the authoritative status.

Do not mark an order as paid simply because the user returned from a payment page.

---

# 26. PAYMENT UX

Payment UI should handle:

* Initialization failure.
* User cancellation.
* Redirect return.
* Delayed payment confirmation.
* Payment failure.
* Successful payment.
* Unknown/pending state.

Do not display:

```text
Payment successful
```

until the backend confirms the authoritative payment/order state.

---

# 27. ORDER TRACKING

The current order tracking component is:

```text
OrderStatusCard.tsx
```

The current implementation primarily uses polling.

Socket.IO client integration is incomplete.

Do not remove working polling until realtime behavior has been implemented and verified.

A safe migration path is:

```text
REST initial fetch
+
Socket.IO realtime updates
+
REST fallback/polling where appropriate
```

---

# 28. ORDER STATUS UI

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

Always inspect the backend for the current authoritative state list.

Frontend UI must gracefully handle unknown future statuses.

Do not crash if the backend introduces a new status.

---

# 29. ORDER STATE TRANSITIONS

The frontend should only present actions that make sense for the current state.

Examples:

```text
PENDING
→ Vendor may accept/reject
```

```text
OUT_FOR_DELIVERY
→ DVC verification may become available
```

```text
COMPLETED
→ No active delivery action
```

But the frontend must NEVER be responsible for enforcing the actual transition.

The backend decides whether the transition is legal.

---

# 30. CUSTOMER ORDER HISTORY

The customer orders page should:

* Fetch authenticated orders.
* Display useful summary information.
* Handle loading.
* Handle empty state.
* Handle errors.
* Allow navigation to relevant order details where supported.

Do not expose sensitive internal information.

---

# 31. VENDOR DASHBOARD

The vendor dashboard is a privileged application area.

It should support relevant vendor operations such as:

* Viewing orders.
* Accepting orders.
* Preparing orders.
* Marking orders out for delivery.
* DVC verification.
* Completing orders.

Every action must call the backend.

Do not simulate successful vendor actions locally.

---

# 32. VENDOR OWNERSHIP

The frontend may receive vendor/order/product IDs.

Never assume that having an ID means the current vendor can modify the resource.

The backend must enforce ownership.

The frontend should still avoid displaying actions for resources that do not belong to the current user.

---

# 33. LOCATION / GEOLOCATION

Nearby vendor discovery is a core SabiGet feature.

The frontend may request browser location permission.

Handle:

* Permission granted.
* Permission denied.
* Permission unavailable.
* Timeout.
* Inaccurate location.
* User changing location.

Never make the app unusable simply because location permission is denied.

Provide a graceful fallback where the product design allows it.

---

# 34. LOCATION PRIVACY

Do not continuously collect location unnecessarily.

Only request location when needed.

Do not log precise user coordinates.

Do not expose raw coordinates in URLs.

Do not persist location longer than required unless explicitly part of the product design.

---

# 35. VENDOR DISCOVERY

The frontend should consume backend-provided vendor discovery results.

The backend should remain authoritative for:

* Distance.
* Radius.
* Vendor availability.
* Vendor eligibility.
* Ranking.

Do not reproduce complex vendor ranking logic inside React.

---

# 36. VENDOR CARDS

Vendor cards should remain reusable.

Current UI may display:

* Image.
* Rating.
* Review count.
* Location.
* Delivery time.
* Categories.

Do not duplicate vendor card markup across pages.

Extend the shared component where appropriate.

---

# 37. MENU MODAL

The existing menu experience uses:

```text
MenuModal.tsx
```

Keep product/menu behavior modular.

It should handle:

* Loading.
* Product display.
* Availability.
* Quantity.
* Special requests where supported.
* Add to cart.
* Empty state.
* Error state.

Do not embed payment logic inside the menu component.

---

# 38. MODALS

Avoid deeply nested modals.

For example:

```text
AuthModal
→ MenuModal
→ CheckoutModal
→ PaymentModal
```

can become difficult to manage.

Where complexity grows, prefer clear application-level state or route-based flows.

Do not introduce a global state library merely to solve one small modal interaction.

---

# 39. STATE MANAGEMENT

Use the simplest state architecture that fits the feature.

Prefer:

* Local React state for local UI.
* Props for simple parent-child communication.
* Context only for genuinely shared state.
* A dedicated state library only when complexity justifies it.

Do not introduce Redux/Zustand/etc. just because the application has multiple components.

Inspect the existing architecture first.

---

# 40. LOCAL STORAGE

Existing application behavior may use `localStorage` for:

* Authentication/session information.
* Latest order ID.
* Guest state.

Before changing storage keys:

1. Search the entire frontend.
2. Search the backend if relevant.
3. Check existing documentation.
4. Preserve backward compatibility where reasonable.

Do not create duplicate keys for the same concept.

---

# 41. ORDER ID PERSISTENCE

The application currently stores the latest order ID so order tracking can locate the most recent order.

Preserve this behavior unless the architecture is intentionally changed.

Avoid relying exclusively on localStorage for long-term order history.

The backend remains the source of truth.

---

# 42. ERROR HANDLING

Every API-driven component should consider:

```text
Loading
Success
Empty
Error
```

where applicable.

Do not leave users staring at blank screens.

Errors should be:

* Human-readable.
* Actionable.
* Non-sensitive.

Do not display raw backend stack traces.

---

# 43. LOADING STATES

Use appropriate loading UI.

Avoid blocking the entire page for a small API request.

Prefer localized loading states where possible.

For example:

```text
Vendor list loading
```

should not necessarily block:

```text
Navigation
Footer
Static content
```

---

# 44. EMPTY STATES

Design explicit empty states for:

* No nearby vendors.
* Empty cart.
* No orders.
* No products.
* No available products.
* No vendor activity.

Do not confuse:

```text
loading
```

with:

```text
empty
```

---

# 45. NETWORK FAILURE

Assume network requests can fail.

Handle:

* Offline state.
* Timeout.
* Server unavailable.
* Slow connection.
* Request cancellation.

Do not create infinite retry loops.

Retries should be deliberate and bounded.

---

# 46. PWA PERFORMANCE

SabiGet is a PWA.

Prioritize:

* Fast initial load.
* Small client bundles.
* Optimized images.
* Minimal unnecessary JavaScript.
* Code splitting where useful.
* Efficient API requests.
* Good mobile performance.

Do not ship large dependencies for trivial functionality.

---

# 47. NEXT.JS PERFORMANCE

Prefer server rendering/static rendering where appropriate.

Use client components only where needed.

Avoid unnecessary:

```text
useEffect
useState
```

especially for data that could be fetched on the server.

However, authenticated and browser-specific flows may appropriately require client-side behavior.

Optimize based on actual requirements, not ideology.

---

# 48. IMAGE OPTIMIZATION

Use the appropriate Next.js image strategy where applicable.

Do not load enormous images for small vendor cards.

Consider:

* Responsive dimensions.
* Lazy loading.
* Appropriate formats.
* Placeholder behavior.

Avoid external image dependencies that create unnecessary latency.

---

# 49. ANIMATIONS

Framer Motion is already part of the project.

Animations should:

* Improve UX.
* Be subtle where appropriate.
* Avoid blocking interaction.
* Respect reduced-motion preferences.
* Not significantly increase bundle size for trivial interactions.

Do not animate every element simply because animation is available.

---

# 50. ACCESSIBILITY

All interactive UI must remain accessible.

Pay attention to:

* Semantic HTML.
* Keyboard navigation.
* Focus management.
* Button labels.
* Form labels.
* Dialog accessibility.
* Screen reader behavior.
* Color contrast.
* Reduced motion.

Do not use:

```text
<div onClick={...}>
```

when a semantic button is appropriate.

---

# 51. AUTH MODAL ACCESSIBILITY

Authentication modals should:

* Trap focus appropriately.
* Support Escape where appropriate.
* Have accessible labels.
* Clearly communicate errors.
* Preserve keyboard navigation.
* Not leave focus stranded after closing.

---

# 52. RESPONSIVE DESIGN

SabiGet is mobile-first.

Ensure flows work on:

```text
Small phones
Large phones
Tablets
Laptops
Desktop
```

Do not optimize exclusively for desktop.

The bottom navigation is intended for mobile.

Desktop may use traditional top navigation.

Preserve the dual-navigation concept.

---

# 53. BRANDING

The existing SabiGet brand uses Vivid Orange:

```text
#FF4500
```

Do not randomly replace the established brand system.

If introducing design tokens, preserve existing visual identity.

---

# 54. UI CONSISTENCY

Reuse:

* Buttons.
* Inputs.
* Cards.
* Dialog patterns.
* Typography.
* Spacing.
* Icons.

Avoid five visually different implementations of the same button.

If the repository lacks shared primitives and the UI is becoming repetitive, propose a component system before creating many duplicates.

---

# 55. LUCIDE ICONS

Lucide Icons are already used.

Prefer existing icon conventions.

Do not add another icon library without explicit justification.

---

# 56. TAILWIND

Tailwind is the existing styling system.

Follow current project conventions.

Avoid mixing multiple styling systems unnecessarily.

Do not create huge arbitrary inline style objects when Tailwind or existing components are sufficient.

---

# 57. FRAMER MOTION

Use existing Framer Motion patterns where appropriate.

Do not introduce custom animation frameworks.

Keep animations performant.

Respect:

```text
prefers-reduced-motion
```

where relevant.

---

# 58. SOCKET.IO CLIENT

The backend already supports Socket.IO.

Frontend realtime integration is currently incomplete.

When implementing it:

1. Inspect backend event names.
2. Inspect room naming.
3. Inspect authentication requirements.
4. Establish connection safely.
5. Join only authorized rooms.
6. Listen for relevant events.
7. Update UI state.
8. Keep REST as the authoritative fallback.

Do not invent event names.

---

# 59. SOCKET CLEANUP

Every Socket.IO subscription must be cleaned up.

Avoid:

```text
duplicate listeners
memory leaks
stale closures
multiple socket connections
```

Especially when components mount/unmount or order IDs change.

---

# 60. POLLING

Current order tracking uses polling.

Until Socket.IO is fully verified:

```text
REST polling = fallback
```

Do not remove polling prematurely.

Polling should:

* Use reasonable intervals.
* Stop when no longer needed.
* Avoid running after component unmount.
* Avoid overlapping requests.
* Respect terminal order states.

---

# 61. API REQUEST CANCELLATION

Where appropriate, cancel requests when components unmount or requests become obsolete.

This is particularly useful for:

* Search.
* Vendor discovery.
* Rapid filter changes.
* Menu switching.

Do not over-engineer cancellation for trivial static requests.

---

# 62. FORMS

Forms should:

* Validate input.
* Show loading state.
* Prevent duplicate submission.
* Show errors.
* Preserve user input when appropriate.

Do not disable a form forever after one failed request.

---

# 63. OTP UI

OTP input should:

* Handle incomplete codes.
* Handle invalid codes.
* Handle expiration.
* Handle resend.
* Respect backend rate limits.
* Prevent accidental duplicate submissions.

Do not display server secrets or development OTPs in production UI.

---

# 64. CHECKOUT DUPLICATE SUBMISSION

Prevent accidental duplicate checkout requests.

Use appropriate UI locking while the request is in progress.

But the backend must ALSO enforce idempotency.

Frontend prevention is not sufficient.

---

# 65. PAYMENT REDIRECTS

Do not assume redirect completion equals payment completion.

After payment return:

```text
Frontend
→ Backend
→ Authoritative order/payment state
→ UI
```

If payment confirmation is delayed, display a pending state rather than falsely reporting failure.

---

# 66. CUSTOMER EXPERIENCE

The core product principle is:

```text
LOW FRICTION
```

Avoid unnecessary:

* Account creation.
* Form fields.
* Page transitions.
* Loading screens.
* Reauthentication.

But never sacrifice security for convenience.

---

# 67. VENDOR EXPERIENCE

Vendor UI should prioritize:

```text
FAST ORDER VISIBILITY
FAST ACCEPTANCE
CLEAR STATUS
EASY DVC VERIFICATION
LOW COGNITIVE LOAD
```

Vendor operations should be optimized for mobile as well as desktop.

---

# 68. DATA FETCHING

Before fetching data in a component:

1. Check whether the parent already has it.
2. Check whether another component already fetches it.
3. Check whether a shared hook exists.
4. Avoid duplicate requests.

Do not create request waterfalls unnecessarily.

---

# 69. CACHING

Cache only when it provides a real benefit.

Potential candidates:

* Vendor discovery.
* Menus.
* Static configuration.

Do not aggressively cache:

* Payment status.
* Order status.
* Inventory.
* Authorization state.

without understanding consistency requirements.

---

# 70. SEO

Public pages should maintain appropriate metadata.

At minimum:

* Title.
* Description.
* Open Graph metadata where appropriate.
* Relevant structured metadata where useful.

Do not add fake SEO content merely for search engines.

---

# 71. PWA MANIFEST

The application uses:

```text
manifest.ts
```

Preserve PWA metadata.

Ensure:

* App name.
* Icons.
* Theme colors.
* Display mode.
* Start URL.

remain coherent with the application.

---

# 72. ENVIRONMENT VARIABLES

Frontend environment variables exposed to browser code must use:

```text
NEXT_PUBLIC_
```

Do not expose secrets through:

```text
NEXT_PUBLIC_PAYSTACK_SECRET_KEY
NEXT_PUBLIC_JWT_SECRET
NEXT_PUBLIC_TERMII_SECRET
```

Never put backend secrets into frontend environment variables.

---

# 73. PUBLIC CONFIGURATION

It is acceptable for the frontend to know public configuration such as:

```text
API base URL
Paystack public key where required
public app configuration
```

It must NOT receive:

```text
Paystack secret key
JWT secret
database password
Termii secret
Redis credentials
```

---

# 74. ENVIRONMENT FILES

Do not commit secrets.

Check:

```text
.gitignore
.env
.env.local
.env.production
```

before making environment changes.

Never paste production secrets into source files.

---

# 75. DOCKER FRONTEND RULES

When running inside Docker, distinguish between:

```text
Container-to-container networking
```

and:

```text
Browser-to-server networking
```

The frontend container may reach:

```text
backend:5000
```

but browser-side JavaScript cannot necessarily use that hostname.

Do not confuse these two network boundaries.

---

# 76. BUILD SAFETY

Before declaring frontend work complete, run:

```powershell
npm run build
```

when the change affects production compilation.

If linting is configured:

```powershell
npm run lint
```

Run the appropriate checks rather than assuming the application compiles.

---

# 77. NEXT.JS CACHE ISSUES

The project has previously encountered stale `.next` / Turbopack-related issues.

If a Next.js build/runtime error appears suspiciously related to stale artifacts:

1. Stop the development server.
2. Remove `.next`.
3. Reinstall dependencies only if necessary.
4. Rebuild.
5. Reproduce.
6. Investigate the actual error if it persists.

Do not blindly reinstall the entire project for every Next.js error.

---

# 78. TYPESCRIPT ERRORS

Do not silence TypeScript errors with:

```text
any
@ts-ignore
@ts-expect-error
```

unless there is a documented and justified reason.

Fix the underlying type problem whenever practical.

---

# 79. ESLINT

Follow the project's existing ESLint configuration.

Do not disable lint rules globally to make a build pass.

If a rule is genuinely incompatible with the architecture, document and change it deliberately.

---

# 80. COMPONENT DESIGN

Components should have one clear responsibility.

Avoid enormous components containing:

* Authentication.
* API calls.
* Cart state.
* Payment.
* Socket listeners.
* Rendering.
* Navigation.

all in one file.

When a component becomes difficult to reason about, extract responsibilities carefully.

---

# 81. CUSTOM HOOKS

Use custom hooks for reusable client behavior.

Examples:

```text
useAuth
useCart
useOrders
useGeolocation
useSocket
```

Do not create hooks simply to wrap one line of code.

Reuse existing hooks before creating new ones.

---

# 82. BUSINESS COMPONENTS

Feature-specific components should remain close to their domain when the repository structure supports it.

Examples:

```text
auth/
cart/
checkout/
orders/
vendors/
dashboard/
```

Avoid putting every component into one giant `components/` directory forever if the application grows significantly.

However, do not restructure the repository without a concrete reason.

---

# 83. SHARED COMPONENTS

Generic UI components can be shared.

Examples:

```text
Button
Input
Modal
Card
Badge
Spinner
EmptyState
ErrorState
```

Shared components should not contain business-specific logic.

---

# 84. PAGE COMPONENTS

Page components should primarily orchestrate:

* Data.
* Layout.
* Feature components.
* Navigation.

Avoid turning every page into a giant monolithic component.

---

# 85. ROUTE PROTECTION

Protected pages should determine authentication state appropriately.

Examples:

```text
/orders
/vendor-dashboard
```

should not blindly assume a logged-in user.

Handle:

* Loading.
* Unauthenticated.
* Unauthorized role.
* Authenticated.

Do not expose protected information before authentication is established.

---

# 86. REDIRECTS

Authentication redirects should be intentional.

Do not create redirect loops.

Consider:

```text
Unauthenticated
→ login
→ successful auth
→ intended destination
```

where appropriate.

---

# 87. ACCESSIBILITY + ERROR STATES

Error states must remain accessible.

Do not rely only on:

```text
red text
```

to communicate errors.

Use:

* Text.
* Appropriate ARIA semantics.
* Focus where necessary.

---

# 88. SECURITY OF USER INPUT

Never render unsanitized arbitrary HTML from backend/user input.

Avoid unsafe:

```text
dangerouslySetInnerHTML
```

unless the content is explicitly sanitized and the use case requires it.

---

# 89. USER-GENERATED CONTENT

Potential user-generated fields include:

* Special requests.
* Reviews.
* Vendor descriptions.
* Product descriptions.

Render them safely.

Do not assume backend content is always trusted for HTML rendering.

---

# 90. FRONTEND TESTING

When tests exist, extend them for meaningful new behavior.

At minimum, test important logic around:

* Authentication.
* Cart.
* Checkout.
* Order state display.
* Vendor actions.
* Error handling.

Do not test implementation details unnecessarily.

Prefer user-visible behavior.

---

# 91. MANUAL QA

Use:

```text
TESTING_GUIDE.md
```

as the source for end-to-end manual testing.

Important flows include:

```text
Guest OTP
Member login
Vendor login
Vendor discovery
Menu
Cart
Guest checkout
Member checkout
Payment
Order tracking
Customer order history
Vendor dashboard
DVC
Cancellation
Rejection
Refund
```

---

# 92. INTEGRATION-FIRST THINKING

The frontend is currently at the stage where backend integration is more important than adding decorative UI.

Prioritize:

```text
API correctness
Authentication
Checkout
Payment
Orders
Realtime status
Vendor operations
```

over:

```text
More animations
More landing-page sections
Minor visual polish
```

---

# 93. DO NOT MOCK LIVE FEATURES

Do not leave fake data in production flows when a real backend endpoint exists.

Examples:

```text
fake vendors
fake orders
fake payment success
fake vendor acceptance
fake order status
fake loyalty balance
```

Mocks are acceptable only for:

* Tests.
* Explicit development fixtures.
* Story/demo environments.

They must not silently replace real APIs.

---

# 94. FALLBACK DATA

Do not silently fall back from a failed API request to fake production-looking data.

Bad:

```text
API failed
→ show fake vendors
```

Better:

```text
API failed
→ show error state
→ allow retry
```

---

# 95. FRONTEND/BACKEND CONTRACT CHANGES

If the frontend needs a backend change:

1. Document the mismatch.
2. Inspect backend implementation.
3. Determine whether the frontend or backend should change.
4. Preserve backward compatibility where practical.
5. Update both sides deliberately.
6. Test the full flow.

Do not "fix" a frontend problem by inventing a fake API contract.

---

# 96. API ERROR NORMALIZATION

Frontend API utilities should eventually normalize common errors into predictable structures.

The UI should not need to understand:

```text
Paystack raw error
Prisma raw error
Express stack trace
```

Instead it should receive a safe application-level error.

---

# 97. NETWORK RETRIES

Do not retry every request automatically.

Safe candidates may include:

* Idempotent GET requests.
* Temporary discovery requests.

Be extremely careful with:

* POST checkout.
* Payment initialization.
* Order mutation.
* Vendor status mutation.

Those require backend idempotency and deliberate retry behavior.

---

# 98. DOUBLE CLICKS

Prevent duplicate user actions.

Examples:

```text
Place Order
Pay
Accept Order
Reject Order
Verify DVC
Complete Order
```

Use loading/disabled states.

But remember:

UI prevention is not a substitute for backend idempotency.

---

# 99. ORDER TRACKING PERFORMANCE

Order tracking should not cause excessive requests.

If polling is used:

* Poll only while relevant.
* Stop on terminal states.
* Avoid duplicate intervals.
* Clean up on unmount.
* Handle tab visibility where appropriate.

When Socket.IO is verified, reduce unnecessary polling.

---

# 100. REALTIME DATA CONSISTENCY

Socket events may arrive:

* Out of order.
* More than once.
* After a REST request.
* Before a component is ready.

Do not blindly overwrite state without considering the current order state.

If necessary, reconcile with the backend.

---

# 101. FRONTEND DATA SECURITY

Do not persist unnecessary sensitive data in localStorage.

Avoid storing:

* Full payment details.
* Passwords.
* Secrets.
* Sensitive personal information.

Only persist what the UX genuinely requires.

---

# 102. LOGGING IN FRONTEND

Do not leave sensitive debugging logs in production.

Never log:

* Access tokens.
* Refresh tokens.
* Passwords.
* OTPs.
* Payment credentials.
* Personal information unnecessarily.

Temporary debugging logs must be removed before completion.

---

# 103. BROWSER CONSOLE

A clean production build should not contain noisy debugging output.

Use proper error reporting/logging strategy where one exists.

Do not spam:

```text
console.log(...)
```

inside frequently executed render/effect paths.

---

# 104. PERFORMANCE BUDGET

When adding dependencies or large components, ask:

```text
Does this materially improve the product?
```

If not, do not add it.

Prefer existing dependencies.

---

# 105. MOBILE NETWORKS

Assume users may have:

* Slow mobile data.
* High latency.
* Intermittent connectivity.
* Limited bandwidth.

Avoid:

* Huge initial payloads.
* Repeated unnecessary requests.
* Large images.
* Aggressive polling.

---

# 106. UX DURING SLOW NETWORKS

Do not leave users guessing.

For important actions show:

```text
Submitting...
Processing...
Checking payment...
Updating order...
```

Avoid false success states.

---

# 107. FORM VALIDATION VS SERVER VALIDATION

Frontend validation improves UX.

Backend validation protects the system.

Both are required.

Do not remove frontend validation because backend validation exists.

Do not remove backend validation because frontend validation exists.

---

# 108. PRODUCT AVAILABILITY

The frontend should reflect backend availability.

If a product becomes unavailable while the user has it in the cart:

```text
Checkout
→ backend validates
→ frontend receives conflict
→ user is informed
```

Do not assume the cart is always current.

---

# 109. CART STALE DATA

Prices and availability may change.

The frontend should be prepared for backend checkout validation to reject stale cart information.

Display a clear recovery path.

---

# 110. LOYALTY UI

Current business rule:

```text
100 points = ₦50
```

The frontend may display this conversion.

But the backend remains authoritative for:

* Points earned.
* Points redeemed.
* Balance.
* Eligibility.

Never allow users to directly manipulate loyalty state through client-side storage.

---

# 111. DVC UI

DVC should be treated as a security-sensitive operation.

The frontend should:

* Collect the code.
* Validate obvious format issues.
* Submit to backend.
* Display success/failure.
* Respect lockout responses.

Do not implement local DVC verification.

---

# 112. VENDOR DELIVERY FLOW

Vendor flow should reflect:

```text
Order accepted
→ Preparation
→ Out for delivery
→ DVC verification
→ Delivered
→ Completed
```

The exact backend state machine is authoritative.

Do not invent transitions solely for UI convenience.

---

# 113. ADMIN UI

If admin frontend features are added:

* Protect routes.
* Protect API calls.
* Avoid exposing sensitive metrics unnecessarily.
* Handle privileged actions carefully.
* Require confirmation for destructive financial actions.

Frontend admin protection is not sufficient without backend RBAC.

---

# 114. DEStructive ACTIONS

Actions such as:

```text
Cancel order
Reject order
Refund
Suspend vendor
Delete product
```

should generally require clear user intent.

Avoid accidental destructive actions from single ambiguous clicks.

---

# 115. CONFIRMATION UX

For high-impact actions:

```text
User intent
→ Confirmation
→ API request
→ Loading
→ Result
```

Do not make destructive actions irreversible through accidental taps.

---

# 116. BACK NAVIGATION

Preserve sensible browser/mobile navigation.

Do not use JavaScript redirects for every interaction.

Use Next.js routing appropriately.

---

# 117. DEEP LINKS

Important routes should work when directly opened.

Examples:

```text
/orders
/vendor-dashboard
```

Do not assume users always arrive through `/`.

---

# 118. REFRESH SAFETY

Refreshing the page should not corrupt:

* Cart.
* Authentication state.
* Current order tracking.
* Vendor dashboard state.

Where persistence is required, implement it deliberately.

---

# 119. SESSION EXPIRATION

When an access token expires:

```text
→ attempt appropriate refresh
→ retry safe request where appropriate
→ otherwise require authentication
```

Avoid infinite refresh loops.

---

# 120. LOGOUT

Logout should:

* Clear appropriate local session state.
* Disconnect/reconfigure realtime connections as appropriate.
* Reset user-specific state.
* Redirect appropriately.

Do not leave authenticated user data visible after logout.

---

# 121. USER-SPECIFIC STATE

When switching users:

```text
User A logout
→ User B login
```

ensure User A's:

* Cart.
* Orders.
* Socket rooms.
* Cached data.
* UI state.

do not leak into User B's session.

---

# 122. GUEST → MEMBER UPGRADE

The guest-to-member flow should preserve relevant user context.

Do not accidentally create a second customer profile when the backend supports account conversion/linking.

---

# 123. API REQUEST HEADERS

Use appropriate headers consistently.

Examples:

```text
Content-Type
Authorization
```

Do not manually duplicate header logic across every component if an API abstraction exists.

---

# 124. FRONTEND ENVIRONMENT DEBUGGING

When API requests fail:

Check in this order:

```text
1. Environment variable
2. Browser-visible API URL
3. Backend running
4. Backend health endpoint
5. CORS
6. Route
7. Authentication
8. Request payload
9. Backend response
```

Do not immediately rewrite the frontend.

---

# 125. CORS DEBUGGING

A browser CORS error does not automatically mean the backend route is broken.

Inspect:

* Origin.
* Backend CORS configuration.
* Preflight request.
* Credentials.
* API URL.

Fix the actual cause.

Do not simply set:

```text
Access-Control-Allow-Origin: *
```

as a debugging shortcut and forget to revert it.

---

# 126. DOCKER DEBUGGING

When running the full stack through Docker, understand:

```text
Browser
  ↓
Frontend container
  ↓
Backend container
  ↓
PostgreSQL / Redis
```

But browser-side JavaScript may communicate directly with the backend through a host/public URL.

Do not confuse container DNS with browser DNS.

---

# 127. FRONTEND BUILD ENVIRONMENT

Remember that Next.js environment variables are evaluated according to build/runtime behavior.

Do not assume changing an environment variable always changes an already-built frontend bundle.

Rebuild when necessary.

---

# 128. PRODUCTION BUILD

Before release:

```powershell
npm run build
```

must pass.

Also verify:

```text
API configuration
authentication
checkout
payment return
order tracking
vendor dashboard
PWA behavior
```

---

# 129. CODE QUALITY

Avoid:

* Dead code.
* Unused imports.
* Duplicate components.
* Duplicate API functions.
* Giant components.
* Hardcoded API URLs.
* Hardcoded secrets.
* Fake production data.
* Unnecessary dependencies.

---

# 130. REFACTORING RULE

Do not refactor the entire frontend while implementing a feature.

If a structural problem blocks the feature:

1. Identify the smallest necessary refactor.
2. Explain why it is required.
3. Make the refactor.
4. Test it.
5. Continue.

---

# 131. FILE CREATION

Before creating a new file:

1. Search for an existing equivalent.
2. Check naming conventions.
3. Check whether an existing component/hook/API utility can be extended.
4. Create a new file only when it improves maintainability.

---

# 132. NAMING

Use descriptive names.

Prefer:

```text
OrderStatusCard
CustomerOrdersPage
VendorDashboardPage
```

over:

```text
Card2
PageNew
TempComponent
```

Do not use names like:

```text
final
new
latest
updated
backup
```

for production source files.

---

# 133. IMPORTS

Keep imports clean and consistent.

Avoid circular dependencies.

If a component imports a page that imports the component, stop and rethink the architecture.

---

# 134. CLIENT DATA FLOW

Prefer explicit data flow.

Avoid hidden mutations of shared objects.

When updating state, preserve immutability.

Do not mutate React state objects directly.

---

# 135. REACT KEYS

Use stable keys for lists.

Do not use array indexes as keys when list identity can change.

Especially important for:

* Cart items.
* Orders.
* Products.
* Vendors.

---

# 136. EFFECTS

Every `useEffect` should have a clear reason.

Before adding one, ask:

```text
Can this be derived?
Can this be handled by an event?
Can this be fetched server-side?
```

Avoid effects that cause unnecessary render/request loops.

---

# 137. ASYNC EFFECTS

Do not make the effect callback itself an uncontrolled async operation.

Handle cancellation and cleanup appropriately.

Avoid updating state after a component is unmounted.

---

# 138. EVENT HANDLERS

Avoid recreating complex business logic in event handlers.

Prefer calling:

```text
hook
service
API utility
```

where appropriate.

---

# 139. ERROR BOUNDARIES

For major application areas, consider appropriate error boundaries if the current architecture supports them.

A failure in one feature should not unnecessarily destroy the entire application.

---

# 140. ACCESSIBLE MODAL CONTENT

Modal content must have:

* Clear title.
* Accessible description where needed.
* Proper focus behavior.
* Close mechanism.
* Keyboard support.

---

# 141. MOBILE BOTTOM NAVIGATION

The mobile bottom navigation is part of the product architecture.

Ensure it does not:

* Cover important content.
* Block buttons.
* Interfere with keyboard input.
* Become unusable on small screens.

Respect safe-area insets where appropriate.

---

# 142. DESKTOP NAVIGATION

Desktop should retain a traditional top navigation experience where applicable.

Do not force mobile-only navigation patterns onto desktop.

---

# 143. OFFLINE / DEGRADED EXPERIENCE

Because SabiGet is a PWA, consider degraded states.

However, do NOT pretend that payment/order mutations succeeded offline.

Safe offline behavior may include:

* Cached public UI.
* Cached non-sensitive content.
* Offline messaging.

Never fake successful financial operations.

---

# 144. SERVICE WORKER / PWA CHANGES

If service worker functionality exists or is introduced:

* Avoid caching authenticated/private API responses carelessly.
* Avoid caching payment responses.
* Avoid caching sensitive customer data.
* Ensure stale data does not misrepresent order state.

---

# 145. REALTIME ORDER STATUS

When realtime updates are implemented:

```text
REST
→ initial authoritative state

Socket.IO
→ live updates

REST
→ reconciliation/fallback
```

If the socket reports an impossible state transition, do not blindly render it.

---

# 146. FRONTEND/BACKEND DEBUGGING

When an integration fails, trace the full chain:

```text
UI action
↓
event handler
↓
API utility
↓
HTTP request
↓
Express route
↓
middleware
↓
controller
↓
service
↓
database/external service
↓
response
↓
frontend state
↓
UI
```

Do not patch only the visible symptom.

---

# 147. CONTRACT-FIRST DEVELOPMENT

When integrating a backend endpoint:

1. Identify method.
2. Identify URL.
3. Identify authentication.
4. Identify request body/query.
5. Identify response.
6. Identify errors.
7. Implement typed client.
8. Connect UI.
9. Test success.
10. Test failure.

---

# 148. NO API GUESSING

Never write frontend code based on an assumed endpoint such as:

```text
POST /checkout
```

without confirming it exists.

Inspect the backend.

---

# 149. NO RESPONSE GUESSING

Never assume:

```ts
data.orders
```

exists without checking the actual response.

Confirm the contract.

---

# 150. INTEGRATION PRIORITY

When continuing SabiGet development, prioritize:

```text
1. Authentication integration
2. Vendor discovery
3. Menu/product API
4. Cart/checkout integration
5. Paystack flow
6. Order tracking
7. Socket.IO realtime updates
8. Vendor dashboard integration
9. Customer order history
10. Loyalty UX
11. PWA/performance hardening
12. Visual polish
```

Adjust the order when repository evidence indicates a dependency.

---

# 151. DO NOT BUILD FEATURES TWICE

Before implementing a feature:

Search:

```text
frontend
backend
documentation
tests
```

The feature may already exist partially.

Extend existing work instead of duplicating it.

---

# 152. EXISTING DOCUMENTATION

Important project documentation includes:

```text
FRONTEND_INTEGRATION_GUIDE.md
TESTING_GUIDE.md
```

Read relevant sections before implementing API integration.

Documentation is useful, but actual backend behavior remains authoritative when documentation is stale.

---

# 153. AUDIT-FIRST DEVELOPMENT

When beginning work on an unfamiliar or partially completed frontend feature:

Do NOT immediately edit code.

First:

```text
Inspect
→ Trace
→ Compare contract
→ Identify gap
→ Plan
→ Implement
→ Test
```

---

# 154. SESSION CONTINUATION

When continuing from a previous OpenCode session:

First run:

```powershell
git status
git diff
```

Then inspect the relevant files.

Do not assume previous work was completed just because a previous session said it was.

---

# 155. GIT SAFETY

Before large changes:

Inspect:

```powershell
git status
```

Do not overwrite unrelated user work.

Do not reset or discard changes unless explicitly instructed.

Do not use destructive Git commands casually.

---

# 156. PRODUCTION SAFETY

Never expose:

* Secrets.
* Private customer data.
* Internal IDs unnecessarily.
* Payment credentials.
* Authentication tokens.

Never commit:

```text
.env
.env.local
```

if they contain secrets.

---

# 157. DEPENDENCY SAFETY

Before adding a frontend dependency:

1. Search existing dependencies.
2. Check whether the feature can be implemented with existing packages.
3. Consider bundle size.
4. Consider maintenance.
5. Consider security.

Do not add libraries for trivial functionality.

---

# 158. UI PERFORMANCE

Avoid unnecessary:

* Re-renders.
* API calls.
* Socket connections.
* Timers.
* Large client-side state.
* Heavy animations.

Measure before applying complex optimization.

---

# 159. FINAL FRONTEND PRINCIPLE

The SabiGet frontend is the user-facing coordination layer.

Its responsibilities are:

```text
PRESENT
COLLECT
NAVIGATE
COMMUNICATE
RESPOND
```

The backend remains responsible for:

```text
AUTHORIZE
VALIDATE
CALCULATE
PERSIST
CHARGE
REFUND
VERIFY
```

The frontend must make SabiGet feel:

```text
FAST
SIMPLE
TRUSTWORTHY
MOBILE-FIRST
LOW-FRICTION
```

Above all:

```text
INSPECT FIRST.
FOLLOW THE REAL API CONTRACT.
REUSE EXISTING WORK.
KEEP THE UI RESPONSIVE.
NEVER TRUST THE CLIENT FOR BUSINESS AUTHORITY.
TEST THE REAL USER FLOW.
```