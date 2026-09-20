"use client";

import { motion } from "framer-motion";
import { MapPin, CreditCard, Truck } from "lucide-react";

const STEPS = [
  {
    number: "01",
    icon: MapPin,
    title: "Set your location",
    description: "Allow location access or enter your address to find vendors near you.",
  },
  {
    number: "02",
    icon: CreditCard,
    title: "Order & pay",
    description: "Browse menus, add to cart, and pay securely with Paystack before your order is placed.",
  },
  {
    number: "03",
    icon: Truck,
    title: "Get it delivered",
    description: "The vendor prepares your order and dispatches it. Verify with a code when it arrives.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const, delay: i * 0.1 },
  }),
};

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 bg-white py-20 sm:py-28">
      <div className="sabiget-shell">
        <div className="mx-auto max-w-2xl text-center">
          <p className="sabiget-badge sabiget-badge-brand mx-auto">
            How it works
          </p>
          <h2 className="mt-4 text-balance text-3xl font-extrabold tracking-tight text-[#111111] sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
            Three steps to your next meal.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-[#666666]">
            No accounts, no cash, no hassle. Just food.
          </p>
        </div>

        <div className="relative mt-14">
          {/* Connection line (desktop only) */}
          <div className="pointer-events-none absolute left-0 right-0 top-[2.75rem] hidden h-px bg-gradient-to-r from-transparent via-[#ff4500]/20 to-transparent lg:block" />

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.number}
                  custom={i}
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-40px" }}
                  className="relative text-center"
                >
                  {/* Step number badge */}
                  <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ff4500] text-base font-extrabold text-white shadow-[0_8px_24px_-6px_rgba(255,69,0,0.5)]">
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-[#ff4500]/60">
                    Step {step.number}
                  </span>
                  <h3 className="text-lg font-bold text-[#111111]">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#666666]">
                    {step.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
