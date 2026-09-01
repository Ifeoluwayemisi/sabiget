"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export default function VendorCTA() {
  return (
    <section id="for-vendors" className="scroll-mt-20 bg-[var(--background)] py-20 sm:py-24">
      <div className="sabiget-shell">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="sabiget-noise relative overflow-hidden rounded-[28px] bg-[#111111] px-6 py-14 text-center sm:px-12 lg:px-20"
        >
          <div
            className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#ff4500]/25 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-28 -left-16 h-56 w-56 rounded-full bg-[#ff6a00]/15 blur-3xl"
            aria-hidden="true"
          />

          <div className="relative mx-auto max-w-2xl">
            <p className="sabiget-badge border border-white/15 bg-white/10 text-white/85">
              For vendors
            </p>

            <h2 className="mt-5 text-balance text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
              You make the food.
              <br />
              We help people find it.
            </h2>

            <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-white/70">
              Put your menu in front of hungry customers around you and manage
              every order on your terms.
            </p>

            <div className="mt-9 flex justify-center">
              <Link
                href="/vendor-dashboard"
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-[#ff4500] px-7 py-3.5 text-base font-bold text-white shadow-[0_10px_28px_-10px_rgba(255,69,0,0.65)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#ff6a00]"
              >
                Become a SabiGet vendor
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
