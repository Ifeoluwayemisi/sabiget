"use client";

import { useState } from "react";
import { UtensilsCrossed } from "lucide-react";

interface FoodImageProps {
  src: string;
  alt: string;
  className?: string;
}

/**
 * Wraps decorative food photography so a failed/slow CDN load (hotlinked
 * Unsplash images have no uptime guarantee) never leaves a blank tile —
 * it falls back to a branded gradient + icon instead.
 */
export default function FoodImage({ src, alt, className = "" }: FoodImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-[#ffefe8] to-[#ffe0d1] text-[#c96a3f] ${className}`}
      >
        <UtensilsCrossed className="h-1/3 w-1/3" aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={`object-cover ${className}`}
      onError={() => setFailed(true)}
    />
  );
}
