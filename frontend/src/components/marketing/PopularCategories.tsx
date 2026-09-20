"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowRight, UtensilsCrossed } from "lucide-react";
import FoodImage from "./FoodImage";

const CATEGORIES = [
  {
    slug: "rice",
    label: "Rice meals",
    image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=200&h=200&fit=crop&q=80",
  },
  {
    slug: "soups",
    label: "Swallow",
    image: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=200&h=200&fit=crop&q=80",
  },
  {
    slug: "fast-food",
    label: "Fast food",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200&h=200&fit=crop&q=80",
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
  {
    slug: "grills",
    label: "Grills",
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=200&h=200&fit=crop&q=80",
  },
  {
    slug: "local-favorites",
    label: "Local favorites",
    image: "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=200&h=200&fit=crop&q=80",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const, delay: i * 0.04 },
  }),
};

export default function PopularCategories() {
  const router = useRouter();

  return (
    <section id="categories" className="scroll-mt-20 bg-white py-20 sm:py-28">
      <div className="sabiget-shell">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="sabiget-badge sabiget-badge-brand">
              Popular categories
            </p>
            <h2 className="mt-4 text-balance text-3xl font-extrabold tracking-tight text-[#111111] sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
              What are you in the mood for?
            </h2>
            <p className="mt-3 max-w-md text-lg leading-relaxed text-[#666666]">
              Explore a wide range of local and popular food categories.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/shop")}
            className="mb-1 inline-flex shrink-0 items-center gap-1.5 text-sm font-bold text-[#e63d00] transition-colors hover:text-[#ff4500]"
          >
            View all categories
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Single row of chips — horizontally scrollable at every breakpoint, no duplicate variants */}
        <div className="mt-10 flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
          <motion.button
            type="button"
            custom={0}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-40px" }}
            onClick={() => router.push("/shop")}
            className="group flex w-[84px] shrink-0 flex-col items-center gap-2.5 snap-start sm:w-[96px]"
          >
            <span className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-[#ff4500] text-white shadow-[0_10px_24px_-8px_rgba(255,69,0,0.5)] transition-transform duration-200 group-hover:-translate-y-1 sm:h-20 sm:w-20">
              <UtensilsCrossed className="h-7 w-7" aria-hidden="true" />
            </span>
            <span className="text-center text-xs font-bold text-[#111111] sm:text-sm">
              All
            </span>
          </motion.button>

          {CATEGORIES.map((cat, i) => (
            <motion.button
              key={cat.slug}
              type="button"
              custom={i + 1}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-40px" }}
              onClick={() => router.push(`/shop?category=${encodeURIComponent(cat.slug)}`)}
              className="group flex w-[84px] shrink-0 flex-col items-center gap-2.5 snap-start sm:w-[96px]"
            >
              <span className="relative h-[72px] w-[72px] overflow-hidden rounded-2xl ring-1 ring-black/[0.06] transition-all duration-200 group-hover:-translate-y-1 group-hover:ring-[#ff4500]/40 sm:h-20 sm:w-20">
                <FoodImage
                  src={cat.image}
                  alt=""
                  className="h-full w-full transition-transform duration-500 group-hover:scale-110"
                />
              </span>
              <span className="text-center text-xs font-bold text-[#111111] sm:text-sm">
                {cat.label}
              </span>
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  );
}
