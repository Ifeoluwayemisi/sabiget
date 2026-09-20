"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import FoodImage from "./FoodImage";

const CHECKLIST = [
  "Create your digital storefront",
  "Reach nearby customers",
  "Manage menus and orders",
  "Set your delivery radius",
  "Receive prepaid orders",
  "Operate on your own delivery terms",
];

export default function VendorAcquisition() {
  return (
    <section id="for-vendors" className="scroll-mt-20 bg-[#0d2818] py-16 sm:py-20">
      <div className="sabiget-shell grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)_minmax(0,280px)] lg:gap-12">
        {/* Left: chef photo */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="order-1 hidden overflow-hidden rounded-3xl lg:block"
        >
          <FoodImage
            src="https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=500&h=700&fit=crop&q=80"
            alt="A vendor preparing food in their kitchen"
            className="h-full max-h-[420px] w-full"
          />
        </motion.div>

        {/* Middle: copy + CTA */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="order-2"
        >
          <p className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-white/50">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#ff4500]" />
            For vendors
          </p>
          <h2 className="text-balance text-3xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-4xl lg:text-[2.5rem]">
            Turn your kitchen into a discoverable business.
          </h2>
          <p className="mt-5 max-w-md text-base leading-relaxed text-white/60 sm:text-lg">
            Reach nearby customers, showcase your menu, and manage orders on
            your terms — all in one place.
          </p>

          <Link
            href="/vendor/onboarding"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#ff4500] px-7 py-3.5 text-sm font-bold text-white shadow-[0_8px_24px_-6px_rgba(255,69,0,0.6)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#e63d00]"
          >
            Become a SabiGet vendor
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>

        {/* Right: checklist */}
        <motion.ul
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="order-3 space-y-3"
        >
          {CHECKLIST.map((item) => (
            <li key={item} className="flex items-center gap-2.5 text-sm font-medium text-white/85">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#4ade80]" aria-hidden="true" />
              {item}
            </li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
