"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { MapPin, Search, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import FloatingFoodCard, { type FloatingCardData } from "./FloatingFoodCard";

const DEMO_CARDS: FloatingCardData[] = [
  {
    mealName: "Jollof Rice + Chicken",
    vendorName: "Mama J's Kitchen",
    price: "₦3,500",
    distance: "1.2 km",
    imageUrl: "https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=280&h=280&fit=crop&q=80",
    imageAlt: "Jollof rice with chicken",
  },
  {
    mealName: "Shawarma",
    vendorName: "The Shawarma Spot",
    price: "₦2,000",
    distance: "2.1 km",
    imageUrl: "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=280&h=280&fit=crop&q=80",
    imageAlt: "Shawarma wrap",
  },
  {
    mealName: "Rice Bowl",
    vendorName: "Flavour Zone",
    price: "₦2,800",
    distance: "1.8 km",
    imageUrl: "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=280&h=280&fit=crop&q=80",
    imageAlt: "Rice bowl",
  },
  {
    mealName: "Pastries",
    vendorName: "Sweet Bites",
    price: "₦1,200",
    distance: "1.5 km",
    imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=280&h=280&fit=crop&q=80",
    imageAlt: "Fresh pastries",
  },
];

const TRUST_POINTS = [
  "Secure payments",
  "Vendor-verified delivery",
  "Nearby discovery",
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const, delay: i * 0.1 },
  }),
};

export default function HeroSection() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [emptyHint, setEmptyHint] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const hintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
    };
  }, []);

  // Search and "browse everything" are different actions — an empty
  // submit is not treated as a query. Instead we focus the field and
  // give a brief visual nudge asking what the user is craving.
  const handleSearch = useCallback(() => {
    const q = searchQuery.trim();
    if (!q) {
      searchInputRef.current?.focus();
      setEmptyHint(true);
      if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
      hintTimeoutRef.current = setTimeout(() => setEmptyHint(false), 2200);
      return;
    }
    router.push(`/shop?q=${encodeURIComponent(q)}`);
  }, [searchQuery, router]);

  return (
    <section className="relative overflow-hidden bg-[#141414]">
      {/* Food imagery — right half on desktop, subtle behind text on mobile */}
      <div className="pointer-events-none absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=1400&h=900&fit=crop&q=80"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-80 lg:opacity-90"
          onError={(e) => {
            // If the hotlinked photo fails, just reveal the solid dark
            // section background instead of a broken-image icon.
            e.currentTarget.style.display = "none";
          }}
        />
        {/* Left-to-right gradient: dark on left (blends with bg), transparent on right (shows food) */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#141414] via-[#141414]/70 to-transparent lg:via-[#141414]/40" />
      </div>

      {/* Floating food cards — desktop only, clustered top-right like a curated collage */}
      <div className="pointer-events-none absolute right-0 top-0 hidden h-full w-[46%] lg:block">
        <div className="relative h-full w-full">
          {/* Card 1 — top right, largest */}
          <motion.div
            initial={{ opacity: 0, x: 30, y: -10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-10 top-[10%]"
          >
            <FloatingFoodCard data={DEMO_CARDS[0]} />
          </motion.div>

          {/* Card 2 — tucked further right, slightly smaller */}
          <motion.div
            initial={{ opacity: 0, x: 30, y: -10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.7, delay: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-[27%] scale-[0.92]"
          >
            <FloatingFoodCard data={DEMO_CARDS[1]} />
          </motion.div>

          {/* Card 3 — steps in from the left of the cluster */}
          <motion.div
            initial={{ opacity: 0, x: 30, y: -10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.7, delay: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-24 top-[44%]"
          >
            <FloatingFoodCard data={DEMO_CARDS[2]} />
          </motion.div>

          {/* Card 4 — bottom of cluster */}
          <motion.div
            initial={{ opacity: 0, x: 30, y: -10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.7, delay: 0.95, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-6 top-[60%] scale-[0.92]"
          >
            <FloatingFoodCard data={DEMO_CARDS[3]} />
          </motion.div>
        </div>
      </div>

      {/* Content — left side */}
      <div className="sabiget-shell relative z-10 flex min-h-[520px] flex-col justify-center py-16 sm:min-h-[580px] sm:py-20 lg:min-h-[640px] lg:py-24">
        <div className="max-w-xl">
          <motion.p
            custom={0}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-white/60"
          >
            <MapPin className="h-4 w-4 text-[#ff4500]" aria-hidden="true" />
            Local food marketplace
          </motion.p>

          <motion.h1
            custom={1}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.5rem]"
          >
            Wetin you dey{" "}
            <span className="text-[#ff4500]">crave?</span>
          </motion.h1>

          <motion.p
            custom={2}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="mt-5 max-w-md text-base leading-relaxed text-white/60 sm:text-lg"
          >
            Find good food from local vendors around you, explore their menus,
            and get your next craving sorted.
          </motion.p>

          {/* Search / location bar */}
          <motion.div
            custom={3}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <div
              className={`flex flex-1 items-center gap-0 rounded-full bg-white pl-4 pr-1.5 py-1.5 shadow-[0_8px_24px_-6px_rgba(0,0,0,0.3)] transition-shadow duration-300 ${
                emptyHint ? "ring-2 ring-[#ff4500]" : ""
              }`}
            >
              {/* Location — hidden on very narrow screens */}
              <div className="hidden items-center gap-2 border-r border-gray-200 pr-3 mr-1 sm:flex">
                <MapPin className="h-4 w-4 shrink-0 text-[#ff4500]" aria-hidden="true" />
                <span className="whitespace-nowrap text-sm font-medium text-[#333]">
                  Set your location
                </span>
              </div>
              {/* Search input */}
              <div className="flex flex-1 items-center gap-2 px-2">
                <Search className="h-4 w-4 shrink-0 text-[#999]" aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (emptyHint) setEmptyHint(false);
                  }}
                  placeholder={
                    emptyHint
                      ? "Tell us what you're craving…"
                      : "Search for meals, vendors, or cuisines"
                  }
                  className="w-full bg-transparent text-sm text-[#333] outline-none placeholder:text-[#999]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSearch();
                  }}
                />
              </div>
              {/* CTA */}
              <button
                type="button"
                onClick={handleSearch}
                className="shrink-0 rounded-full bg-[#ff4500] px-5 py-2.5 text-sm font-bold text-white shadow-[0_4px_12px_-2px_rgba(255,69,0,0.5)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#e63d00] active:translate-y-0"
              >
                Explore food
              </button>
            </div>
          </motion.div>

          {/* Trust strip */}
          <motion.div
            custom={4}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2"
          >
            {TRUST_POINTS.map((point) => (
              <span
                key={point}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-white/50"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-[#ff4500]/70" aria-hidden="true" />
                {point}
              </span>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Wave divider into next section */}
      <div className="absolute bottom-0 left-0 w-full" style={{ height: "6rem" }}>
        <svg
          viewBox="0 0 1440 96"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="absolute bottom-0 h-full w-full"
          preserveAspectRatio="none"
        >
          <path
            d="M0 48C240 80 480 16 720 48C960 80 1200 16 1440 48V96H0V48Z"
            fill="white"
          />
        </svg>
      </div>
    </section>
  );
}
