"use client";

import { motion } from "framer-motion";
import { MapPin } from "lucide-react";

interface FinalCTAProps {
  onFindFood: () => void;
}

export default function FinalCTA({ onFindFood }: FinalCTAProps) {
  return (
    <section className="bg-white pb-20 pt-4 sm:pb-24">
      <div className="sabiget-shell">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-[28px] bg-linear-to-br from-[#ff4500] to-[#ff6a00] px-6 py-14 text-center shadow-[0_30px_60px_-30px_rgba(255,69,0,0.55)] sm:px-12"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 30%, white 0 1px, transparent 1.4px), radial-gradient(circle at 70% 70%, white 0 1px, transparent 1.4px)",
              backgroundSize: "26px 26px",
            }}
            aria-hidden="true"
          />

          <div className="relative mx-auto max-w-xl">
            <h2 className="text-balance text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
              Hungry? Let&apos;s fix that.
            </h2>

            <p className="mt-3 text-lg text-white/90">
              Good food is closer than you think.
            </p>

            <button
              type="button"
              onClick={onFindFood}
              className="mt-8 inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-base font-bold text-[#e63d00] shadow-[0_10px_28px_-10px_rgba(0,0,0,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#fff7f1]"
            >
              <MapPin className="h-5 w-5" aria-hidden="true" />
              Find food near me
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
