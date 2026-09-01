"use client";

import { motion } from "framer-motion";
import { AlertCircle, BadgeCheck, Loader2, MapPin, RotateCcw, ShieldCheck } from "lucide-react";
import Image from "next/image";

export type LocationStatus = "idle" | "locating" | "ready" | "denied" | "unavailable";

interface HeroProps {
  locationStatus: LocationStatus;
  onFindFood: () => void;
}

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const trustPoints = [
  { icon: ShieldCheck, label: "Secure payments" },
  { icon: BadgeCheck, label: "Verified delivery handoff" },
];

function LocationFeedback({
  status,
  onFindFood,
}: {
  status: LocationStatus;
  onFindFood: () => void;
}) {
  if (status === "locating") {
    return (
      <p className="flex items-center gap-2 text-sm font-medium text-[#666666]">
        <Loader2 className="h-4 w-4 animate-spin text-[#ff4500]" aria-hidden="true" />
        Finding food near you...
      </p>
    );
  }

  if (status === "ready") {
    return (
      <p className="flex items-center gap-2 text-sm font-medium text-[#2e7d32]">
        <MapPin className="h-4 w-4" aria-hidden="true" />
        Showing vendors near you
      </p>
    );
  }

  if (status === "denied" || status === "unavailable") {
    return (
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-[#666666]">
        <span className="inline-flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-[#b3400f]" aria-hidden="true" />
          We couldn&apos;t access your location.
        </span>
        <button
          type="button"
          onClick={onFindFood}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-[#e63d00] transition-colors hover:bg-[#ffefe8]"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Try again
        </button>
      </p>
    );
  }

  return (
    <p className="text-sm text-[#8a8a8a]">
      You&apos;re never required to share your location to keep browsing.
    </p>
  );
}

export default function Hero({ locationStatus, onFindFood }: HeroProps) {
  const scrollToVendors = () => {
    document.getElementById("vendors")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="relative overflow-hidden bg-[var(--background)]">
      <div className="sabiget-grid-glow pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />

      <div className="sabiget-shell relative grid items-center gap-12 pb-16 pt-14 sm:pt-16 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10 lg:pb-24 lg:pt-24">
        <motion.div variants={container} initial="hidden" animate="visible">
          <motion.p
            variants={item}
            className="sabiget-badge sabiget-badge-brand"
          >
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            Local food marketplace
          </motion.p>

          <motion.h1
            variants={item}
            className="mt-5 max-w-xl text-balance text-4xl font-extrabold leading-[1.06] tracking-tight text-[#111111] sm:text-5xl lg:text-6xl"
          >
            Good food,{" "}
            <span className="bg-linear-to-r from-[#ff4500] to-[#ff6a00] bg-clip-text text-transparent">
              right around you.
            </span>
          </motion.h1>

          <motion.p
            variants={item}
            className="mt-5 max-w-lg text-lg leading-relaxed text-[#666666]"
          >
            Discover nearby food vendors, order what you&apos;re craving, and get
            it sorted without the usual hassle.
          </motion.p>

          <motion.div variants={item} className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={onFindFood}
              disabled={locationStatus === "locating"}
              className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-[#ff4500] px-7 py-3.5 text-base font-bold text-white shadow-[0_10px_28px_-10px_rgba(255,69,0,0.55)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#e63d00] hover:shadow-[0_16px_34px_-12px_rgba(255,69,0,0.6)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70 sm:min-h-[56px]"
            >
              {locationStatus === "locating" ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                  Finding food near you...
                </>
              ) : (
                <>
                  <MapPin className="h-5 w-5" aria-hidden="true" />
                  Find food near me
                </>
              )}
            </button>

            <button
              type="button"
              onClick={scrollToVendors}
              className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-[var(--color-line-strong)] bg-white/70 px-7 py-3.5 text-base font-bold text-[#111111] backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgba(26,26,26,0.22)] sm:min-h-[56px]"
            >
              Browse vendors
            </button>
          </motion.div>

          <motion.div variants={item} className="mt-5">
            <LocationFeedback status={locationStatus} onFindFood={onFindFood} />
          </motion.div>

          <motion.ul variants={item} className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2">
            {trustPoints.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2 text-sm font-medium text-[#8a8a8a]">
                <Icon className="h-4 w-4 text-[#ff4500]" aria-hidden="true" />
                {label}
              </li>
            ))}
          </motion.ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.25 }}
          className="relative mx-auto w-full max-w-md lg:max-w-none"
        >
          <div className="overflow-hidden rounded-[28px] border border-[var(--color-line)] shadow-[0_30px_60px_-30px_rgba(153,61,17,0.35)]">
            <Image
              src="/hero-food-scene.svg"
              alt="Illustration of a SabiGet order being verified on delivery"
              width={900}
              height={860}
              priority
              sizes="(min-width: 1024px) 46vw, (min-width: 640px) 60vw, 90vw"
              className="h-auto w-full"
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
