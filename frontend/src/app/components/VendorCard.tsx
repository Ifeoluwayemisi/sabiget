"use client";

import { motion } from "framer-motion";
import { Star, MapPin, Clock } from "lucide-react";

interface VendorCardProps {
  name: string;
  image: string;
  rating: number;
  reviews: number;
  distance: string;
  deliveryTime: string;
  category: string;
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

const hoverVariants = {
  hover: {
    y: -8,
    boxShadow: "0 20px 25px -5rgba(0, 0, 0, 0.1)",
    transition: { type: "spring", stiffness: 300, damping: 10 },
  },
};

const imageVariants = {
  hover: {
    scale: 1.05,
    transition: { duration: 0.3 },
  },
};

export default function VendorCard({
  name,
  image,
  rating,
  reviews,
  distance,
  deliveryTime,
  category,
}: VendorCardProps) {
  return (
    <motion.div
      className="rounded-lg overflow-hidden bg-white shadow-md hover:shadow-xl transition-shadow"
      variants={cardVariants}
      whileHover="hover"
      variants={hoverVariants}
    >
      {/* Image Container */}
      <motion.div
        className="relative h-40 overflow-hidden bg-gray-200"
        variants={imageVariants}
      >
        <img src={image} alt={name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-all" />

        {/* Category Badge */}
        <motion.div
          className="absolute top-2 right-2 bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-semibold"
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
        >
          {category}
        </motion.div>
      </motion.div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-lg font-bold text-gray-900 mb-2">{name}</h3>

        {/* Rating */}
        <div className="flex items-center gap-1 mb-3">
          <div className="flex items-center">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`w-4 h-4 ${
                  i < Math.floor(rating)
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-gray-300"
                }`}
              />
            ))}
          </div>
          <span className="text-sm font-semibold text-gray-700 ml-1">
            {rating}
          </span>
          <span className="text-xs text-gray-500">({reviews})</span>
        </div>

        {/* Info Grid */}
        <div className="space-y-2 border-t pt-3">
          <motion.div
            className="flex items-center gap-2 text-sm text-gray-600"
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <MapPin className="w-4 h-4 text-orange-500" />
            <span>{distance} away</span>
          </motion.div>

          <motion.div
            className="flex items-center gap-2 text-sm text-gray-600"
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            viewport={{ once: true }}
          >
            <Clock className="w-4 h-4 text-orange-500" />
            <span>{deliveryTime} delivery</span>
          </motion.div>
        </div>

        {/* CTA Button */}
        <motion.button
          className="w-full mt-4 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg font-semibold transition-all"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          View Menu
        </motion.button>
      </div>
    </motion.div>
  );
}
