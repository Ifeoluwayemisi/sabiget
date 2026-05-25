"use client";

import { motion } from "framer-motion";
import {
  Facebook,
  Twitter,
  Instagram,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";

const footerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
};

const socialLinks = [
  { icon: Facebook, href: "#", label: "Facebook" },
  { icon: Twitter, href: "#", label: "Twitter" },
  { icon: Instagram, href: "#", label: "Instagram" },
];

const footerLinks = {
  Product: ["Features", "Security", "Team", "Enterprise"],
  Company: ["About", "Blog", "Careers", "Press"],
  Support: ["Help Center", "Contact", "Status", "Documentation"],
  Legal: ["Privacy", "Terms", "Cookies", "License"],
};

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-16 px-4">
      <motion.div
        className="max-w-6xl mx-auto"
        variants={footerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 mb-12">
          {/* Brand */}
          <motion.div variants={itemVariants} className="col-span-1">
            <h2 className="text-2xl font-bold text-orange-500 mb-4">Sabiget</h2>
            <p className="text-gray-400 mb-6">
              Your favorite local meals, delivered fast and secure.
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-gray-400 hover:text-orange-500 transition cursor-pointer">
                <MapPin className="w-5 h-5" />
                <span>Lagos, Nigeria</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400 hover:text-orange-500 transition cursor-pointer">
                <Phone className="w-5 h-5" />
                <span>+234 800 000 0000</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400 hover:text-orange-500 transition cursor-pointer">
                <Mail className="w-5 h-5" />
                <span>support@sabiget.com</span>
              </div>
            </div>
          </motion.div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links], idx) => (
            <motion.div
              key={category}
              variants={itemVariants}
              className="col-span-1"
            >
              <h3 className="font-bold text-lg mb-4">{category}</h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-gray-400 hover:text-orange-500 transition duration-300"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Divider */}
        <motion.div
          className="border-t border-gray-800 my-8"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
        />

        {/* Bottom Section */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col md:flex-row justify-between items-center gap-6"
        >
          {/* Copyright */}
          <p className="text-gray-400 text-sm">
            © 2026 Sabiget. All rights reserved. Made with ❤️ in Lagos.
          </p>

          {/* Social Links */}
          <div className="flex gap-6">
            {socialLinks.map(({ icon: Icon, href, label }) => (
              <motion.a
                key={label}
                href={href}
                className="text-gray-400 hover:text-orange-500 transition duration-300"
                whileHover={{ scale: 1.2, rotate: 10 }}
                whileTap={{ scale: 0.95 }}
                aria-label={label}
              >
                <Icon className="w-6 h-6" />
              </motion.a>
            ))}
          </div>

          {/* CTA */}
          <motion.button
            className="px-6 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg font-semibold transition"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Get Started
          </motion.button>
        </motion.div>

        {/* Newsletter Section */}
        <motion.div
          variants={itemVariants}
          className="mt-12 p-6 bg-orange-500/10 border border-orange-500/30 rounded-lg text-center"
        >
          <h3 className="text-xl font-bold mb-3">Join Our Community</h3>
          <p className="text-gray-300 mb-4">
            Be the first to know about new vendors and exclusive offers
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="your@email.com"
              className="flex-1 px-4 py-2 rounded-lg bg-gray-900 text-white placeholder-gray-500 border border-gray-700 focus:border-orange-500 focus:outline-none"
            />
            <button className="px-6 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg font-semibold transition">
              Subscribe
            </button>
          </div>
        </motion.div>
      </motion.div>
    </footer>
  );
}
