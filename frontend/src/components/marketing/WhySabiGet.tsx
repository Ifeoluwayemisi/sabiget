"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Search,
  Store,
  ShieldCheck,
  BadgeCheck,
  UserCheck,
  Radar,
  ArrowRight,
} from "lucide-react";

const VALUES = [
  {
    icon: Search,
    title: "Discover local favorites",
    description: "Find food from nearby vendors you may not discover elsewhere.",
  },
  {
    icon: Store,
    title: "Know who you're ordering from",
    description: "Browse vendor profiles, menus, and store information.",
  },
  {
    icon: ShieldCheck,
    title: "Pay before the kitchen starts",
    description: "Secure prepaid checkout helps vendors confirm serious orders.",
  },
  {
    icon: BadgeCheck,
    title: "A safer handoff",
    description: "A delivery verification code helps ensure the order reaches the right person.",
  },
  {
    icon: UserCheck,
    title: "No account pressure",
    description: "Browse and start ordering as a guest. Create an account when you want to.",
  },
  {
    icon: Radar,
    title: "Live order tracking",
    description: "Follow your order status from the kitchen to your door in real time.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const, delay: i * 0.06 },
  }),
};

export default function WhySabiGet() {
  return (
    <section id="why-sabiget" className="scroll-mt-20 bg-[#edf7ee] py-20 sm:py-28">
      <div className="sabiget-shell grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-16">
        {/* Left: copy + CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="sabiget-badge sabiget-badge-accent">
            Why choose SabiGet
          </p>
          <h2 className="mt-4 text-balance text-3xl font-extrabold leading-[1.1] tracking-tight text-[#111111] sm:text-4xl lg:text-[2.75rem]">
            Good food? We sabi.
          </h2>
          <p className="mt-5 max-w-md text-base leading-relaxed text-[#4a4a4a] sm:text-lg">
            More than just food delivery — we help you discover local vendors,
            enjoy secure ordering, and get your food the right way.
          </p>
          <Link
            href="/#how-it-works"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#111111] px-7 py-3.5 text-sm font-bold text-white shadow-[0_8px_24px_-6px_rgba(0,0,0,0.3)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-black"
          >
            Explore how it works
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>

        {/* Right: value grid */}
        <div className="grid grid-cols-1 gap-x-8 gap-y-8 sm:grid-cols-2">
          {VALUES.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-40px" }}
                className="flex items-start gap-4"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#2e7d32] text-white shadow-[0_8px_20px_-8px_rgba(46,125,50,0.5)]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-[#111111]">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-[#5f5a57]">
                    {item.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
