"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { motion, MotionConfig } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Loader2,
  MapPin,
  RotateCcw,
  Search,
} from "lucide-react";
import Link from "next/link";

import Hero, { type LocationStatus } from "@/components/landing/Hero";
import HowItWorks from "@/components/landing/HowItWorks";
import TrustSection from "@/components/home/TrustSection";
import VendorCTA from "@/components/home/VendorCTA";
import FinalCTA from "@/components/home/FinalCTA";
import AuthModal from "@/components/auth/AuthModal";
import VendorCard from "@/components/landing/VendorCard";
import Footer from "@/components/layout/Footer";
import MenuModal from "@/components/cart/MenuModal";
import OrderStatusCard from "@/components/order/OrderStatusCard";
import {
  fetchNearbyVendors,
  NearbyVendorsError,
} from "@/lib/api/vendors";
import {
  getAccessToken,
  logout as logoutSession,
  subscribeToAuth,
} from "@/lib/api/client";
import { closeSocket } from "@/lib/socket";
import { getLatestOrderId, subscribeToLatestOrder } from "@/lib/orderTracker";
import type { VendorCardData } from "@/features/home/data/vendors";

const DISCOVERY_RADIUS_KM = 5;

const geoOptions: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 60000,
};

const cardStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const cardItem = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
  },
};

function SkeletonCard() {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-white"
      aria-hidden="true"
    >
      <div className="aspect-[4/3] animate-pulse bg-[#f4efeb]" />
      <div className="space-y-3 p-5">
        <div className="h-5 w-3/4 animate-pulse rounded-full bg-[#f4efeb]" />
        <div className="h-4 w-1/2 animate-pulse rounded-full bg-[#f7f3f0]" />
        <div className="h-4 w-2/3 animate-pulse rounded-full bg-[#f7f3f0]" />
      </div>
    </div>
  );
}

export default function HomePage() {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  // Session presence reacts to login/logout in this tab via the API client's
  // auth pub/sub (the storage event only fires across tabs).
  const signedIn = useSyncExternalStore(
    subscribeToAuth,
    () => Boolean(getAccessToken()),
    () => false,
  );
  const [selectedVendor, setSelectedVendor] = useState<{
    id: string | null;
    name: string;
  } | null>(null);
  const [liveOrderId, setLiveOrderId] = useState<string | null>(() =>
    // Safe during SSR: getLatestOrderId returns null without a window.
    getLatestOrderId(),
  );

  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [vendors, setVendors] = useState<VendorCardData[] | null>(null);
  const [vendorsError, setVendorsError] = useState<string | null>(null);
  const [fetchNonce, setFetchNonce] = useState(0);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArea, setSelectedArea] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const resetDiscoveryFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedArea(null);
  }, []);

  useEffect(() => {
    // setLatestOrder notifies this tab directly, so the live-order section
    // appears as soon as checkout succeeds (the storage event alone only
    // fires across tabs).
    return subscribeToLatestOrder(() => {
      setLiveOrderId(getLatestOrderId());
    });
  }, []);

  useEffect(() => {
    if (!coords) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    fetchNearbyVendors({
      latitude: coords.latitude,
      longitude: coords.longitude,
      radiusKm: DISCOVERY_RADIUS_KM,
      signal: controller.signal,
    })
      .then((mapped) => {
        setVendors(mapped);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setVendorsError(
          error instanceof NearbyVendorsError
            ? error.message
            : "We couldn't load nearby vendors right now.",
        );
      });

    return () => {
      controller.abort();
    };
  }, [coords, fetchNonce]);

  const scrollToVendors = useCallback(() => {
    document.getElementById("vendors")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const requestLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setLocationStatus("unavailable");
      return;
    }

    setLocationStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationStatus("ready");
        setVendors(null);
        setVendorsError(null);
        resetDiscoveryFilters();
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        setLocationStatus(
          error.code === error.PERMISSION_DENIED ? "denied" : "unavailable",
        );
      },
      geoOptions,
    );
  }, [resetDiscoveryFilters]);

  const handleFindFood = useCallback(() => {
    if (coords === null && locationStatus !== "locating") {
      requestLocation();
    }
    scrollToVendors();
  }, [coords, locationStatus, requestLocation, scrollToVendors]);

  const retryDiscovery = useCallback(() => {
    resetDiscoveryFilters();
    if (coords) {
      setVendors(null);
      setVendorsError(null);
      setFetchNonce((nonce) => nonce + 1);
    } else {
      requestLocation();
    }
    scrollToVendors();
  }, [coords, requestLocation, resetDiscoveryFilters, scrollToVendors]);

  const openVendor = useCallback((vendor: VendorCardData) => {
    setSelectedVendor({ id: vendor.id, name: vendor.name });
  }, []);

  // Areas are derived from the fetched vendors' LGA ("category") — pure UX
  // filtering over already-approved backend results, not a second discovery.
  const areas = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const vendor of vendors ?? []) {
      const area = vendor.category.trim();
      if (area && !seen.has(area)) {
        seen.add(area);
        list.push(area);
      }
    }
    return list.sort((a, b) => a.localeCompare(b));
  }, [vendors]);

  const visibleVendors = useMemo(() => {
    if (!vendors) return null;
    const query = searchQuery.trim().toLowerCase();
    return vendors.filter((vendor) => {
      if (query && !vendor.name.toLowerCase().includes(query)) return false;
      if (selectedArea && vendor.category !== selectedArea) return false;
      return true;
    });
  }, [vendors, searchQuery, selectedArea]);

  const handleSignOut = useCallback(async () => {
    // Revokes the refresh token server-side and clears local session state.
    // The realtime socket is tied to the session identity, so it is torn
    // down with the credentials and recreated on the next sign-in.
    await logoutSession();
    closeSocket();
    setIsAuthOpen(false);
  }, []);

  const isDiscovering =
    locationStatus === "locating" ||
    (coords !== null && vendors === null && vendorsError === null);

  const showDiscoveryPrompt =
    !isDiscovering && coords === null && vendors === null;

  return (
    <MotionConfig reducedMotion="user">
      <motion.nav
        className="sticky top-0 z-40 border-b border-[var(--color-line)] bg-white/85 backdrop-blur-md"
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <div className="sabiget-shell flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5" aria-label="SabiGet home">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff4500] text-base font-black text-white shadow-[0_6px_16px_-6px_rgba(255,69,0,0.7)]">
              S
            </span>
            <span className="text-xl font-extrabold tracking-tight text-[#111111]">
              SabiGet
            </span>
          </Link>

          <div className="hidden items-center gap-7 md:flex">
            <a href="#vendors" className="text-sm font-semibold text-[#666666] transition-colors hover:text-[#e63d00]">
              Vendors
            </a>
            <a href="#how-it-works" className="text-sm font-semibold text-[#666666] transition-colors hover:text-[#e63d00]">
              How it works
            </a>
            <a href="#for-vendors" className="text-sm font-semibold text-[#666666] transition-colors hover:text-[#e63d00]">
              For vendors
            </a>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/orders"
              className="inline-flex min-h-[44px] items-center rounded-full px-4 py-2 text-sm font-bold text-[#111111] transition-colors hover:bg-[#ffefe8] hover:text-[#e63d00]"
            >
              Orders
            </Link>
            {signedIn ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex min-h-[44px] items-center rounded-full border border-[var(--color-line-strong)] px-5 py-2.5 text-sm font-bold text-[#111111] transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgba(26,26,26,0.22)]"
              >
                Sign out
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsAuthOpen(true)}
                className="inline-flex min-h-[44px] items-center rounded-full bg-[#ff4500] px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_-8px_rgba(255,69,0,0.65)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#e63d00]"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </motion.nav>

      <Hero locationStatus={locationStatus} onFindFood={handleFindFood} />

      <section id="vendors" className="scroll-mt-20 bg-white py-20 sm:py-24">
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

          <div className="mt-14">
            {isDiscovering ? (
              <>
                <p
                  className="mb-8 flex items-center justify-center gap-2 text-sm font-medium text-[#666666]"
                  role="status"
                >
                  <Loader2 className="h-4 w-4 animate-spin text-[#ff4500]" aria-hidden="true" />
                  Finding food near you...
                </p>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <SkeletonCard key={index} />
                  ))}
                </div>
              </>
            ) : showDiscoveryPrompt ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className="mx-auto max-w-md rounded-2xl border border-[var(--color-line)] bg-white p-8 text-center shadow-[0_18px_40px_-18px_rgba(153,61,17,0.28)]"
              >
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ffefe8] text-[#e63d00]">
                  <Search className="h-7 w-7" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-xl font-bold text-[#111111]">
                  What&apos;s good around you?
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#666666]">
                  Share your location once and we&apos;ll surface verified food
                  vendors within {DISCOVERY_RADIUS_KM} km of you.
                </p>
                {locationStatus === "denied" && (
                  <p className="mt-3 text-sm font-medium text-[#b3400f]" role="alert">
                    We couldn&apos;t access your location.
                  </p>
                )}
                <button
                  type="button"
                  onClick={requestLocation}
                  className="mt-6 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#ff4500] px-6 py-3 text-sm font-bold text-white shadow-[0_10px_28px_-10px_rgba(255,69,0,0.55)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#e63d00]"
                >
                  <MapPin className="h-4.5 w-4.5" aria-hidden="true" />
                  Use my location
                </button>
                <p className="mt-4 text-xs leading-relaxed text-[#8a8a8a]">
                  Location is only used to find vendors nearby. You can keep
                  exploring without it.
                </p>
              </motion.div>
            ) : vendorsError ? (
              <div className="mx-auto max-w-md rounded-2xl border border-[var(--color-line)] bg-white p-8 text-center shadow-sm">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff4ec] text-[#b3400f]">
                  <AlertTriangle className="h-7 w-7" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-xl font-bold text-[#111111]">
                  Something went wrong
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#666666]">
                  {vendorsError}
                </p>
                <button
                  type="button"
                  onClick={retryDiscovery}
                  className="mt-6 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-[var(--color-line-strong)] px-6 py-3 text-sm font-bold text-[#111111] transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgba(26,26,26,0.22)]"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Try again
                </button>
              </div>
            ) : vendors !== null && vendors.length === 0 ? (
              <div className="mx-auto max-w-md rounded-2xl border border-[var(--color-line)] bg-white p-8 text-center shadow-sm">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ffefe8] text-[#e63d00]">
                  <MapPin className="h-7 w-7" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-xl font-bold text-[#111111]">
                  Nothing tasty nearby yet.
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#666666]">
                  No verified vendors are within {DISCOVERY_RADIUS_KM} km of you
                  right now. Check back soon — new kitchens join regularly.
                </p>
                <button
                  type="button"
                  onClick={retryDiscovery}
                  className="mt-6 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-[var(--color-line-strong)] px-6 py-3 text-sm font-bold text-[#111111] transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgba(26,26,26,0.22)]"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Check again
                </button>
              </div>
            ) : vendors !== null && vendors.length > 0 ? (
              <>
                <p className="mb-8 flex items-center justify-center gap-2 text-sm font-medium text-[#2e7d32]" role="status">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  Food near you · within {DISCOVERY_RADIUS_KM} km
                </p>

                <div className="mx-auto mb-8 max-w-xl">
                  <label className="relative block">
                    <span className="sr-only">Search nearby vendors</span>
                    <Search
                      className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[#8a8a8a]"
                      aria-hidden="true"
                    />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search vendors by name"
                      className="min-h-[48px] w-full rounded-full border border-[var(--color-line-strong)] bg-white pl-11 pr-4 text-sm text-[#111111] outline-none placeholder:text-[#8a8a8a] focus:border-[#ff4500] focus:ring-4 focus:ring-[rgba(255,69,0,0.14)]"
                    />
                  </label>

                  {areas.length > 0 && (
                    <div className="mt-3 flex flex-wrap justify-center gap-2" role="group" aria-label="Filter vendors by area">
                      <button
                        type="button"
                        onClick={() => setSelectedArea(null)}
                        aria-pressed={selectedArea === null}
                        className={`touch-target inline-flex items-center rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
                          selectedArea === null
                            ? "bg-[#ff4500] text-white"
                            : "border border-[var(--color-line-strong)] bg-white text-[#666666] hover:border-[#ff4500] hover:text-[#e63d00]"
                        }`}
                      >
                        All areas
                      </button>
                      {areas.map((area) => (
                        <button
                          key={area}
                          type="button"
                          onClick={() =>
                            setSelectedArea((current) =>
                              current === area ? null : area,
                            )
                          }
                          aria-pressed={selectedArea === area}
                          className={`touch-target inline-flex items-center rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
                            selectedArea === area
                              ? "bg-[#ff4500] text-white"
                              : "border border-[var(--color-line-strong)] bg-white text-[#666666] hover:border-[#ff4500] hover:text-[#e63d00]"
                          }`}
                        >
                          {area}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {visibleVendors !== null && visibleVendors.length === 0 ? (
                  <div className="mx-auto max-w-md rounded-2xl border border-[var(--color-line)] bg-white p-8 text-center shadow-sm">
                    <p className="text-sm leading-relaxed text-[#666666]">
                      No vendors match your search. Try a different name or
                      area.
                    </p>
                    <button
                      type="button"
                      onClick={resetDiscoveryFilters}
                      className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-full border border-[var(--color-line-strong)] px-5 py-2.5 text-sm font-bold text-[#111111] transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgba(26,26,26,0.22)]"
                    >
                      Clear filters
                    </button>
                  </div>
                ) : (
                  <motion.div
                    variants={cardStagger}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-60px" }}
                    className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
                  >
                    {(visibleVendors ?? []).map((vendor) => (
                      <motion.div key={vendor.id} variants={cardItem}>
                        <VendorCard vendor={vendor} onSelect={openVendor} />
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </section>

      <HowItWorks />

      {liveOrderId && (
        <section className="bg-white pb-4 pt-2">
          <div className="sabiget-shell max-w-3xl">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff4500]">
                  Live order
                </p>
                <h3 className="mt-1 text-2xl font-extrabold tracking-tight text-[#111111]">
                  Your order is being tracked
                </h3>
              </div>
              <Link
                href="/orders"
                className="inline-flex shrink-0 items-center gap-1.5 text-sm font-bold text-[#e63d00] hover:underline"
              >
                All orders
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <OrderStatusCard orderId={liveOrderId} />
          </div>
        </section>
      )}

      <TrustSection />

      <VendorCTA />

      <FinalCTA onFindFood={handleFindFood} />

      <Footer />

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <MenuModal
        isOpen={Boolean(selectedVendor)}
        vendorId={selectedVendor?.id || null}
        vendorName={selectedVendor?.name || "Vendor"}
        onClose={() => setSelectedVendor(null)}
      />
    </MotionConfig>
  );
}
