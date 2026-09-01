# AGENTS.md — SabiGet Engineering Rules

## 1. PURPOSE

This file defines the global engineering rules, architecture, business constraints, development workflow, and behavioral expectations for AI coding agents working on the SabiGet repository.

SabiGet is an existing, actively developed production-oriented application.

You are NOT starting a new project.

You MUST treat the existing repository as the primary source of truth for implementation details and inspect existing code before making assumptions.

The objective is to:

* Continue the existing implementation.
* Preserve working functionality.
* Complete missing integrations.
* Fix defects safely.
* Improve reliability and maintainability where justified.
* Avoid unnecessary rewrites.
* Keep frontend and backend responsibilities clearly separated.
* Maintain the established SabiGet business model and rules.
* Produce production-quality changes incrementally.

---

# 2. PROJECT IDENTITY

Project name:

SabiGet

Product type:

Location-aware, multi-vendor food marketplace and Progressive Web App.

Core business model:

* Asset-light marketplace.
* Vendors manage their own fulfillment and delivery.
* SabiGet coordinates customers, vendors, orders, payments, and delivery verification.
* SabiGet does NOT operate its own delivery fleet.
* Cash on Delivery is NOT supported.
* Payments are prepaid.
* Guest checkout is a first-class experience.

Primary value proposition:

* Nearby food discovery.
* Low-friction guest checkout.
* Prepaid digital ordering.
* Vendor-managed fulfillment.
* Real-time order coordination.
* Loyalty rewards.
* Operational visibility.

---

# 3. NON-NEGOTIABLE BUSINESS RULES

These rules MUST NOT be changed casually.

Any change to these rules requires explicit approval from the project owner.

## 3.1 Guest-first checkout

Customers MUST be able to browse and initiate checkout without first creating a traditional account.

Guest checkout is a core conversion strategy.

Do not introduce mandatory account registration before checkout unless explicitly instructed.

---

## 3.2 Progressive identity

The intended customer identity flow is:

Guest
→ phone verification
→ shadow/guest account
→ order
→ optional account upgrade
→ full member account

Do not remove guest functionality merely to simplify authentication.

---

## 3.3 Prepaid-only payments

SabiGet does NOT support Cash on Delivery.

Orders must follow the established prepaid payment architecture.

Do not introduce:

* Cash on Delivery.
* Manual payment confirmation from the frontend.
* Client-controlled payment success.
* Client-controlled order settlement.

Payment state MUST ultimately be verified by the backend and trusted payment provider/webhook flow.

---

## 3.4 Paystack

Paystack is the current payment provider.

Existing Paystack integration MUST be reused unless the project owner explicitly requests a provider change.

Do not replace the payment architecture with another provider.

Do not duplicate payment business logic in frontend components.

The frontend may initiate payment through the backend flow and redirect/open the appropriate Paystack authorization experience.

The backend remains authoritative for:

* Payment initialization.
* Payment references.
* Payment status.
* Verification.
* Webhook processing.
* Refunds.
* Idempotency.
* Settlement-related business logic.

---

## 3.5 Vendor-managed fulfillment

SabiGet is NOT a logistics company.

Vendors are responsible for:

* Preparing orders.
* Dispatching riders/delivery partners.
* Delivering orders.
* Completing the physical fulfillment process.

Do not introduce a SabiGet-owned delivery fleet or logistics workflow unless explicitly requested.

---

## 3.6 Delivery Verification Code

The Delivery Verification Code (DVC) is a security mechanism for order delivery.

Current configuration includes:

* DVC length: 6 characters/digits.
* Maximum verification attempts.
* Lockout duration.

The exact values MUST be obtained from the current environment/configuration rather than guessed.

The frontend MUST NOT be treated as the authority for DVC validity.

DVC validation belongs to the backend.

---

## 3.7 Automatic order expiration

Pending orders are subject to automatic expiration/auto-kill behavior.

The existing backend worker and expiration logic MUST be preserved.

Do not move expiration enforcement exclusively into the frontend.

The frontend may display countdown/status information, but the backend MUST remain authoritative.

---

## 3.8 Loyalty conversion

The established loyalty redemption rule is:

100 loyalty points = ₦50.

This is NOT a 1:1 currency conversion.

Do not change this conversion accidentally.

Loyalty calculations and redemption authorization belong to the backend.

---

## 3.9 Location-aware discovery

Nearby vendor discovery is based on customer location and the backend's existing location logic.

The frontend may obtain browser geolocation and submit coordinates.

The backend remains authoritative for:

* Vendor distance calculations.
* Service-radius checks.
* Eligibility.
* Vendor discovery results.

Do not duplicate authoritative vendor-radius business rules in React.

---

# 4. CURRENT TECHNOLOGY STACK

## Frontend

* Next.js 16
* React 19
* TypeScript
* Tailwind CSS
* Framer Motion
* Lucide Icons
* PWA capabilities

## Backend

* Node.js
* Express.js
* Prisma ORM
* PostgreSQL
* Redis
* Socket.IO
* JWT
* Helmet
* CORS
* Morgan
* Express rate limiting

## External integrations

* Paystack
* Termii

Do not introduce a new major framework, ORM, state-management architecture, database, payment provider, authentication provider, or realtime framework without explicit justification and approval.

---

# 5. CURRENT REPOSITORY STATE

The repository already contains substantial functionality.

Assume the following areas are implemented unless repository inspection proves otherwise:

## Backend

* Express server bootstrap.
* Authentication.
* Guest authentication.
* Member authentication.
* Vendor authentication.
* JWT access tokens.
* Refresh tokens.
* RBAC.
* OTP.
* Vendor management.
* Product management.
* Customer management.
* Nearby vendor discovery.
* Orders.
* Paystack integration.
* Payment webhooks.
* Refund handling.
* Order expiration.
* DVC verification.
* Loyalty.
* Admin operations.
* Socket.IO server infrastructure.
* Prisma/PostgreSQL persistence.
* Redis configuration.
* Security middleware.
* Backend tests.

## Frontend

* Landing page.
* Vendor discovery UI.
* Vendor cards.
* Menu UI.
* Cart.
* Checkout.
* Authentication modal.
* Guest OTP UI.
* Member login UI.
* Vendor login UI.
* Customer order history.
* Order tracking.
* Vendor dashboard.
* Responsive UI.
* Framer Motion animations.

However:

DOCUMENTATION IS NOT PROOF.

Always inspect the actual implementation before claiming something is complete, missing, broken, or duplicated.

---

# 6. SOURCE-OF-TRUTH HIERARCHY

When information conflicts, use this priority order:

1. Explicit instruction from the project owner in the current task.
2. Actual working implementation and database schema.
3. Current API contracts/documentation.
4. Current tests.
5. Project documentation.
6. Existing comments.
7. Assumptions.

Never invent an API endpoint, response structure, database field, environment variable, event name, or business rule when it can be discovered from the repository.

If uncertain, inspect the code.

---

# 7. EXISTING CODE MUST BE INSPECTED BEFORE MODIFICATION

Before modifying a feature:

1. Locate the relevant route/page/component.
2. Locate its API/service implementation.
3. Inspect related types.
4. Inspect relevant tests.
5. Inspect environment/configuration where applicable.
6. Trace the current data flow.
7. Identify dependencies.
8. Determine what is actually missing.
9. Make the smallest appropriate change.

Do not immediately create replacement files.

Do not assume that a feature is absent because it is not located where you expected.

---

# 8. NO UNNECESSARY REWRITES

DO NOT rewrite functioning systems simply because you prefer another architecture.

Avoid:

* Unnecessary framework migrations.
* ORM replacement.
* Database replacement.
* Payment provider replacement.
* Authentication rewrites.
* Large folder restructuring.
* Replacing working API contracts.
* Rewriting entire components for small fixes.
* Introducing new state-management libraries without need.

Prefer incremental changes.

If a rewrite genuinely appears necessary:

1. Explain why.
2. Identify the affected systems.
3. Identify migration risks.
4. Propose the safer alternative.
5. Ask for approval before proceeding with a destructive architectural change.

---

# 9. FRONTEND / BACKEND RESPONSIBILITY

The frontend is NOT the source of truth for business-critical operations.

Frontend responsibilities include:

* Rendering UI.
* Collecting user input.
* Managing local/client state.
* Calling APIs.
* Displaying backend state.
* Handling navigation.
* Displaying loading/error/success states.
* Maintaining responsive/PWA behavior.
* Listening to realtime events.

Backend responsibilities include:

* Authentication authority.
* Authorization.
* Business rules.
* Order state transitions.
* Payment state.
* Refund decisions.
* Loyalty calculations.
* DVC validation.
* Vendor eligibility.
* Vendor service radius.
* Order expiration.
* Idempotency.
* Database persistence.
* Audit behavior.

Never trust values supplied by the frontend for:

* Prices.
* Payment amounts.
* Loyalty balances.
* Roles.
* Vendor permissions.
* Order ownership.
* DVC validity.
* Refund eligibility.
* Payment success.

---

# 10. API INTEGRATION RULES

The frontend MUST communicate with the backend through a dedicated API layer.

Do not scatter raw fetch/axios calls throughout UI components unless the existing architecture explicitly requires it.

Prefer:

UI
→ hook/service
→ API client
→ backend endpoint.

Keep API communication separate from presentation logic.

Before creating an API client method:

1. Find the backend route.
2. Find the controller.
3. Find the service.
4. Determine the expected request.
5. Determine the actual response.
6. Determine authentication requirements.
7. Determine error behavior.

Do not guess endpoint contracts.

---

# 11. ENVIRONMENT VARIABLES

Never hardcode secrets.

Never commit:

* API keys.
* JWT secrets.
* Database credentials.
* Paystack secrets.
* Termii credentials.
* Redis credentials.
* Production passwords.
* Private tokens.

Use `.env.example` for documented variable names without real secrets.

Be aware of networking context.

A browser may use:

```text
http://localhost:5000
```

while Docker containers may communicate using:

```text
http://backend:5000
```

Similarly, a backend container must NOT use `localhost` to reach a separate PostgreSQL or Redis container.

Always determine which runtime environment the variable belongs to.

---

# 12. DOCKER RULES

Docker configuration must account for service-to-service networking.

Inside Docker:

* `localhost` refers to the current container.
* Docker Compose service names should be used for internal communication.
* Database and Redis dependencies should account for service readiness.
* `depends_on` alone does not guarantee application readiness.

Do not claim Docker production readiness without verifying:

* Database connectivity.
* Redis connectivity.
* Migration execution.
* Backend startup.
* Frontend startup.
* Health checks.
* Correct environment variables.

---

# 13. ORDER STATE MANAGEMENT

Order states are business-critical.

Current known lifecycle states include:

* UNPAID
* PENDING
* ACCEPTED
* PREPARING
* OUT_FOR_DELIVERY
* DELIVERED
* COMPLETED
* CANCELLED_CUSTOMER
* REJECTED_VENDOR
* AUTO_KILLED
* REFUNDED

Do not invent arbitrary state transitions.

Before changing order behavior, inspect:

* Prisma schema.
* Order service.
* Controllers.
* Routes.
* Payment logic.
* Expiration worker.
* Webhooks.
* Vendor dashboard.
* Customer order UI.
* Tests.

Think in terms of valid state transitions rather than treating statuses as arbitrary strings.

Pay particular attention to race conditions involving:

* Vendor acceptance.
* Customer cancellation.
* Automatic expiration.
* Payment confirmation.
* Refunds.
* Webhook retries.
* Duplicate requests.

---

# 14. PAYMENT SAFETY

Payment-related code is high risk.

Changes to payment logic require extra caution.

Never trust:

```text
payment successful
```

merely because the frontend reports it.

Never allow the frontend to directly mark an order as:

* Paid.
* Settled.
* Refunded.
* Completed.

Payment lifecycle must remain backend-controlled.

Paystack webhook processing must remain resilient to:

* Duplicate events.
* Retries.
* Out-of-order events.
* Network failures.
* Missing frontend responses.

Preserve idempotency protections.

---

# 15. SOCKET.IO RULES

Socket.IO is for realtime event delivery.

Use REST/API calls for authoritative commands and data retrieval.

Use Socket.IO for events such as:

* Vendor order notifications.
* Customer order status updates.
* Realtime order state changes.

Do not turn Socket.IO into a second REST API.

The frontend should be resilient to:

* Disconnections.
* Reconnects.
* Duplicate events.
* Missed events.
* Stale client state.

Realtime events should generally trigger state updates or reconciliation, while the backend remains authoritative.

Polling may remain as a fallback/reconciliation mechanism where appropriate.

---

# 16. AUTHENTICATION AND SECURITY

Never expose:

* JWT secrets.
* Paystack secret keys.
* Termii credentials.
* Database credentials.
* Redis credentials.

Authentication and authorization MUST be enforced server-side.

Frontend role checks are for UX only.

Do not rely on:

```text
if (user.role === "ADMIN")
```

in the frontend as the security boundary.

The backend must enforce permissions.

Be careful with browser token storage.

Before changing token storage behavior, inspect the existing authentication design and evaluate:

* XSS exposure.
* Refresh-token behavior.
* CSRF considerations.
* Existing API expectations.
* Deployment architecture.

Do not change authentication architecture casually.

---

# 17. DATABASE RULES

Prisma/PostgreSQL is the current persistence layer.

Do not modify the schema casually.

Before schema changes:

1. Inspect existing relations.
2. Inspect migrations.
3. Inspect services using affected models.
4. Inspect tests.
5. Determine migration impact.
6. Ensure existing data will remain valid.

Never silently delete or reset production data.

Do not use destructive migration commands against production.

Database migrations must be intentional and reversible where practical.

---

# 18. REDIS

Redis is part of the current infrastructure.

Before changing Redis usage:

* Inspect existing configuration.
* Identify whether Redis is used for caching, rate limiting, sessions, jobs, or other purposes.
* Preserve existing behavior.

Do not introduce Redis as a dependency merely because it is available.

Do not remove Redis configuration without verifying its current consumers.

---

# 19. TYPESCRIPT RULES

Use TypeScript types to make API contracts explicit.

Avoid:

```typescript
any
```

unless there is a documented reason.

Prefer:

* Explicit interfaces/types.
* Discriminated unions where useful.
* Typed API responses.
* Typed order statuses.
* Typed roles.
* Typed Socket.IO events.
* Runtime validation for untrusted external data.

Do not assume backend JSON is safe merely because TypeScript says it is.

---

# 20. VALIDATION

Validate user input at the backend boundary.

Frontend validation is for UX.

Backend validation is for security and correctness.

Important validation areas include:

* Phone numbers.
* OTP codes.
* Passwords.
* Vendor IDs.
* Product IDs.
* Quantities.
* Prices.
* Addresses.
* Coordinates.
* Order IDs.
* DVC.
* Payment references.

Never trust client-supplied totals.

---

# 21. ERROR HANDLING

Errors must be handled deliberately.

Frontend should distinguish between:

* Loading.
* Validation failure.
* Authentication failure.
* Authorization failure.
* Network failure.
* Backend failure.
* Payment failure.
* Not found.
* Conflict.
* Rate limiting.

Do not hide errors with empty catch blocks.

Avoid exposing sensitive backend details to users.

Backend logs may contain useful diagnostic information, but API responses should remain safe.

---

# 22. PERFORMANCE

SabiGet is a mobile-first PWA.

Prefer:

* Small client bundles.
* Lazy loading where useful.
* Optimized images.
* Minimal unnecessary requests.
* Efficient API calls.
* Debounced search where appropriate.
* Proper caching where appropriate.
* Avoiding unnecessary global state.
* Avoiding unnecessary rerenders.
* Reusing fetched data.

Do not optimize prematurely.

Measure or identify a concrete performance problem before introducing complex optimization.

---

# 23. MOBILE-FIRST UX

SabiGet is primarily designed for mobile users.

Every frontend feature should be evaluated for:

* Small screens.
* Touch interaction.
* Slow networks.
* Loading states.
* Offline/intermittent connectivity.
* Large tap targets.
* Clear errors.
* Fast perceived performance.

Desktop layouts should enhance the experience rather than dictate it.

---

# 24. ACCESSIBILITY

Frontend work should preserve:

* Semantic HTML.
* Keyboard navigation.
* Focus states.
* Accessible labels.
* Appropriate button semantics.
* Screen-reader-friendly controls.
* Sufficient visual contrast.

Do not use clickable `<div>` elements where a button or link is appropriate.

---

# 25. UI / BRAND CONSISTENCY

SabiGet's established visual identity should be preserved.

Primary brand direction includes:

* Vivid Orange: `#FF4500`
* Mobile-first marketplace UI.
* Clean food-discovery experience.
* Responsive design.
* Purposeful animation.

Do not introduce unrelated visual systems without reason.

Framer Motion should enhance UX rather than make every element animate unnecessarily.

---

# 26. TESTING REQUIREMENTS

Every meaningful backend change should have appropriate tests.

Existing backend test areas include:

* Authentication.
* Customer endpoints.
* Vendor/admin endpoints.
* Order endpoints.
* Product endpoints.
* Webhooks.

Before completing a task:

1. Run the most relevant tests.
2. Run broader tests when the change affects shared infrastructure.
3. Verify the application builds.
4. Report failures honestly.

Never claim tests passed unless they actually ran successfully.

Do not delete failing tests simply to make the test suite green.

If an existing test is incorrect, explain why and fix it deliberately.

---

# 27. MANUAL QA

Use `TESTING_GUIDE.md` when testing end-to-end workflows.

Important workflows include:

* Guest OTP.
* Member login.
* Vendor login.
* Vendor discovery.
* Menu browsing.
* Cart.
* Guest checkout.
* Member checkout.
* Payment.
* Order status.
* Vendor acceptance.
* Vendor rejection.
* Customer cancellation.
* DVC verification.
* Refund behavior.
* Customer order history.

Do not rely exclusively on unit tests for payment/order workflows.

---

# 28. CHANGE MANAGEMENT

Before making changes, determine:

### What is the objective?

What exact behavior needs to change?

### What currently happens?

Trace the existing implementation.

### What is missing?

Identify the smallest gap.

### What files are affected?

List them before editing where practical.

### What could break?

Consider:

* API consumers.
* Authentication.
* Orders.
* Payments.
* Database.
* Socket.IO.
* Existing tests.
* Docker.
* Production deployment.

---

# 29. IMPLEMENTATION STRATEGY

Prefer small, logically grouped changes.

Good:

```text
Implement vendor discovery API integration.
Test it.
Verify it.
Then move to menu integration.
```

Bad:

```text
Rewrite frontend architecture,
change state management,
move directories,
rewrite API layer,
change auth,
and add vendor discovery
all in one operation.
```

Small changes are easier to review, test, revert, and continue after context compaction.

---

# 30. BEFORE EDITING

For every non-trivial task:

1. Inspect relevant files.
2. Search for existing implementations.
3. Search for existing API endpoints.
4. Search for existing types.
5. Search for existing tests.
6. Inspect documentation.
7. Form a short implementation plan.

Do not edit first and investigate later.

---

# 31. AFTER EDITING

After implementation:

1. Review the diff.
2. Check for accidental changes.
3. Run relevant tests.
4. Run lint/type checks where available.
5. Run a build where appropriate.
6. Verify runtime behavior when possible.
7. Check for environment/configuration implications.
8. Update documentation if behavior or architecture changed.

---

# 32. DO NOT FABRICATE COMPLETION

Never say:

* "Implemented" when only scaffolding exists.
* "Tested" when tests were not run.
* "Production-ready" when only local behavior was verified.
* "Socket.IO is working" when only the server exists.
* "Payment is working" when only initialization was tested.
* "Database is working" merely because the server started.

Be precise.

Use language such as:

* Implemented.
* Partially integrated.
* Scaffolded.
* Verified locally.
* Tested with unit tests.
* Tested end-to-end.
* Not yet verified.
* Blocked by environment configuration.

---

# 33. DOCUMENTATION

Important project documentation includes:

* `FRONTEND_INTEGRATION_GUIDE.md`
* `TESTING_GUIDE.md`

If these exist, inspect them before changing related functionality.

If a significant architectural or behavioral change is made, update the appropriate documentation.

Do not allow documentation to become intentionally misleading.

---

# 34. GIT SAFETY

Do not perform destructive Git operations without explicit approval.

Never run or recommend destructive commands such as:

```bash
git reset --hard
git clean -fd
git push --force
```

unless explicitly authorized.

Do not overwrite unrelated user changes.

Before modifying a heavily changed area, inspect the current Git state when relevant.

Preserve uncommitted work.

---

# 35. FILE SAFETY

Do not delete files merely because they appear unused.

Before deleting:

1. Search for imports/references.
2. Check build configuration.
3. Check route discovery.
4. Check tests.
5. Check dynamic imports.
6. Confirm it is genuinely obsolete.

If uncertain, do not delete it.

---

# 36. DEPENDENCY MANAGEMENT

Do not install packages unnecessarily.

Before adding a dependency:

1. Check whether the repository already has a suitable dependency.
2. Check whether native/platform functionality can solve the problem.
3. Determine bundle/runtime impact.
4. Determine maintenance/security implications.
5. Explain why the dependency is needed.

Do not introduce duplicate libraries for the same purpose.

---

# 37. ARCHITECTURAL DECISION RULE

When multiple solutions are possible, prefer the solution that:

1. Preserves existing architecture.
2. Has the smallest safe change surface.
3. Reuses existing infrastructure.
4. Is easy to test.
5. Is easy to understand.
6. Does not create unnecessary coupling.
7. Can scale with the marketplace.
8. Does not compromise security.

Avoid "clever" solutions when a straightforward solution is more maintainable.

---

# 38. DO NOT DUPLICATE BUSINESS LOGIC

Never independently implement the same business rule in multiple places.

Examples:

* Loyalty conversion.
* Order expiration.
* Vendor radius.
* Payment amount calculation.
* DVC validation.
* Refund eligibility.
* Order state transitions.

The frontend may display or mirror the rule for UX, but the backend must remain authoritative.

---

# 39. API CONTRACT DISCIPLINE

If an API contract already exists:

* Do not silently change it.
* Do not rename fields casually.
* Do not change response shapes without checking consumers.
* Do not remove fields without migration planning.

If a contract must change:

1. Identify all consumers.
2. Update backend.
3. Update frontend.
4. Update tests.
5. Update documentation.
6. Verify backward compatibility where required.

---

# 40. REALTIME EVENT DISCIPLINE

Socket.IO event names are part of the application contract.

Do not casually rename or remove events.

Before changing an event:

* Search all server emitters.
* Search all server listeners.
* Search all frontend listeners.
* Search all frontend emitters.
* Update related tests/documentation.

Avoid duplicate listeners caused by React lifecycle mistakes.

Clean up Socket.IO listeners when components unmount.

---

# 41. STATE MANAGEMENT

Do not put everything into global state.

Use local component state for local UI concerns.

Use shared state only when multiple parts of the application genuinely need the data.

Potential global/shared state includes:

* Authentication/session.
* Cart.
* Active order.
* Relevant vendor/customer state.

Backend data should not automatically be copied into global state.

Prefer a clear source of truth.

---

# 42. BROWSER STORAGE

Existing authentication and order persistence use browser storage.

Before changing storage behavior, inspect existing consumers.

Do not store secrets unnecessarily.

Do not store sensitive payment credentials in browser storage.

Do not assume `localStorage` is available during server rendering.

Guard browser-only APIs appropriately in Next.js.

---

# 43. NEXT.JS SERVER/CLIENT BOUNDARIES

Be deliberate about:

* Server Components.
* Client Components.
* Browser-only APIs.
* `localStorage`.
* Geolocation.
* Socket.IO.
* Payment UI.
* Event handlers.

Components requiring browser APIs or client interactivity should explicitly use the appropriate client boundary.

Do not turn the entire application into Client Components unnecessarily.

---

# 44. PWA CONSIDERATIONS

The PWA should remain usable under imperfect network conditions.

Do not introduce aggressive caching that can cause:

* Stale prices.
* Stale vendor availability.
* Stale order states.
* Stale payment information.

Never cache sensitive or rapidly changing order/payment information blindly.

---

# 45. PRODUCTION SAFETY

Never assume local success equals production readiness.

Before calling a feature production-ready, consider:

* Environment configuration.
* Authentication.
* Authorization.
* Database.
* Redis.
* Payment provider.
* Webhooks.
* Rate limiting.
* Logging.
* Error handling.
* Concurrency.
* Reconnect behavior.
* Data consistency.
* Deployment behavior.

---

# 46. CURRENT KNOWN INFRASTRUCTURE CONCERNS

Known areas requiring verification include:

## Database environment

Local development and Docker use different networking contexts.

Do not use `localhost` for container-to-container database communication.

## Redis

Verify Redis connectivity independently.

## Docker readiness

`depends_on` does not guarantee service readiness.

Health checks should be considered for PostgreSQL and Redis.

## Production environment

Do not blindly reuse development `.env` configuration in production.

## Frontend API URL

The browser needs a browser-reachable backend URL.

Do not expose Docker-only hostnames such as:

```text
http://backend:5000
```

to the browser.

## Root package.json

Verify the root npm scripts and dependency configuration before relying on them.

## Next.js/Turbopack

The project has previously encountered React Server Component manifest/module resolution issues related to Turbopack and stale `.next` state.

Do not assume every Next.js runtime error is an application-code problem.

---

# 47. AGENT WORKFLOW

For every substantial task, follow:

## STEP 1 — UNDERSTAND

Read:

* Task.
* Relevant documentation.
* Relevant existing implementation.

## STEP 2 — INVESTIGATE

Search the repository.

Trace:

* UI.
* API.
* Controller.
* Service.
* Database.
* Tests.
* Realtime events where applicable.

## STEP 3 — PLAN

Create a concise implementation plan.

Identify:

* Files to modify.
* Files to create.
* Existing code to reuse.
* Tests required.
* Potential risks.

## STEP 4 — IMPLEMENT

Make the smallest coherent change.

Do not modify unrelated files.

## STEP 5 — VERIFY

Run:

* Relevant tests.
* Type checking.
* Linting.
* Build.
* Runtime/manual verification where appropriate.

## STEP 6 — REVIEW

Inspect the diff.

Look for:

* Accidental changes.
* Debug logging.
* Hardcoded secrets.
* Broken imports.
* Unused dependencies.
* Type errors.
* Race conditions.
* API contract mismatches.

## STEP 7 — REPORT

Provide:

* What changed.
* Why it changed.
* Files affected.
* Tests run.
* Test results.
* Known limitations.
* Recommended next step.

---

# 48. SESSION COMPACTION / CONTINUATION RULES

This project may be developed across multiple OpenCode sessions.

When context becomes limited or a session is compacted:

DO NOT restart the project from scratch.

Before continuing:

1. Re-read this `AGENTS.md`.
2. Inspect current Git diff/status.
3. Inspect the files relevant to the current task.
4. Read any task-specific documentation.
5. Determine what was completed.
6. Determine what remains.
7. Verify current runtime/test state.
8. Continue from the existing implementation.

Never assume that a previous session's plan was fully executed.

Verify actual repository state.

---

# 49. TASK CHECKPOINTS

For long tasks, maintain clear checkpoints.

A checkpoint should state:

```text
TASK:
Current objective.

COMPLETED:
What has actually been implemented.

IN PROGRESS:
What is currently being worked on.

REMAINING:
What still needs to happen.

FILES CHANGED:
Relevant files.

TESTS:
What has been run and results.

BLOCKERS:
Known issues.

NEXT ACTION:
The next concrete step.
```

This allows work to continue reliably after session compaction.

---

# 50. STOP CONDITIONS

STOP and ask for clarification when:

* Requirements conflict.
* A destructive migration appears necessary.
* Existing architecture must be substantially rewritten.
* A payment architecture change is required.
* Authentication architecture must change.
* Production secrets are needed but unavailable.
* A business rule is ambiguous.
* An API contract is unclear and cannot be determined from the repository.
* A database migration could cause data loss.
* A requested change conflicts with another explicit project requirement.

Do NOT guess when the consequence is significant.

---

# 51. AUTONOMOUS WORK

You may autonomously:

* Inspect files.
* Search the repository.
* Trace dependencies.
* Run tests.
* Run lint/type checks.
* Run builds.
* Fix clear bugs.
* Implement well-defined tasks.
* Add tests.
* Improve error handling.
* Refactor small localized code where the benefit is clear.

You should seek approval before:

* Major architecture changes.
* Database redesign.
* Payment provider changes.
* Authentication redesign.
* Removing major functionality.
* Large dependency migrations.
* Destructive operations.
* Changing core business rules.

---

# 52. CODE QUALITY STANDARD

Code should be:

* Readable.
* Explicit.
* Modular.
* Testable.
* Secure.
* Maintainable.
* Type-safe where applicable.
* Consistent with existing conventions.

Prefer boring, reliable code over clever abstractions.

Do not introduce abstraction merely to reduce a few repeated lines.

---

# 53. COMMENTING

Comments should explain WHY, not WHAT.

Avoid comments such as:

```text
// Set loading to true
```

Prefer comments explaining:

* Business constraints.
* Race-condition prevention.
* Payment behavior.
* Security decisions.
* Non-obvious workarounds.
* External API limitations.

Remove obsolete comments when behavior changes.

---

# 54. LOGGING

Do not leave temporary debugging logs in production code.

Never log:

* Passwords.
* OTP codes.
* JWT secrets.
* Payment secrets.
* Database passwords.
* Sensitive personal information.

Use structured logging where the existing system supports it.

---

# 55. EXTERNAL SERVICES

Treat external integrations as unreliable.

External services include:

* Paystack.
* Termii.
* PostgreSQL.
* Redis.

Always consider:

* Timeout.
* Failure.
* Retry.
* Duplicate requests.
* Partial success.
* Unavailable service.
* Invalid response.

Do not assume an external API always succeeds.

---

# 56. CURRENT PRIORITY

The project is currently in the integration and stabilization stage.

Priority order should generally be:

1. Environment/runtime stability.
2. Frontend/backend API integration.
3. Authentication integration.
4. Vendor discovery.
5. Menu/product flow.
6. Cart/checkout.
7. Payment flow verification.
8. Customer order lifecycle.
9. Socket.IO frontend integration.
10. Vendor dashboard integration.
11. End-to-end testing.
12. Production hardening.

Do not prioritize cosmetic improvements over broken core workflows.

---

# 57. GOLDEN PATH

The primary customer journey is:

Location
→ nearby vendors
→ vendor
→ menu
→ product selection
→ cart
→ guest/member checkout
→ OTP where required
→ order creation
→ Paystack payment
→ payment confirmation
→ vendor notification
→ vendor acceptance
→ preparation
→ out for delivery
→ DVC verification
→ delivered
→ completed
→ loyalty points
→ optional member/account upgrade

This journey should remain the primary integration target.

---

# 58. FINAL PRINCIPLE

The goal is not to produce the largest amount of code.

The goal is to produce a reliable SabiGet marketplace.

Before changing anything, ask:

1. Does this already exist?
2. Where is the current source of truth?
3. What layer owns this responsibility?
4. Can the existing implementation be reused?
5. What could this change break?
6. How will we verify it?
7. Is this actually necessary?

When in doubt:

INSPECT FIRST.

PLAN SECOND.

IMPLEMENT THIRD.

TEST FOURTH.

VERIFY FIFTH.

DOCUMENT WHEN NECESSARY.

Never trade a working system for a theoretically prettier one without a compelling engineering reason.
