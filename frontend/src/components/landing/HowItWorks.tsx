"use client";

import { motion } from "framer-motion";
import { Search, ShoppingBag, UtensilsCrossed } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Search,
    title: "Discover",
    description: "Find food vendors near you.",
  },
  {
    number: "02",
    icon: ShoppingBag,
    title: "Order",
    description: "Choose your meal and checkout securely.",
  },
  {
    number: "03",
    icon: UtensilsCrossed,
    title: "Enjoy",
    description: "Receive your order from the vendor.",
  },
];

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 bg-[var(--background)] py-20 sm:py-24">
      <div className="sabiget-shell">
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          <motion.div variants={item} className="mx-auto max-w-2xl text-center">
            <p className="sabiget-badge sabiget-badge-brand mx-auto">
              How it works
            </p>
            <h2 className="mt-4 text-balance text-3xl font-extrabold tracking-tight text-[#111111] sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
              From craving to doorstep in three steps
            </h2>
          </motion.div>

          <ol className="mt-14 grid gap-10 sm:grid-cols-3 sm:gap-6 lg:gap-10">
            {steps.map(({ number, icon: Icon, title, description }) => (
              <motion.li
                key={number}
                variants={item}
                className="relative flex flex-col items-center text-center sm:items-start sm:text-left"
              >
                <div className="flex items-center gap-4">
                  <span className="text-4xl font-extrabold tracking-tight text-[#ffd7c2] sm:text-5xl">
                    {number}
                  </span>
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ffefe8] text-[#e63d00]">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                </div>

                <h3 className="mt-5 text-xl font-bold text-[#111111]">{title}</h3>
                <p className="mt-2 max-w-xs text-base leading-relaxed text-[#666666]">
                  {description}
                </p>

                <span
                  className="mt-6 hidden h-px w-full bg-linear-to-r from-[var(--color-line-strong)] to-transparent sm:block"
                  aria-hidden="true"
                />
              </motion.li>
            ))}
          </ol>
        </motion.div>
      </div>
    </section>
  );
}
