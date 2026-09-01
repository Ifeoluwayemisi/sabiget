# SabiGet Premium Design System

> Version: 1.0
>
> Status: ACTIVE
>
> Scope: Entire SabiGet frontend experience
>
> Primary implementation target: Next.js 16 + React 19 + TypeScript + Tailwind CSS + Framer Motion + Lucide
>
> Governing engineering instructions: `/AGENTS.md`

---

# 1. PURPOSE

This document is the single source of truth for the visual design, interaction design, motion language, responsive behavior, accessibility standards, and frontend product experience of SabiGet.

SabiGet is a location-aware, multi-vendor food marketplace.

The interface must communicate:

- trust
- speed
- convenience
- quality
- local discovery
- appetite
- professionalism
- technological maturity

The product must feel like a serious consumer marketplace, not a generic template, student project, dashboard, or experimental prototype.

The homepage is a major conversion surface and must be treated as a product and marketing experience, not merely a collection of UI sections.

---

# 2. DESIGN PHILOSOPHY

## 2.1 Core principle

SabiGet should feel:

> Premium. Warm. Fast. Local. Effortless.

The interface should be visually confident without becoming visually noisy.

Premium quality comes from:

- strong typography
- intentional whitespace
- excellent imagery
- visual hierarchy
- restrained color usage
- consistent spacing
- subtle depth
- responsive precision
- purposeful motion
- clear copy
- excellent interaction feedback

Premium does NOT mean:

- excessive gradients
- excessive glassmorphism
- excessive rounded cards
- excessive shadows
- excessive animations
- floating decorative blobs everywhere
- giant meaningless text
- unnecessary complexity
- visual effects without functional purpose

Do not use visual effects merely because they are technically possible.

---

# 3. BRAND PERSONALITY

SabiGet should feel:

- confident
- youthful
- modern
- trustworthy
- energetic
- locally relevant
- approachable
- sophisticated

It should not feel:

- corporate and sterile
- childish
- overly playful
- cheap
- overly futuristic
- generic SaaS
- visually chaotic

The product should communicate confidence through restraint.

---

# 4. BRAND COLOR SYSTEM

## 4.1 Primary brand color

SabiGet Orange:

`#FF4500`

This is the primary brand accent.

Use it for:

- primary CTAs
- important actions
- active states
- selected controls
- important highlights
- brand accents
- interactive indicators

Do NOT use SabiGet Orange as the dominant background for every section.

---

## 4.2 Base colors

Use a restrained neutral system.

### Ink

Near-black for primary text.

Preferred conceptual value:

`#111111`

### Secondary text

Use a muted neutral gray.

Conceptual value:

`#666666`

### Muted text

Use lighter neutral gray.

Conceptual value:

`#8A8A8A`

### Background

Use a warm near-white rather than an aggressively cold white.

Conceptual value:

`#FAFAF8`

### Surface

Pure white or extremely subtle warm white.

Conceptual value:

`#FFFFFF`

### Border

Extremely subtle neutral border.

Conceptual value:

`#EAEAEA`

---

## 4.3 Semantic colors

Success:

Use a restrained green.

Warning:

Use amber.

Error:

Use red.

Info:

Use a calm blue where appropriate.

Semantic colors must never overpower the SabiGet brand.

---

# 5. COLOR USAGE RULES

Use approximately:

- 70–80% neutral surfaces
- 10–20% imagery/content
- 5–10% brand accent

These percentages are guidelines, not hard mathematical constraints.

The goal is visual balance.

The primary orange should immediately communicate:

> "This is actionable."

not:

> "Everything on this screen is orange."

---

# 6. TYPOGRAPHY

Typography is one of the primary mechanisms for creating premium perception.

## 6.1 Hierarchy

Use a clear hierarchy:

### Display

Used for major hero headlines.

Characteristics:

- bold
- confident
- tight line height
- strong visual presence

### H1

Used for major page titles.

### H2

Used for major sections.

### H3

Used for cards and subsections.

### Body

Readable and relaxed.

### Small

Used for supporting metadata.

### Label

Used for UI controls.

---

## 6.2 Typography principles

Prefer:

- short headlines
- concise supporting text
- strong hierarchy
- comfortable reading width
- intentional line breaks

Avoid:

- giant paragraphs
- excessive uppercase
- weak hierarchy
- tiny text
- decorative typography that harms readability

---

# 7. RESPONSIVE TYPOGRAPHY

Typography must adapt naturally.

Mobile:

- compact display sizes
- readable body copy
- limited line length

Desktop:

- larger display typography
- stronger visual hierarchy
- generous whitespace

Do not simply scale every text value proportionally.

Use responsive typography intentionally.

---

# 8. SPACING SYSTEM

Use a consistent spacing scale.

Preferred conceptual scale:

```text
4
8
12
16
20
24
32
40
48
64
80
96
120
````

Do not invent random spacing values unnecessarily.

Spacing should communicate hierarchy.

Small spacing:

* related elements

Medium spacing:

* component groups

Large spacing:

* major sections

---

# 9. LAYOUT SYSTEM

Use a centered content container.

Desktop content should not stretch infinitely across the viewport.

Use generous horizontal margins.

Major sections should have clear visual breathing room.

Recommended conceptual maximum content width:

```text
1200px–1280px
```

depending on the section.

Some hero layouts may intentionally use wider visual compositions.

---

# 10. BORDER RADIUS

Use moderate rounding.

The design should feel modern without turning every element into a pill.

Use:

* small radius for controls
* medium radius for cards
* larger radius for prominent visual containers

Pill shapes should be reserved for:

* tags
* filters
* compact statuses
* selected categories

Do not make every button and card a pill.

---

# 11. SHADOWS AND DEPTH

Shadows must be subtle.

Use shadows to communicate:

* elevation
* interaction
* hierarchy

Avoid heavy shadows around every component.

Most cards should rely on:

* whitespace
* border
* imagery
* subtle elevation

rather than large drop shadows.

---

# 12. ICONOGRAPHY

Use Lucide Icons as the default icon system.

Icons must:

* have consistent stroke weight
* align correctly with text
* communicate a clear function
* have accessible labels when necessary

Do not mix multiple unrelated icon libraries.

Do not use icons merely for decoration when they add no meaning.

---

# 13. IMAGERY

Food imagery is a core part of SabiGet's visual identity.

Images should be:

* appetizing
* high quality
* authentic
* appropriately cropped
* visually consistent

Avoid:

* low-quality images
* unrelated stock imagery
* obvious placeholder imagery in production
* inconsistent image proportions

Vendor and product images should maintain consistent aspect ratios.

Use `next/image` wherever appropriate.

Images should be lazy-loaded when they are outside the initial viewport.

Above-the-fold imagery should be optimized for fast loading.

---

# 14. HOMEPAGE / LANDING PAGE

The homepage is a critical conversion surface.

Its purpose is to answer within seconds:

1. What is SabiGet?
2. Why should I use it?
3. Can I find food near me?
4. How do I start?

---

# 15. HOMEPAGE STRUCTURE

Recommended structure:

```text
Navbar
Hero
Nearby Vendors
How SabiGet Works
Trust / Why SabiGet
Vendor CTA
Final CTA
Footer
```

Sections may evolve based on actual product needs, but the page must maintain a clear conversion narrative.

---

# 16. NAVIGATION

## Desktop

The navigation should be clean and minimal.

Potential structure:

```text
SabiGet

Discover
How it works
For vendors

                         Orders
                         Account
                         Find food
```

Do not overload the navbar.

---

## Mobile

Use a sticky bottom navigation where appropriate.

Recommended conceptual structure:

```text
Home
Discover
Orders
Account
```

Icons must be paired with concise labels where space permits.

The active state should use SabiGet Orange.

---

# 17. HERO SECTION

The hero is the most important visual section.

It should immediately communicate:

> Good food is nearby.

Recommended content hierarchy:

```text
Headline
Supporting statement
Primary CTA
Secondary action where appropriate
Location/discovery context
Strong food imagery
```

Example direction:

> Good food, right around you.

Supporting copy:

> Discover nearby food vendors, order what you're craving, and get it sorted without the usual hassle.

Primary CTA:

> Find food near me

Secondary CTA:

> Browse vendors

Copy should remain concise.

---

# 18. HERO VISUAL DESIGN

The hero should have a strong visual anchor.

Possible visual approaches:

* premium food photography
* layered vendor imagery
* subtle location visualization
* food card composition
* dynamic discovery interface

Avoid generic hero illustrations unless they genuinely strengthen the brand.

The visual should feel connected to the actual SabiGet product.

---

# 19. LOCATION DISCOVERY

Location is a major SabiGet differentiator.

The location experience should feel useful rather than intrusive.

Preferred conceptual interaction:

```text
What's good around you?

[ Use my location ]
```

Loading:

> Finding food near you...

Success:

> Food near [location]

Failure:

> We couldn't access your location.

Supporting action:

> Allow location access to discover nearby vendors.

Users must still be able to browse when location permission is denied.

---

# 20. NEARBY VENDORS SECTION

Suggested heading direction:

> Good food is closer than you think.

Supporting copy should be concise.

Potential filters:

```text
Nearby
Popular
Fastest
Top rated
```

Only display filters supported by the backend.

Do not create fake filtering behavior.

---

# 21. VENDOR CARD

Vendor cards are conversion components.

They should communicate:

* vendor image
* vendor name
* rating
* category
* estimated preparation/delivery time where applicable
* distance where available
* availability status where applicable
* CTA or clickable surface

Example:

```text
Vendor image

Mama's Kitchen        ★ 4.8

Nigerian • 18–25 min
1.2 km away

View menu
```

The card should feel appetizing rather than database-like.

---

# 22. VENDOR CARD INTERACTION

Desktop hover:

* subtle elevation
* subtle image zoom
* slight transform

Mobile:

* touch-friendly
* no hover-dependent functionality
* visual feedback on tap

Do not over-animate cards.

---

# 23. HOW SABIGET WORKS

Use a simple three-step explanation.

```text
01
Discover

02
Order

03
Enjoy
```

Each step should have:

* number/icon
* short title
* one concise explanation

Do not write paragraphs.

---

# 24. TRUST SECTION

Trust is critical because SabiGet handles payments and food orders.

Communicate concepts such as:

### Secure payments

Payments are processed securely.

### Nearby vendors

Discover participating food vendors around you.

### Delivery verification

Delivery verification helps confirm successful handoff.

### Guest checkout

Customers can begin ordering without creating a full account first.

Avoid exaggerated claims.

Never claim certifications, guarantees, or partnerships that do not actually exist.

---

# 25. VENDOR CTA

The vendor section should communicate the marketplace value proposition.

Recommended messaging direction:

> You make the food. We help people find it.

Supporting text:

> Put your menu in front of hungry customers around you.

CTA:

> Become a SabiGet vendor

This section should feel like a genuine business proposition.

---

# 26. FINAL CTA

The final CTA should be short and memorable.

Potential direction:

> Hungry? Let's fix that.

Primary CTA:

> Find food near me

The final section should have strong visual closure.

---

# 27. FOOTER

The footer should contain:

* SabiGet branding
* navigation
* customer links
* vendor links
* legal links
* social links where available
* copyright

Do not invent social accounts or URLs.

---

# 28. BUTTON SYSTEM

Primary button:

* SabiGet Orange
* high contrast
* strong text
* clear hover state
* clear focus state

Secondary button:

* neutral surface
* subtle border
* strong text

Tertiary button:

* text-based
* minimal visual weight

Destructive button:

* reserved for destructive actions
* clear warning context

Buttons must communicate their hierarchy.

Do not make every button visually dominant.

---

# 29. FORM DESIGN

Forms should feel calm and simple.

Inputs must have:

* clear labels
* readable text
* visible focus state
* appropriate error state
* sufficient touch target

Never rely on placeholder text as the only label.

---

# 30. AUTHENTICATION UI

Authentication should minimize friction.

The existing authentication architecture must remain intact.

Supported experiences include:

* Guest OTP
* Member login
* Vendor login
* OTP verification
* account upgrade

Visual redesign must never change authentication semantics.

---

# 31. CART

The cart should clearly communicate:

* selected items
* quantities
* prices
* special requests
* subtotal
* service fees where applicable
* total

The user should always understand:

> "How much am I paying?"

No hidden charges.

---

# 32. CHECKOUT

Checkout should be intentionally short.

Required information should be requested only when necessary.

Guest checkout must remain guest-first.

The UI must not force unnecessary account creation before ordering.

Payment UI must clearly communicate:

* order total
* delivery information
* payment status
* next step

---

# 33. PAYMENT EXPERIENCE

Payment is a high-trust interaction.

Use clear states:

```text
Ready to pay
Processing
Payment successful
Payment failed
Payment cancelled
```

Never leave the user guessing whether money was charged.

The frontend must rely on authoritative backend/payment state.

---

# 34. ORDER TRACKING

Order tracking should feel reassuring.

Use a clear timeline:

```text
Order placed
     ↓
Vendor accepted
     ↓
Preparing
     ↓
Out for delivery
     ↓
Delivered
     ↓
Completed
```

The current state should be visually prominent.

Completed states should feel satisfying.

---

# 35. DVC EXPERIENCE

The Delivery Verification Code is a security feature.

The interface should explain what the code is for.

Example:

> Your delivery code

> Give this code to the delivery person when your order arrives.

The code must be visually easy to read.

Never expose unnecessary security information.

---

# 36. VENDOR DASHBOARD

The vendor dashboard should use the same SabiGet design language but can be more operational.

Priorities:

1. New orders
2. Order status
3. Store availability
4. Menu management
5. Performance
6. Notifications

The dashboard should prioritize information density without becoming cluttered.

---

# 37. LOADING STATES

Use skeleton UI for major content.

Examples:

* vendor card skeleton
* product skeleton
* order skeleton
* dashboard skeleton

Avoid replacing entire interfaces with generic spinners.

Use spinners for short, localized actions such as:

* button submission
* payment processing
* OTP verification

---

# 38. EMPTY STATES

Empty states should explain:

1. what happened
2. why it matters
3. what the user can do next

Example:

> Nothing tasty nearby yet.

> Try expanding your search radius.

CTA:

> Explore more vendors

Never use empty states that blame the user.

---

# 39. ERROR STATES

User-facing errors must be human-readable.

Never expose raw:

```text
AxiosError
Prisma error
stack traces
database errors
HTTP implementation details
```

Example:

> Something went wrong.

> We couldn't load nearby vendors right now.

CTA:

> Try again

Technical details belong in logs.

---

# 40. MOTION PRINCIPLES

Motion must communicate:

* hierarchy
* feedback
* continuity
* state change

Motion must not exist simply to impress.

---

# 41. PAGE ENTRANCE MOTION

Use subtle staggered entrance.

Typical pattern:

```text
opacity: 0 → 1
translateY: 20px → 0
```

Use controlled easing.

Avoid aggressive bouncing.

---

# 42. SCROLL REVEALS

Sections may reveal when entering the viewport.

Keep movement subtle.

Recommended:

```text
opacity
translateY
```

Avoid excessive horizontal movement.

Do not animate every paragraph individually.

---

# 43. HOVER MOTION

Hover interactions should be subtle.

Examples:

```text
scale: 1 → 1.01
translateY: 0 → -4px
```

Image:

```text
scale: 1 → 1.04
```

Never rely on hover for essential functionality.

---

# 44. BUTTON MOTION

Buttons may have:

* hover transition
* slight scale
* press compression
* loading state

Avoid exaggerated spring animations for ordinary buttons.

---

# 45. NAVIGATION MOTION

Navbar transitions may include:

* background change
* shadow/elevation
* opacity
* blur where appropriate

Transitions must remain subtle.

---

# 46. REDUCED MOTION

Respect:

```text
prefers-reduced-motion
```

When reduced motion is requested:

* remove unnecessary transforms
* minimize transitions
* disable decorative animation
* preserve functional feedback

Accessibility takes priority over visual effects.

---

# 47. MOBILE EXPERIENCE

Mobile is the primary design target.

Prioritize:

* fast load
* touch-friendly controls
* readable text
* thumb-friendly navigation
* short forms
* simple checkout
* clear CTAs

Minimum touch target should generally be around 44px.

Do not create tiny clickable controls.

---

# 48. DESKTOP EXPERIENCE

Desktop should expand the mobile experience rather than becoming an entirely different product.

Use:

* wider layouts
* larger imagery
* multi-column grids
* stronger whitespace
* hover interactions where appropriate

Do not simply stretch mobile components across the screen.

---

# 49. ACCESSIBILITY

The frontend must support:

* semantic HTML
* keyboard navigation
* visible focus states
* sufficient color contrast
* accessible labels
* accessible form errors
* screen-reader-friendly controls
* reduced motion

Do not use color alone to communicate important states.

---

# 50. PERFORMANCE

The visual experience must not sacrifice performance.

Prioritize:

* optimized images
* lazy loading
* code splitting
* minimal client-side JavaScript where possible
* efficient animations
* avoiding unnecessary rerenders
* appropriate server/client component boundaries

Framer Motion must be used intentionally.

Do not turn every component into a client component just to animate it.

---

# 51. PWA EXPERIENCE

The interface should support a high-quality PWA experience.

Consider:

* installability
* responsive viewport
* mobile safe areas
* offline-aware UI
* appropriate loading states
* network failure states

Do not claim offline functionality unless it is actually implemented.

---

# 52. DATA INTEGRITY

Never use fake production-looking data when real API data is expected.

Do not silently substitute fake:

* vendors
* menus
* products
* orders
* ratings
* locations
* prices

When real data cannot be loaded:

* show loading
* show empty
* show error
* allow retry

The interface must accurately represent system state.

---

# 53. FRONTEND/BACKEND BOUNDARY

UI redesign must not modify backend business logic.

Preserve:

* API contracts
* authentication semantics
* role permissions
* order lifecycle
* payment flow
* loyalty logic
* DVC logic
* vendor ownership
* Socket.IO events
* database models

Do not introduce frontend assumptions that contradict backend behavior.

---

# 54. EXISTING SABIGET BUSINESS RULES

The following are immutable unless explicitly changed by the project owner:

### Guest checkout

Guest users can browse and initiate checkout without a full account.

### Loyalty

100 loyalty points = ₦50 redemption value.

### Payment

Sabiget uses prepaid ordering.

### Vendor fulfillment

Vendors manage fulfillment/delivery themselves.

### DVC

Delivery Verification Code is used to confirm delivery.

### Order lifecycle

The backend order state machine is authoritative.

### Payments

Paystack remains the payment infrastructure unless explicitly changed.

---

# 55. DESIGN IMPLEMENTATION RULES

When implementing this design system:

1. Reuse existing components where appropriate.
2. Extract repeated patterns into reusable components.
3. Avoid giant page components.
4. Keep components focused.
5. Keep business logic out of presentation components.
6. Keep API calls in appropriate service/data layers.
7. Prefer typed interfaces.
8. Avoid unnecessary dependencies.
9. Preserve existing functionality.
10. Do not rewrite working backend logic for visual reasons.

---

# 56. DO NOT FREESTYLE THE DESIGN

Do not independently introduce:

* new color systems
* unrelated fonts
* random gradients
* excessive glass effects
* arbitrary animations
* unrelated icon libraries
* giant decorative blobs
* random UI patterns
* unnecessary page layouts

If a visual decision is not covered by this document, prefer:

1. existing SabiGet design language
2. simplicity
3. consistency
4. accessibility
5. performance

When a major design decision is ambiguous, stop and ask for approval rather than inventing a new visual direction.

---

# 57. VISUAL QUALITY BAR

Before considering a frontend feature complete, verify:

### Visual

* spacing is consistent
* typography is hierarchical
* imagery is high quality
* colors are balanced
* buttons have clear hierarchy
* cards are visually consistent

### Interaction

* hover states work
* active states work
* loading states work
* error states work
* empty states work
* disabled states work
* touch interactions work

### Responsive

Test:

* 360px
* 375px
* 390px
* 412px
* tablet
* desktop
* large desktop

### Accessibility

Check:

* keyboard navigation
* focus states
* contrast
* labels
* reduced motion

### Performance

Check:

* image loading
* animation performance
* unnecessary client rendering
* unnecessary dependencies
* layout shifts

---

# 58. DEFINITION OF "PREMIUM"

A SabiGet interface is considered premium when:

* it feels intentional
* it feels fast
* it feels trustworthy
* it feels effortless
* typography is excellent
* spacing is disciplined
* imagery is compelling
* motion is subtle
* interactions feel tactile
* information hierarchy is obvious
* mobile experience is excellent
* nothing feels unnecessarily complicated

Premium does not mean:

> "Add more effects."

Premium means:

> "Remove everything unnecessary until only excellent decisions remain."

---

# 59. FINAL DESIGN PRINCIPLE

Every screen should answer:

> What does the user need to know?

> What does the user need to do?

> What is the most important action?

> What can be removed?

SabiGet should always favor clarity over decoration.

The interface should make ordering food feel almost inevitable.

---

# 60. IMPLEMENTATION AUTHORITY

This document governs SabiGet frontend visual and interaction decisions.

`AGENTS.md` governs engineering behavior and repository-wide development rules.

When implementing frontend features:

```text
AGENTS.md
    +
SABIGET_DESIGN_SYSTEM.md
    +
existing API contracts
    +
existing business logic
```

must all be respected.

Do not modify one layer merely to satisfy another.

---

# END OF SABIGET DESIGN SYSTEM

````

### After you've pasted it

**Do not tell OpenCode to implement it yet.**

First save the file.

Then run:

```powershell
git diff -- SABIGET_DESIGN_SYSTEM.md
````

and make sure it's there.

Then tell OpenCode:

```text
Read SABIGET_DESIGN_SYSTEM.md.

Do not implement anything yet.

Acknowledge that you have read it and summarize the key visual constraints you will follow.
Do not modify any files.