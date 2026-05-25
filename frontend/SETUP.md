# 🎨 Landing Page - Setup & Build Guide

## ✅ Components Built with Animations

### **1. Hero Component** (`Hero.tsx`)

- Staggered text animations on page load
- Bouncing scroll indicator
- "Continue as Guest" & "Join as Vendor" CTAs
- Gradient text effect for "Local Meals"

### **2. How It Works Section** (`HowItWorks.tsx`)

- 4-step process with animated icons
- Hover effects on step cards
- Icon scaling animations
- Mobile timeline connector

### **3. Authentication Modal** (`AuthModal.tsx`)

- 3 tabs: Guest, Member, Vendor
- Smooth tab transitions
- Guest OTP flow (2-step: phone → verify)
- Member & Vendor registration forms
- Backdrop animation

### **4. Vendor Card** (`VendorCard.tsx`)

- Image zoom on hover
- Rating stars display
- Distance & delivery time info
- Animated badge and buttons
- Smooth hover elevation

### **5. Footer** (`Footer.tsx`)

- Newsletter subscription section
- Social media links with hover animations
- Company info & links grid
- Copyright & bottom CTA

### **6. Main Page** (`page.tsx`)

- Sticky navigation with slide-down animation
- Hero → Featured Vendors → How It Works → CTA → Footer
- Sample vendor data (Buka & Flame, Pepper Pot Express, etc.)
- All sections properly integrated

---

## 🚀 Installation & Setup

### **Step 1: Install Dependencies**

```bash
cd frontend
npm install
```

This will install:

- `framer-motion` - For animations
- `lucide-react` - For icons
- `next`, `react`, `react-dom` - Core framework
- Tailwind CSS - Already configured

### **Step 2: Set Environment Variables**

Create `.env.local` in the frontend folder:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000
```

### **Step 3: Run Development Server**

```bash
npm run dev
```

The frontend will be available at: **http://localhost:3000**

### **Step 4: Build for Production**

```bash
npm run build
npm start
```

---

## 📁 Project Structure

```
frontend/
├── src/app/
│   ├── components/
│   │   ├── Hero.tsx              # Hero section with animations
│   │   ├── HowItWorks.tsx        # 4-step process
│   │   ├── AuthModal.tsx         # Sign in/up modal with OTP
│   │   ├── VendorCard.tsx        # Vendor preview card
│   │   ├── Footer.tsx            # Footer with newsletter
│   │   └── index.ts              # Component exports
│   ├── page.tsx                  # Main landing page
│   ├── layout.tsx                # Root layout & metadata
│   └── globals.css               # Tailwind CSS config
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
├── tailwind.config.js            # Tailwind configuration
└── next.config.ts                # Next.js configuration
```

---

## 🎬 Animation Features

### **Framer Motion Animations**

- ✨ **Staggered animations** - Elements appear sequentially
- 🎯 **Scroll triggers** - Animations activate on scroll with `whileInView`
- 🌊 **Hover effects** - Cards lift, icons scale, buttons grow
- 🔄 **Tab transitions** - Smooth content switching in auth modal
- 🌀 **Icon animations** - Rotating, scaling icon effects
- 📍 **Scroll detection** - One-time animations with `viewport={{ once: true }}`

### **CSS Animations (Tailwind)**

- Hover scale transforms
- Backdrop blur effects
- Gradient backgrounds
- Border transitions

---

## 🔗 Backend Integration

The frontend connects to your backend at: `http://localhost:5000/api/v1`

### **Key Endpoints Used:**

**Authentication:**

- `POST /auth/send-otp` - Send OTP for guest/member
- `POST /auth/verify-otp` - Verify OTP code
- `POST /auth/vendor/signup` - Vendor registration
- `POST /auth/vendor/login` - Vendor login

**Vendors:**

- `GET /customers/nearby-vendors` - Get nearby vendors
- `GET /customers/vendors/{id}/menu` - Get vendor menu

---

## 💡 Customization Tips

### **Change Colors**

Edit `globals.css`:

```css
--color-brand: #ff4500; /* Orange */
--color-brand-strong: #e63d00;
```

### **Modify Animations**

Edit component `variants`:

```typescript
const heroVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.8 } },
};
```

### **Update Sample Data**

Edit sample vendors in `page.tsx`:

```typescript
const sampleVendors = [
  { name: "Your Vendor", image: "url", rating: 4.8, ... }
];
```

---

## ⚠️ Current Issues & Fixes

### **Network Error When Running `npm install`**

If you see `ECONNRESET` error:

```bash
npm config set registry https://registry.npmjs.org/
npm cache clean --force
npm install
```

### **Next.js Port 3000 Already In Use**

```bash
npx next dev -p 3001
```

### **Tailwind Not Compiling**

```bash
npm run build
npm run dev
```

---

## ✅ Testing Checklist

- [ ] Run `npm run dev` - Server starts without errors
- [ ] Open http://localhost:3000 - Page loads
- [ ] Hero section animates on page load
- [ ] Click "Sign In" - Auth modal appears with animation
- [ ] Vendor cards have hover effects
- [ ] "How It Works" section animates on scroll
- [ ] Footer links are clickable
- [ ] All animations smooth at 60fps

---

## 📊 Performance Tips

1. **Lazy Loading**: Components load animations only when visible (`whileInView`)
2. **Optimize Images**: Use optimized image URLs
3. **Reduce Motion**: Respect `prefers-reduced-motion` for accessibility
4. **Bundle Size**: Framer Motion adds ~40KB to bundle

---

## 🎯 Next Steps

1. ✅ Install dependencies
2. ✅ Run dev server
3. ✅ Test landing page locally
4. ✅ Connect to backend APIs
5. ✅ Customize colors/branding
6. ✅ Deploy to production

---

**Happy building! 🚀**
