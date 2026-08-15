"use client";

import { motion } from "framer-motion";
import { Search, MapPin, Smartphone, Shield } from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.3,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

const steps = [
  {
    icon: MapPin,
    title: "Find Nearby Vendors",
    description:
      "Discover restaurants and food vendors around you with real-time location tracking",
  },
  {
    icon: Search,
    title: "Browse & Order",
    description:
      "Check menus, see ratings, and place your order in just a few taps",
  },
  {
    icon: Smartphone,
    title: "Verify with DVC",
    description:
      "Use our Digital Verification Code to confirm delivery authenticity",
  },
  {
    icon: Shield,
    title: "Earn Loyalty Points",
    description:
      "Get rewarded for every order - 5% on first 3 orders, 2% after",
  },
];

export default function HowItWorks() {
  return (
    <section className="py-20 px-4 bg-white">
      <motion.div
        className="max-w-6xl mx-auto"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        <motion.div variants={itemVariants} className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            How Sabiget Works
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Get your favorite meals delivered safely with our transparent,
            secure process
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={index}
                variants={itemVariants}
                className="flex flex-col items-center text-center p-6 rounded-lg hover:bg-orange-50 transition-colors"
                whileHover={{ y: -5 }}
              >
                <motion.div
                  className="w-16 h-16 bg-linear-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center mb-4 shadow-lg"
                  whileHover={{ scale: 1.1, rotate: 10 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <Icon className="w-8 h-8 text-white" />
                </motion.div>

                <div className="absolute -top-3 -right-3 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  {index + 1}
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {step.title}
                </h3>
                <p className="text-gray-600">{step.description}</p>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          className="mt-16 flex justify-center md:hidden"
          initial={{ scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
          viewport={{ once: true }}
        >
          <div className="w-1 h-16 bg-linear-to-b from-orange-400 to-transparent rounded-full" />
        </motion.div>
      </motion.div>
    </section>
  );
}
