"use client";

import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

const heroVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.2, delayChildren: 0.3 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: "easeOut" },
  },
};

const bounce = {
  animate: {
    y: [0, -10, 0],
    transition: { duration: 2, repeat: Infinity, ease: "easeInOut" },
  },
};

interface HeroProps {
  onGetStarted?: () => void;
}

export default function Hero({ onGetStarted }: HeroProps) {
  return (
    <section className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center px-4 pt-20 pb-10">
      <motion.div
        className="max-w-4xl mx-auto text-center"
        variants={heroVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        <motion.div variants={itemVariants} className="inline-block mb-6">
          <div className="bg-orange-100 text-orange-700 px-4 py-2 rounded-full text-sm font-medium">
            🚀 Launching in your city soon
          </div>
        </motion.div>

        <motion.h1
          variants={itemVariants}
          className="text-5xl md:text-7xl font-bold text-gray-900 mb-6 leading-tight"
        >
          Your Favorite{" "}
          <span className="bg-linear-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
            Local Meals
          </span>
          , Delivered Fast
        </motion.h1>

        <motion.p
          variants={itemVariants}
          className="text-xl md:text-2xl text-gray-600 mb-8 max-w-2xl mx-auto"
        >
          Discover nearby vendors, browse fresh meals, and verify every delivery
          with our secure DVC system
        </motion.p>

        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <button
            onClick={onGetStarted}
            className="px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-all transform hover:scale-105 shadow-lg"
          >
            Continue as Guest
          </button>
          <button className="px-8 py-4 border-2 border-gray-300 hover:border-orange-500 text-gray-700 hover:text-orange-500 rounded-lg font-semibold transition-all">
            Join as Vendor
          </button>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="mt-20"
          animate={bounce.animate}
        >
          <ChevronDown className="w-8 h-8 text-orange-500 mx-auto" />
        </motion.div>
      </motion.div>
    </section>
  );
}
