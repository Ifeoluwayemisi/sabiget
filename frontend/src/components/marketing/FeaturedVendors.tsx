"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { MapPin, ArrowRight, AlertTriangle, Navigation, type LucideIcon } from "lucide-react";
import { fetchNearbyVendors } from "@/lib/api/vendors";
import { type VendorCardData } from "@/features/home/data/vendors";
import VendorCard from "@/components/landing/VendorCard";
import FoodImage from "./FoodImage";

const MAX_FEATURED = 4;

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const, delay: i * 0.08 },
  }),
};

type LoadState = "loading" | "no-location" | "no-vendors" | "error" | "ready";

// Real, generic category shots — not vendor claims. Used only to keep the
// discovery section visually rich when there is no real vendor data to show.
const EXPLORE_CATEGORIES = [
  {
    slug: "rice",
    label: "Rice meals",
    image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=200&h=200&fit=crop&q=80",
  },
  {
    slug: "shawarma",
    label: "Shawarma",
    image: "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=200&h=200&fit=crop&q=80",
  },
  {
    slug: "pastries",
    label: "Pastries",
    image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=200&h=200&fit=crop&q=80",
  },
  {
    slug: "drinks",
    label: "Drinks",
    image: "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=200&h=200&fit=crop&q=80",
  },
];

interface EmptyDiscoveryStateProps {
  bannerImage: string;
  Icon: LucideIcon;
  iconTone: "brand" | "danger";
  title: string;
  description: string;
  ctaLabel: string;
  onCta: () => void;
  onExploreCategory: (slug: string) => void;
}

function EmptyDiscoveryState({
  bannerImage,
  Icon,
  iconTone,
  title,
  description,
  ctaLabel,
  onCta,
  onExploreCategory,
}: EmptyDiscoveryStateProps) {
  const iconWrap =
    iconTone === "brand"
      ? "bg-[#ff4500]/15 text-[#ff4500]"
      : "bg-red-500/15 text-red-500";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto mt-14 max-w-2xl overflow-hidden rounded-3xl border border-[var(--color-line)] bg-white shadow-[0_1px_2px_rgba(26,26,26,0.05)]"
    >
      {/* Rich editorial food imagery band — decorative, no vendor claims */}
      <div className="relative h-48 overflow-hidden sm:h-56">
        <FoodImage
          src={bannerImage}
          alt=""
          className="absolute inset-0 h-full w-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/40 to-black/20" />
        <div className={`absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full backdrop-blur-sm ${iconWrap}`}>
          <Icon className="h-7 w-7" aria-hidden="true" />
        </div>
      </div>

      <div className="px-6 py-8 text-center sm:px-10">
        <h3 className="text-xl font-bold text-[#111111]">{title}</h3>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#666666]">
          {description}
        </p>
        <button
          type="button"
          onClick={onCta}
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#ff4500] px-7 py-3.5 text-sm font-bold text-white shadow-[0_8px_24px_-6px_rgba(255,69,0,0.5)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#e63d00]"
        >
          {ctaLabel}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* Legitimate, non-fabricated content to keep discovery feeling alive: real categories, not fake vendors */}
      <div className="border-t border-[var(--color-line)] bg-[#fafaf9] px-6 py-6 sm:px-10">
        <p className="mb-4 text-center text-xs font-bold uppercase tracking-widest text-[#999999]">
          Or explore by cuisine while we look
        </p>
        <div className="flex justify-center gap-4">
          {EXPLORE_CATEGORIES.map((cat) => (
            <button
              key={cat.slug}
              type="button"
              onClick={() => onExploreCategory(cat.slug)}
              className="group flex w-16 flex-col items-center gap-2 sm:w-20"
            >
              <span className="h-14 w-14 overflow-hidden rounded-2xl ring-1 ring-black/[0.06] transition-transform duration-200 group-hover:-translate-y-1 group-hover:ring-[#ff4500]/40 sm:h-16 sm:w-16">
                <FoodImage src={cat.image} alt="" className="h-full w-full" />
              </span>
              <span className="text-center text-[11px] font-semibold text-[#444444] sm:text-xs">
                {cat.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export default function FeaturedVendors() {
  const router = useRouter();
  const [vendors, setVendors] = useState<VendorCardData[]>([]);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");

      let pos: GeolocationPosition;
      try {
        pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error("unsupported"));
            return;
          }
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: 300000,
          });
        });
      } catch {
        if (cancelled) return;
        setState("no-location");
        return;
      }

      if (cancelled) return;

      try {
        const { latitude, longitude } = pos.coords;
        const results = await fetchNearbyVendors({ latitude, longitude, radiusKm: 5 });
        if (cancelled) return;
        if (results.length === 0) {
          setState("no-vendors");
        } else {
          setVendors(results.slice(0, MAX_FEATURED));
          setState("ready");
        }
      } catch {
        if (cancelled) return;
        setState("error");
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const handleSelectVendor = (vendor: VendorCardData) => {
    router.push(`/shop?vendor=${vendor.id}`);
  };

  const goToShop = () => router.push("/shop");
  const goToCategory = (slug: string) => router.push(`/shop?category=${encodeURIComponent(slug)}`);

  return (
    <section id="vendors" className="scroll-mt-20 bg-[#fafaf9] py-20 sm:py-28">
      <div className="sabiget-shell">
        <div className="mx-auto max-w-2xl text-center">
          <p className="sabiget-badge sabiget-badge-brand mx-auto">
            Nearby discovery
          </p>
          <h2 className="mt-4 text-balance text-3xl font-extrabold tracking-tight text-[#111111] sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
            Good food is closer than you think.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-[#666666]">
            Real kitchens around you, sorted by distance — no guesswork.
          </p>
        </div>

        {/* Loading skeleton */}
        {state === "loading" && (
          <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: MAX_FEATURED }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse overflow-hidden rounded-2xl border border-[var(--color-line)] bg-white"
              >
                <div className="aspect-[4/3] bg-gray-200" />
                <div className="space-y-3 p-5">
                  <div className="h-4 w-3/4 rounded-lg bg-gray-200" />
                  <div className="h-3 w-1/2 rounded-lg bg-gray-200" />
                  <div className="h-3 w-2/3 rounded-lg bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No location — honest, no fallback, but visually rich */}
        {state === "no-location" && (
          <EmptyDiscoveryState
            bannerImage="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=900&h=500&fit=crop&q=80"
            Icon={Navigation}
            iconTone="brand"
            title="What's good around you?"
            description="Enable your location to discover food vendors near you, or browse all vendors on the shop page."
            ctaLabel="Browse all vendors"
            onCta={goToShop}
            onExploreCategory={goToCategory}
          />
        )}

        {/* No vendors in range — honest, but visually rich */}
        {state === "no-vendors" && (
          <EmptyDiscoveryState
            bannerImage="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=900&h=500&fit=crop&q=80"
            Icon={MapPin}
            iconTone="brand"
            title="No vendors nearby yet"
            description="There are no participating vendors in your area yet. Check back soon — new kitchens join regularly."
            ctaLabel="Browse all vendors"
            onCta={goToShop}
            onExploreCategory={goToCategory}
          />
        )}

        {/* API error */}
        {state === "error" && (
          <EmptyDiscoveryState
            bannerImage="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=900&h=500&fit=crop&q=80"
            Icon={AlertTriangle}
            iconTone="danger"
            title="Couldn't load vendors right now"
            description="Something went wrong. Please try again."
            ctaLabel="Browse all vendors"
            onCta={goToShop}
            onExploreCategory={goToCategory}
          />
        )}

        {/* Vendor grid */}
        {state === "ready" && vendors.length > 0 && (
          <>
            <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {vendors.map((vendor, i) => (
                <motion.div
                  key={vendor.id}
                  custom={i}
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-40px" }}
                >
                  <VendorCard vendor={vendor} onSelect={handleSelectVendor} />
                </motion.div>
              ))}
            </div>
            <div className="mt-10 text-center">
              <button
                type="button"
                onClick={goToShop}
                className="inline-flex items-center gap-2 rounded-full border border-[#ff4500]/20 bg-[#ff4500]/5 px-6 py-3 text-sm font-bold text-[#e63d00] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#ff4500]/40 hover:bg-[#ff4500]/10"
              >
                View all vendors
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
