"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Hero, HowItWorks, AuthModal, VendorCard, Footer } from "./components";

const sampleVendors = [
  {
    name: "Buka & Flame",
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=250&fit=crop",
    rating: 4.8,
    reviews: 256,
    distance: "1.2 km",
    deliveryTime: "40 mins",
    category: "Jollof",
  },
  {
    name: "Pepper Pot Express",
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=250&fit=crop",
    rating: 4.6,
    reviews: 189,
    distance: "2.4 km",
    deliveryTime: "35 mins",
    category: "Soups",
  },
  {
    name: "Morning Chop Spot",
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=250&fit=crop",
    rating: 4.9,
    reviews: 342,
    distance: "0.9 km",
    deliveryTime: "25 mins",
    category: "Breakfast",
  },
  {
    name: "Midnight Grill Cart",
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=250&fit=crop",
    rating: 4.5,
    reviews: 127,
    distance: "3.1 km",
    deliveryTime: "45 mins",
    category: "Grill",
  },
];

export default function Home() {
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  return (
    <>
      {/* Navigation */}
      <motion.nav
        className="sticky top-0 z-40 bg-white border-b border-gray-100 backdrop-blur-md bg-white/80"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <span className="text-3xl">🍽️</span>
            <span className="font-black text-2xl text-gray-900">SabiGet</span>
          </div>

          {/* CTA */}
          <motion.button
            onClick={() => setIsAuthOpen(true)}
            className="px-6 py-2 bg-gradient-to-r from-orange-500 to-amber-600 text-white font-bold rounded-lg hover:shadow-lg transition-all duration-300"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Sign In
          </motion.button>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <Hero onGetStarted={() => setIsAuthOpen(true)} />

      {/* Nearby Vendors Section */}
      <section className="py-20 px-4 bg-gray-50">
        <motion.div
          className="max-w-6xl mx-auto"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          {/* Section Header */}
          <motion.div
            className="mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Featured Vendors Near You
            </h2>
            <p className="text-xl text-gray-600">
              Browse top-rated local vendors and get your favorite meals delivered fast
            </p>
          </motion.div>

          {/* Vendor Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {sampleVendors.map((vendor, idx) => (
              <motion.div
                key={vendor.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1, duration: 0.5 }}
              >
                <VendorCard {...vendor} />
              </motion.div>
            ))}
          </div>

          {/* CTA */}
          <motion.div
            className="mt-12 text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <motion.button
              onClick={() => setIsAuthOpen(true)}
              className="px-8 py-4 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 transform hover:scale-105 transition-all duration-300"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Browse All Vendors →
            </motion.button>
          </motion.div>
        </motion.div>
      </section>

      {/* How It Works Section */}
      <HowItWorks />

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-orange-500 to-amber-600 relative overflow-hidden">
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.h2
            className="text-4xl md:text-5xl font-bold text-white mb-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Ready to Order?
          </motion.h2>
          <motion.p
            className="text-xl text-white/90 mb-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Sign in with just your phone number. No password needed. 
            Browse vendors, order securely, and verify every delivery.
          </motion.p>
          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <motion.button
              onClick={() => setIsAuthOpen(true)}
              className="px-8 py-4 bg-white text-orange-600 font-bold rounded-lg hover:bg-gray-100 transform hover:scale-105 transition-all duration-300 text-lg"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              🚀 Get Started
            </motion.button>
            <motion.button
              className="px-8 py-4 bg-white/20 text-white font-bold border-2 border-white rounded-lg hover:bg-white/30 transform hover:scale-105 transition-all duration-300 text-lg backdrop-blur-sm"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Learn More
            </motion.button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <Footer />

      {/* Auth Modal */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </>
  );
}
            animation: blob 7s infinite;
          }

          .animation-delay-2000 {
            animation-delay: 2s;
          }
        `}</style>
      </section>

      {/* Footer */}
      <Footer />

      {/* Auth Modal */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </>
  );
}
  {
    id: "demo-2",
    name: "Pepper Pot Express",
    estimatedDeliveryMinutes: 35,
    distanceKm: "2.4",
    tags: ["Soups", "Rice", "Asun"],
    ratingLabel: "4.8 stars",
    statusLabel: "Busy",
  },
  {
    id: "demo-3",
    name: "Morning Chop Spot",
    estimatedDeliveryMinutes: 25,
    distanceKm: "0.9",
    tags: ["Akara", "Pap", "Coffee"],
    ratingLabel: "Fastest nearby",
    statusLabel: "Open now",
  },
  {
    id: "demo-4",
    name: "Midnight Grill Cart",
    estimatedDeliveryMinutes: 45,
    distanceKm: "3.1",
    tags: ["Grill", "Sharwama", "Drinks"],
    ratingLabel: "Late-night favorite",
    statusLabel: "Closed",
    isClosed: true,
  },
];

const footerGroups = [
  {
    title: "Product",
    links: ["How it works", "Nearby vendors", "Install Sabiget", "Track orders"],
  },
  {
    title: "Company",
    links: ["About Sabiget", "Trust & safety", "Vendor signup", "Contact"],
  },
  {
    title: "Support",
    links: ["Help center", "Delivery issues", "Refund policy", "Privacy"],
  },
];

const neighborhoodPresets = {
  ikeja: {
    label: "Ikeja, Lagos",
    latitude: 6.6018,
    longitude: 3.3515,
  },
  yaba: {
    label: "Yaba, Lagos",
    latitude: 6.5095,
    longitude: 3.3711,
  },
  lekki: {
    label: "Lekki, Lagos",
    latitude: 6.4478,
    longitude: 3.4723,
  },
  surulere: {
    label: "Surulere, Lagos",
    latitude: 6.5004,
    longitude: 3.3581,
  },
} as const;

function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
}

function inferNeighborhoodName(latitude: number, longitude: number) {
  if (latitude >= 6.56 && latitude <= 6.64 && longitude >= 3.3 && longitude <= 3.39) {
    return "Ikeja, Lagos";
  }

  if (latitude >= 6.48 && latitude <= 6.54 && longitude >= 3.34 && longitude <= 3.39) {
    return "Yaba, Lagos";
  }

  if (latitude >= 6.43 && latitude <= 6.49 && longitude >= 3.45 && longitude <= 3.53) {
    return "Lekki, Lagos";
  }

  if (latitude >= 6.47 && latitude <= 6.53 && longitude >= 3.33 && longitude <= 3.4) {
    return "Surulere, Lagos";
  }

  return "your area";
}

function inferTagsFromName(name: string) {
  const normalized = name.toLowerCase();

  if (normalized.includes("buka") || normalized.includes("rice")) {
    return ["Jollof", "Swallow", "Rice"];
  }

  if (normalized.includes("pot") || normalized.includes("soup")) {
    return ["Soups", "Pepper soup", "Asun"];
  }

  if (normalized.includes("morning") || normalized.includes("breakfast")) {
    return ["Akara", "Pap", "Breakfast"];
  }

  return ["Local meals", "Fresh food", "Fast delivery"];
}

function HeaderLogo() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-brand text-lg font-black text-white shadow-[var(--shadow-floating)]">
        S
      </div>
      <div>
        <p className="text-lg font-black tracking-[-0.04em] text-ink">Sabiget</p>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-muted">
          Fast local meals
        </p>
      </div>
    </div>
  );
}

function NearbySkeletonCard() {
  return (
    <div className="sabiget-card overflow-hidden p-4">
      <div className="mb-4 h-40 animate-pulse rounded-[24px] bg-surface-muted" />
      <div className="mb-3 h-4 w-1/2 animate-pulse rounded-full bg-surface-muted" />
      <div className="mb-4 h-3 w-2/3 animate-pulse rounded-full bg-surface-muted" />
      <div className="flex gap-2">
        <div className="h-8 w-20 animate-pulse rounded-full bg-surface-muted" />
        <div className="h-8 w-16 animate-pulse rounded-full bg-surface-muted" />
      </div>
    </div>
  );
}

export default function Home() {
  const [locationState, setLocationState] = useState<LocationState>("permission");
  const [installDismissed, setInstallDismissed] = useState(false);
  const [locationLabel, setLocationLabel] = useState("Choose location");
  const [addressInput, setAddressInput] = useState("");
  const [vendors, setVendors] = useState<VendorCard[]>([]);
  const [statusMessage, setStatusMessage] = useState(
    "Discover nearby food spots, pay securely, and confirm every handoff with Sabiget's delivery verification code.",
  );
  const [waitlistValue, setWaitlistValue] = useState("");
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<VendorCard | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isInstallGuideOpen, setIsInstallGuideOpen] = useState(false);
  const [isLocationSheetOpen, setIsLocationSheetOpen] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");

  const headline = useMemo(() => {
    if (locationState === "detected") {
      return `Top vendors in ${locationLabel}`;
    }

    if (locationState === "empty") {
      return `We are getting Sabiget ready for ${locationLabel}`;
    }

    if (locationState === "loading") {
      return "Finding trusted vendors near you";
    }

    if (locationState === "error") {
      return "We could not confirm your location just yet";
    }

    return "Your favorite local meals, delivered fast.";
  }, [locationLabel, locationState]);

  const subcopy = useMemo(() => {
    if (locationState === "detected") {
      return "Trusted local kitchens, secure payments, and verified handoffs all in one lightweight app experience.";
    }

    if (locationState === "empty") {
      return "No empty dead-end here. Join the waitlist and we will let you know the moment verified vendors go live in your neighborhood.";
    }

    if (locationState === "loading") {
      return "Hold on while we match your current area to nearby verified kitchens and delivery-ready vendors.";
    }

    if (locationState === "error") {
      return "You can retry location access or type a neighborhood like Ikeja, Yaba, Surulere, or Lekki to continue.";
    }

    return "Discover nearby food spots, pay securely, and confirm every handoff with Sabiget's delivery verification code.";
  }, [locationState]);

  useEffect(() => {
    setStatusMessage(subcopy);
  }, [subcopy]);

  async function fetchNearbyVendors(
    latitude: number,
    longitude: number,
    label = inferNeighborhoodName(latitude, longitude),
  ) {
    setLocationState("loading");
    setStatusMessage("Checking nearby vendors and calculating fast delivery windows...");

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/api/v1/vendors/nearby?lat=${latitude}&lng=${longitude}&radius=5`,
        {
          cache: "no-store",
        },
      );

      if (!response.ok) {
        throw new Error("Unable to fetch nearby vendors");
      }

      const payload = await response.json();
      const mappedVendors: VendorCard[] = (payload.vendors || []).map((vendor: VendorCard) => ({
        ...vendor,
        tags: vendor.tags?.length ? vendor.tags : inferTagsFromName(vendor.name),
        isClosed: vendor.isClosed || false,
        ratingLabel:
          vendor.averageRating !== undefined
            ? `${Number(vendor.averageRating).toFixed(1)} stars`
            : "Top Rated",
        statusLabel:
          vendor.totalReviews !== undefined
            ? `${vendor.totalReviews} reviews`
            : "Open now",
      }));

      setLocationLabel(label);
      setVendors(mappedVendors);
      setAddressInput(label);

      if (mappedVendors.length === 0) {
        setLocationState("empty");
        setStatusMessage(`No vendors are within 5km of ${label} yet.`);
        return;
      }

      setLocationState("detected");
      setStatusMessage(`${mappedVendors.length} verified vendor${mappedVendors.length === 1 ? "" : "s"} found near ${label}.`);
    } catch (error) {
      console.error(error);
      setLocationState("error");
      setStatusMessage("We hit a snag fetching vendors. Try location access again or search manually.");
    }
  }

  function requestCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationState("error");
      setStatusMessage("Your browser does not support geolocation. Try entering an area manually.");
      return;
    }

    setLocationState("loading");
    setStatusMessage("Requesting your location...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const inferredLabel = inferNeighborhoodName(latitude, longitude);
        void fetchNearbyVendors(latitude, longitude, inferredLabel);
      },
      () => {
        setLocationState("error");
        setStatusMessage("Location access was denied. Try again or search a neighborhood manually.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      },
    );
  }

  function handleManualSearch() {
    const normalized = addressInput.trim().toLowerCase();
    if (!normalized) {
      setLocationState("error");
      setStatusMessage("Enter a neighborhood such as Ikeja, Yaba, Surulere, or Lekki.");
      return;
    }

    const preset = Object.entries(neighborhoodPresets).find(([key]) =>
      normalized.includes(key),
    )?.[1];

    if (!preset) {
      setLocationLabel(addressInput.trim());
      setVendors([]);
      setLocationState("empty");
      setStatusMessage(`We have not launched in ${addressInput.trim()} yet, but we can notify you.`);
      return;
    }

    void fetchNearbyVendors(preset.latitude, preset.longitude, preset.label);
  }

  function handleWaitlistSubmit() {
    if (!waitlistValue.trim()) {
      return;
    }

    setWaitlistSubmitted(true);
  }

  function choosePresetLocation(preset: (typeof neighborhoodPresets)[keyof typeof neighborhoodPresets]) {
    setAddressInput(preset.label);
    setLocationLabel(preset.label);
    setIsLocationSheetOpen(false);
    void fetchNearbyVendors(preset.latitude, preset.longitude, preset.label);
  }

  const activeVendorCards = locationState === "detected" ? vendors : nearbyCards;

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip pb-28 md:pb-0">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[38rem] bg-[radial-gradient(circle_at_top,rgba(255,106,0,0.18),transparent_58%)]" />

      <header className="sticky top-0 z-30 border-b border-line bg-[rgba(255,247,241,0.9)] backdrop-blur-xl md:hidden">
        <div className="sabiget-shell flex flex-col gap-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <HeaderLogo />
            <div className="flex items-center gap-2">
              <button
                className="touch-target sabiget-outline relative flex items-center justify-center rounded-full px-3 text-sm font-semibold text-ink"
                onClick={() => setIsCartOpen(true)}
              >
                Cart
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
                  2
                </span>
              </button>
              <button
                className="touch-target sabiget-punch rounded-full px-4 text-sm font-semibold"
                onClick={() => setIsAuthOpen(true)}
              >
                Login / Join
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="touch-target sabiget-outline inline-flex min-w-[160px] items-center justify-center rounded-full px-4 text-sm font-semibold"
              onClick={() => setIsLocationSheetOpen(true)}
            >
              📍 {locationLabel}
            </button>
            <button
              className="touch-target rounded-full border border-line bg-white px-4 text-sm font-semibold text-ink"
              onClick={requestCurrentLocation}
            >
              Use location
            </button>
          </div>
        </div>
      </header>

      <header className="sticky top-0 z-30 hidden border-b border-line bg-[rgba(255,247,241,0.82)] backdrop-blur-xl md:block">
        <div className="sabiget-shell flex h-24 items-center gap-6">
          <HeaderLogo />
          <button
            className="touch-target sabiget-outline flex min-w-[180px] items-center justify-center rounded-full px-4 text-sm font-semibold"
            onClick={() => setIsLocationSheetOpen(true)}
          >
            📍 {locationLabel}
          </button>
          <div className="sabiget-outline flex flex-1 items-center gap-3 rounded-full px-5 py-3">
            <span className="text-ink-muted">⌕</span>
            <input
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
              placeholder="Search meals, vendors, or categories"
              value={addressInput}
              onChange={(event) => setAddressInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleManualSearch();
                }
              }}
            />
          </div>
          <button
            className="touch-target sabiget-outline relative flex items-center justify-center rounded-full px-4 text-sm font-semibold"
            onClick={() => setIsCartOpen(true)}
          >
            Cart
            <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold text-white">
              2
            </span>
          </button>
          <button
            className="touch-target sabiget-punch rounded-full px-5 text-sm font-semibold"
            onClick={() => setIsAuthOpen(true)}
          >
            Login / Join
          </button>
        </div>
      </header>

      <main className="flex-1">
        <section className="sabiget-shell pt-6 sm:pt-8 md:pt-10">
          <div className="sabiget-panel sabiget-noise overflow-hidden px-5 py-5 sm:px-7 sm:py-7 md:px-10 md:py-10">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <span className="sabiget-badge sabiget-badge-brand">
                <span className="h-2.5 w-2.5 rounded-full bg-brand" />
                PWA-first food delivery
              </span>
              <span className="sabiget-badge sabiget-badge-accent">
                <span className="h-2.5 w-2.5 rounded-full bg-accent" />
                1,240 meals delivered safely this week
              </span>
            </div>

            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <h1 className="text-balance max-w-3xl text-4xl font-black leading-[0.95] tracking-[-0.06em] text-ink sm:text-5xl md:text-6xl">
                  {headline}
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-ink-muted sm:text-lg">
                  {subcopy}
                </p>
                <p className="mt-3 text-sm font-medium text-brand-deep">{statusMessage}</p>

                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <button
                    className="touch-target sabiget-punch rounded-full px-6 py-3.5 text-sm font-semibold sm:text-base"
                    onClick={requestCurrentLocation}
                  >
                    {locationState === "permission" || locationState === "error"
                      ? "Find Food Near Me"
                      : locationState === "loading"
                        ? "Finding nearby vendors..."
                        : "Start Ordering"}
                  </button>
                  <button
                    className="touch-target sabiget-outline rounded-full px-6 py-3.5 text-sm font-semibold sm:text-base"
                    onClick={() => setIsAuthOpen(true)}
                  >
                    Login to save address
                  </button>
                </div>

                <div className="mt-7 sabiget-card max-w-2xl p-3 sm:p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="sabiget-outline flex flex-1 items-center gap-3 rounded-full px-4 py-3">
                      <span className="text-ink-muted">⌕</span>
                      <input
                        className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
                        placeholder="Enter your delivery address"
                        value={addressInput}
                        onChange={(event) => setAddressInput(event.target.value)}
                      />
                    </div>
                    <button
                      className="touch-target rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white"
                      onClick={handleManualSearch}
                    >
                      Search nearby
                    </button>
                  </div>
                </div>

                {locationState === "empty" ? (
                  <div className="mt-6 sabiget-card max-w-2xl p-5">
                    <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-deep">
                      Coming soon
                    </p>
                    <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-ink">
                      We are not in Yaba yet.
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-ink-muted">
                      Drop your phone or email and we will notify you as soon as trusted vendors launch near you.
                    </p>
                    {waitlistSubmitted ? (
                      <div className="mt-4 rounded-[20px] bg-accent-soft px-4 py-4 text-sm font-medium text-accent">
                        We’ve saved your interest for {locationLabel}. We’ll notify you when Sabiget launches there.
                      </div>
                    ) : (
                      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                        <input
                          className="touch-target flex-1 rounded-full border border-line bg-white px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-muted"
                          placeholder="Phone number or email"
                          value={waitlistValue}
                          onChange={(event) => setWaitlistValue(event.target.value)}
                        />
                        <button
                          className="touch-target sabiget-punch rounded-full px-5 py-3 text-sm font-semibold"
                          onClick={handleWaitlistSubmit}
                        >
                          Notify me
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="relative">
                <div className="absolute -inset-3 rounded-[40px] bg-[linear-gradient(135deg,rgba(255,69,0,0.12),rgba(46,125,50,0.08))] blur-2xl" />
                <div className="sabiget-card relative overflow-hidden p-4 sm:p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-deep">
                        Today on Sabiget
                      </p>
                      <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-ink">
                        Reliable delivery, local flavor
                      </h2>
                    </div>
                    <span className="sabiget-badge sabiget-badge-accent">DVC protected</span>
                  </div>
                  <div className="overflow-hidden rounded-[28px] bg-surface-muted">
                    <Image
                      src="/hero-food-scene.svg"
                      alt="Sabiget hero illustration showing food delivery, local meals, and verified handoff"
                      width={900}
                      height={860}
                      className="h-auto w-full"
                      priority
                    />
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[22px] bg-brand-soft p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-deep">
                        Secure checkout
                      </p>
                      <p className="mt-2 text-sm leading-6 text-ink">
                        Paystack-powered payments with fast confirmations and fewer drop-offs.
                      </p>
                    </div>
                    <div className="rounded-[22px] bg-accent-soft p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
                        Safer handoff
                      </p>
                      <p className="mt-2 text-sm leading-6 text-ink">
                        Every completed order needs the final delivery code before it closes.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="sabiget-shell pt-6 sm:pt-8">
          <div className="grid gap-4 md:grid-cols-3">
            {trustSteps.map((step) => (
              <article key={step.title} className="sabiget-card p-5 sm:p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand text-sm font-black text-white">
                  {step.icon}
                </div>
                <h3 className="mt-4 text-2xl font-black tracking-[-0.04em] text-ink">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-ink-muted">{step.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="sabiget-shell pt-8 sm:pt-10">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-deep">
                Nearby now
              </p>
              <h2 className="mt-1 text-3xl font-black tracking-[-0.05em] text-ink">
                Browse what is around you
              </h2>
            </div>
            <button className="hidden rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink md:inline-flex">
              {activeVendorCards.length} vendors nearby
            </button>
            <button
              className="hidden rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink md:inline-flex"
              onClick={() => {
                const firstVendor = activeVendorCards[0];
                if (firstVendor) {
                  setSelectedVendor(firstVendor);
                }
              }}
            >
              View all vendors
            </button>
          </div>

          {locationState === "permission" || locationState === "loading" ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <NearbySkeletonCard key={index} />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {activeVendorCards.map((vendor) => (
                <article
                  key={vendor.id}
                  className="sabiget-card overflow-hidden transition-transform duration-200 hover:-translate-y-1"
                >
                  <div className="sabiget-grid-glow relative h-44 bg-[linear-gradient(135deg,#fff3eb_0%,#ffe0cf_100%)] p-4">
                    <div className="absolute right-4 top-4 rounded-full bg-[rgba(255,255,255,0.85)] px-3 py-1 text-xs font-semibold text-ink">
                      {vendor.ratingLabel ||
                        `${Number(vendor.averageRating || 4.8).toFixed(1)} stars`}
                    </div>
                    {(vendor.isClosed || vendor.statusLabel === "Closed") ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-[rgba(26,26,26,0.52)] text-sm font-semibold text-white backdrop-blur-[2px]">
                        Closed right now
                      </div>
                    ) : null}
                    <div className="absolute bottom-4 left-4 rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-deep">
                      {vendor.statusLabel || `${vendor.totalReviews || 0} reviews`}
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-xl font-black tracking-[-0.04em] text-ink">
                        {vendor.name}
                      </h3>
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
                        {vendor.distanceKm} km away
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-brand-deep">
                      {`${Math.max((vendor.estimatedDeliveryMinutes || 30) - 10, 15)}-${vendor.estimatedDeliveryMinutes || 30} mins`}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {(vendor.tags || []).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-ink"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="mt-5 flex gap-2">
                      <button
                        className="touch-target sabiget-punch flex-1 rounded-full px-4 text-sm font-semibold"
                        onClick={() => setSelectedVendor(vendor)}
                      >
                        Preview vendor
                      </button>
                      <button
                        className="touch-target rounded-full border border-line px-4 text-sm font-semibold text-ink"
                        onClick={() => setIsAuthOpen(true)}
                      >
                        Order
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="sabiget-shell pt-8 sm:pt-10">
          <div className="sabiget-panel overflow-hidden px-5 py-6 sm:px-7 md:px-8">
            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-deep">
                  Add to home screen
                </p>
                <h2 className="mt-2 text-3xl font-black tracking-[-0.05em] text-ink">
                  Install Sabiget like a regular app.
                </h2>
                <p className="mt-3 text-sm leading-7 text-ink-muted sm:text-base">
                  No app store wait. No heavy download. Just faster access, lower data use, and a cleaner ordering flow on your home screen.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="sabiget-badge sabiget-badge-brand">Uses less data</span>
                  <span className="sabiget-badge sabiget-badge-accent">Works offline-first</span>
                  <span className="sabiget-badge sabiget-badge-brand">Faster relaunch</span>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["1", "Tap Share", "Open the browser menu or share action from your device."],
                  ["2", "Add to Home Screen", "Choose the install option so Sabiget sits with your everyday apps."],
                  ["3", "Launch instantly", "Open Sabiget in one tap and get straight to nearby vendors."],
                ].map(([step, title, text]) => (
                  <div key={step} className="sabiget-card p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ink text-sm font-black text-white">
                      {step}
                    </div>
                    <h3 className="mt-4 text-lg font-black tracking-[-0.04em] text-ink">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-ink-muted">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="sabiget-shell pb-32 pt-8 md:pb-10 md:pt-10">
        <div className="sabiget-card overflow-hidden px-5 py-6 sm:px-7 md:px-8">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <HeaderLogo />
              <p className="mt-4 max-w-xl text-sm leading-7 text-ink-muted sm:text-base">
                Sabiget is building a lighter, safer way to order your favorite local meals.
                Secure payments, trusted nearby vendors, and delivery verification all work
                together to make food delivery feel dependable again.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="sabiget-badge sabiget-badge-brand">Paystack secure</span>
                <span className="sabiget-badge sabiget-badge-accent">DVC protected</span>
                <span className="sabiget-badge sabiget-badge-brand">Built for mobile</span>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-3">
              {footerGroups.map((group) => (
                <div key={group.title}>
                  <h3 className="text-sm font-black uppercase tracking-[0.14em] text-ink">
                    {group.title}
                  </h3>
                  <ul className="mt-4 space-y-3">
                    {group.links.map((link) => (
                      <li key={link}>
                        <a
                          href="#"
                          className="text-sm font-medium text-ink-muted hover:text-brand"
                        >
                          {link}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-4 border-t border-line pt-5 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 Sabiget. Local meals, delivered fast.</p>
            <div className="flex flex-wrap gap-3">
              <span>Ikeja, Lagos</span>
              <span>•</span>
              <span>No app store download</span>
              <span>•</span>
              <span>Uses less data</span>
            </div>
          </div>
        </div>
      </footer>

      {!installDismissed ? (
        <div className="fixed inset-x-3 bottom-20 z-40 md:bottom-6 md:left-auto md:right-6 md:max-w-sm">
          <div className="sabiget-card border-brand/10 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand text-white shadow-[var(--shadow-floating)]">
                +
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black tracking-[-0.03em] text-ink">
                  Install Sabiget for a faster experience
                </p>
                <p className="mt-1 text-sm leading-6 text-ink-muted">
                  Add Sabiget to your home screen for quicker reorders and lower data usage.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    className="touch-target sabiget-punch rounded-full px-4 text-sm font-semibold"
                    onClick={() => setIsInstallGuideOpen(true)}
                  >
                    Show how
                  </button>
                  <button
                    className="touch-target rounded-full border border-line px-4 text-sm font-semibold text-ink"
                    onClick={() => setInstallDismissed(true)}
                  >
                    Maybe later
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-[rgba(255,247,241,0.9)] backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-4 px-2 py-2">
          {mobileNavItems.map((item) => (
            <button
              key={item.label}
              className="touch-target relative flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-semibold text-ink-muted"
            >
              <span className="text-lg leading-none text-ink">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge ? (
                <span className="absolute right-5 top-2 h-2.5 w-2.5 rounded-full bg-brand" />
              ) : null}
            </button>
          ))}
        </div>
      </nav>

      {(isAuthOpen || isCartOpen || isInstallGuideOpen || isLocationSheetOpen || selectedVendor) && (
        <div
          className="fixed inset-0 z-40 bg-[rgba(26,26,26,0.38)] backdrop-blur-[2px]"
          onClick={() => {
            setIsAuthOpen(false);
            setIsCartOpen(false);
            setIsInstallGuideOpen(false);
            setIsLocationSheetOpen(false);
            setSelectedVendor(null);
          }}
        />
      )}

      {isAuthOpen && (
        <div className="fixed inset-x-3 top-24 z-50 mx-auto w-full max-w-md">
          <div className="sabiget-card p-5 sm:p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-deep">
                  Join Sabiget
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-[-0.05em] text-ink">
                  Start with WhatsApp OTP
                </h2>
              </div>
              <button
                className="touch-target rounded-full border border-line px-3 text-sm font-semibold text-ink"
                onClick={() => setIsAuthOpen(false)}
              >
                Close
              </button>
            </div>
            <p className="mt-3 text-sm leading-6 text-ink-muted">
              Use your phone number to sign in quickly, save addresses, track orders, and unlock loyalty rewards.
            </p>
            <div className="mt-5 flex flex-col gap-3">
              <input
                className="touch-target rounded-full border border-line bg-white px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-muted"
                placeholder="+234 812 345 6789"
                value={phoneInput}
                onChange={(event) => setPhoneInput(event.target.value)}
              />
              <button className="touch-target sabiget-punch rounded-full px-5 py-3 text-sm font-semibold">
                Continue with OTP
              </button>
            </div>
          </div>
        </div>
      )}

      {isCartOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md">
          <div
            className="ml-auto flex h-full w-full flex-col bg-white shadow-[0_0_40px_rgba(26,26,26,0.18)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-deep">
                  Cart summary
                </p>
                <h2 className="text-2xl font-black tracking-[-0.05em] text-ink">2 items ready</h2>
              </div>
              <button
                className="touch-target rounded-full border border-line px-3 text-sm font-semibold text-ink"
                onClick={() => setIsCartOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="flex-1 space-y-4 px-5 py-5">
              {[
                { name: "Smoky Jollof Bowl", meta: "Buka & Flame", price: "₦3,500" },
                { name: "Chapman", meta: "Pepper Pot Express", price: "₦1,200" },
              ].map((item) => (
                <div key={item.name} className="sabiget-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black tracking-[-0.03em] text-ink">{item.name}</h3>
                      <p className="mt-1 text-sm text-ink-muted">{item.meta}</p>
                    </div>
                    <span className="text-sm font-semibold text-brand-deep">{item.price}</span>
                  </div>
                </div>
              ))}
              <div className="rounded-[24px] bg-brand-soft p-4">
                <p className="text-sm font-semibold text-brand-deep">
                  Log in to save this cart and apply loyalty discounts at checkout.
                </p>
              </div>
            </div>
            <div className="border-t border-line px-5 py-4">
              <div className="mb-4 flex items-center justify-between text-sm text-ink-muted">
                <span>Estimated total</span>
                <span className="text-base font-black text-ink">₦4,700</span>
              </div>
              <div className="flex gap-2">
                <button
                  className="touch-target rounded-full border border-line px-4 text-sm font-semibold text-ink"
                  onClick={() => setIsCartOpen(false)}
                >
                  Keep browsing
                </button>
                <button
                  className="touch-target sabiget-punch flex-1 rounded-full px-4 text-sm font-semibold"
                  onClick={() => {
                    setIsCartOpen(false);
                    setIsAuthOpen(true);
                  }}
                >
                  Login to checkout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedVendor && (
        <div className="fixed inset-x-3 bottom-24 z-50 mx-auto w-full max-w-2xl md:bottom-10">
          <div className="sabiget-card p-5 sm:p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-deep">
                  Vendor preview
                </p>
                <h2 className="mt-1 text-3xl font-black tracking-[-0.05em] text-ink">
                  {selectedVendor.name}
                </h2>
              </div>
              <button
                className="touch-target rounded-full border border-line px-3 text-sm font-semibold text-ink"
                onClick={() => setSelectedVendor(null)}
              >
                Close
              </button>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[22px] bg-surface-muted p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
                  Delivery
                </p>
                <p className="mt-2 text-lg font-black text-ink">
                  {`${Math.max((selectedVendor.estimatedDeliveryMinutes || 30) - 10, 15)}-${selectedVendor.estimatedDeliveryMinutes || 30} mins`}
                </p>
              </div>
              <div className="rounded-[22px] bg-surface-muted p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
                  Distance
                </p>
                <p className="mt-2 text-lg font-black text-ink">{selectedVendor.distanceKm} km away</p>
              </div>
              <div className="rounded-[22px] bg-surface-muted p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
                  Rating
                </p>
                <p className="mt-2 text-lg font-black text-ink">
                  {selectedVendor.ratingLabel || `${Number(selectedVendor.averageRating || 4.8).toFixed(1)} stars`}
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {(selectedVendor.tags || []).map((tag) => (
                <span key={tag} className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-deep">
                  {tag}
                </span>
              ))}
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                { name: "Chef's Jollof Box", price: "₦3,200" },
                { name: "Peppered Chicken", price: "₦2,800" },
                { name: "Chapman", price: "₦1,100" },
              ].map((item) => (
                <div key={item.name} className="rounded-[24px] border border-line bg-white p-4">
                  <p className="text-sm font-black text-ink">{item.name}</p>
                  <p className="mt-1 text-sm text-brand-deep">{item.price}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 flex gap-2">
              <button
                className="touch-target rounded-full border border-line px-4 text-sm font-semibold text-ink"
                onClick={() => setSelectedVendor(null)}
              >
                Keep browsing
              </button>
              <button
                className="touch-target sabiget-punch flex-1 rounded-full px-4 text-sm font-semibold"
                onClick={() => {
                  setSelectedVendor(null);
                  setIsAuthOpen(true);
                }}
              >
                Login to order from this vendor
              </button>
            </div>
          </div>
        </div>
      )}

      {isLocationSheetOpen && (
        <div className="fixed inset-x-3 top-24 z-50 mx-auto w-full max-w-lg">
          <div className="sabiget-card p-5 sm:p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-deep">
                  Change delivery area
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-[-0.05em] text-ink">
                  Pick a nearby neighborhood
                </h2>
              </div>
              <button
                className="touch-target rounded-full border border-line px-3 text-sm font-semibold text-ink"
                onClick={() => setIsLocationSheetOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {Object.values(neighborhoodPresets).map((preset) => (
                <button
                  key={preset.label}
                  className="touch-target rounded-[24px] border border-line bg-white px-4 py-4 text-left"
                  onClick={() => choosePresetLocation(preset)}
                >
                  <p className="text-base font-black text-ink">{preset.label}</p>
                  <p className="mt-1 text-sm text-ink-muted">Check vendors within 5km</p>
                </button>
              ))}
            </div>
            <button
              className="mt-4 touch-target sabiget-outline w-full rounded-full px-4 text-sm font-semibold"
              onClick={requestCurrentLocation}
            >
              Use my current location instead
            </button>
          </div>
        </div>
      )}

      {isInstallGuideOpen && (
        <div className="fixed inset-x-3 top-24 z-50 mx-auto w-full max-w-xl">
          <div className="sabiget-card p-5 sm:p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-deep">
                  Install guide
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-[-0.05em] text-ink">
                  Add Sabiget to your home screen
                </h2>
              </div>
              <button
                className="touch-target rounded-full border border-line px-3 text-sm font-semibold text-ink"
                onClick={() => setIsInstallGuideOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="mt-5 space-y-3">
              {[
                "Open the browser share or menu icon.",
                "Tap Add to Home Screen or Install App.",
                "Launch Sabiget instantly next time without an app store download.",
              ].map((step, index) => (
                <div key={step} className="flex items-start gap-3 rounded-[22px] bg-surface-muted p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-brand text-sm font-black text-white">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-6 text-ink">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
