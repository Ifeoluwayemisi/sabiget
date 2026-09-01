"use client";

import { motion } from "framer-motion";
import { BadgeCheck, MapPin, ShieldCheck, Zap } from "lucide-react";

const trustItems = [
  {
    icon: ShieldCheck,
    title: "Secure payments",
    description:
      "Payments are processed securely before your order reaches the kitchen.",
  },
  {
    icon: MapPin,
    title: "Nearby vendors",
    description:
      "Discover participating food vendors around you in real time.",
  },
  {
    icon: BadgeCheck,
    title: "Delivery verification",
    description:
      "A unique code confirms every order is handed to the right person.",
  },
  {
    icon: Zap,
    title: "Guest checkout",
    description:
      "Start ordering right away — no full account needed before checkout.",
  },
];

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export default function TrustSection() {
  return (
    <section id="trust" className="scroll-mt-20 bg-white py-20 sm:py-24">
      <div className="sabiget-shell">
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          <motion.div variants={item} className="mx-auto max-w-2xl text-center">
            <p className="sabiget-badge sabiget-badge-brand mx-auto">
              Why SabiGet
            </p>
            <h2 className="mt-4 text-balance text-3xl font-extrabold tracking-tight text-[#111111] sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
              Built for trust, from payment to plate
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-[#666666]">
              Ordering food online should feel as safe as buying it in person.
            </p>
          </motion.div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {trustItems.map(({ icon: Icon, title, description }) => (
              <motion.div
                key={title}
                variants={item}
                className="rounded-2xl border border-[var(--color-line)] bg-white p-6 shadow-[0_1px_2px_rgba(26,26,26,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_-18px_rgba(153,61,17,0.28)]"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#ffefe8] text-[#e63d00]">
                  <Icon className="h-5.5 w-5.5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-base font-bold text-[#111111]">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#666666]">
                  {description}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
