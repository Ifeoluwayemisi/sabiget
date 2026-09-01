"use client";

import { ArrowRight, Clock3, MapPin, Star, UtensilsCrossed } from "lucide-react";
import type { VendorCardData } from "@/features/home/data/vendors";

interface VendorCardProps {
  vendor: VendorCardData;
  onSelect: (vendor: VendorCardData) => void;
}

export default function VendorCard({ vendor, onSelect }: VendorCardProps) {
  const { name, image, rating, reviews, distanceKm, deliveryMinutes, category } = vendor;

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--color-line)] bg-white shadow-[0_1px_2px_rgba(26,26,26,0.05)] transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_18px_40px_-18px_rgba(153,61,17,0.28)] focus-within:-translate-y-1 focus-within:shadow-[0_18px_40px_-18px_rgba(153,61,17,0.28)]">
      <div className="relative aspect-[4/3] overflow-hidden bg-[#f4efeb]">
        {image ? (
          // Vendor images come from arbitrary origins, so next/image would
          // require an allow-list; a fixed-aspect container prevents layout shift.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-[#ffefe8] to-[#ffe0d1] text-[#c96a3f]">
            <UtensilsCrossed className="h-10 w-10" aria-hidden="true" />
          </div>
        )}

        <span className="absolute left-3 top-3 inline-flex items-center rounded-full bg-white/95 px-3 py-1 text-xs font-semibold tracking-wide text-[#5f5a57] shadow-sm">
          {category}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold leading-snug text-[#111111]">{name}</h3>

          {rating !== null ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#fff4ec] px-2 py-0.5 text-sm font-semibold text-[#b3400f]">
              <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
              {rating.toFixed(1)}
              {reviews > 0 && (
                <span className="sr-only">{` based on ${reviews} reviews`}</span>
              )}
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-[#f4efeb] px-2 py-0.5 text-xs font-semibold text-[#5f5a57]">
              New
            </span>
          )}
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#666666]">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-[#ff4500]" aria-hidden="true" />
            {distanceKm > 0 ? `${distanceKm.toFixed(1)} km away` : "Nearby"}
          </span>
          {deliveryMinutes !== null && (
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-4 w-4 text-[#ff4500]" aria-hidden="true" />
              ~{deliveryMinutes} min
            </span>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--color-line)] pt-3 text-sm font-semibold text-[#111111]">
          View menu
          <ArrowRight
            className="h-4 w-4 text-[#ff4500] transition-transform duration-300 group-hover:translate-x-1"
            aria-hidden="true"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => onSelect(vendor)}
        className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[rgba(255,69,0,0.45)]"
      >
        <span className="sr-only">{`View menu from ${name}`}</span>
      </button>
    </article>
  );
}
