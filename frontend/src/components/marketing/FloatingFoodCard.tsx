"use client";

import FoodImage from "./FoodImage";

export interface FloatingCardData {
  mealName: string;
  vendorName: string;
  price: string;
  distance: string;
  imageUrl: string;
  imageAlt: string;
}

interface FloatingFoodCardProps {
  data: FloatingCardData;
  className?: string;
}

export default function FloatingFoodCard({
  data,
  className = "",
}: FloatingFoodCardProps) {
  return (
    <div
      className={`flex w-[240px] items-center gap-3 rounded-2xl bg-white p-2.5 shadow-[0_8px_24px_-6px_rgba(0,0,0,0.3)] ${className}`}
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#f4efeb]">
        <FoodImage src={data.imageUrl} alt={data.imageAlt} className="h-full w-full" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-[#111] leading-tight">
          {data.mealName}
        </p>
        <p className="truncate text-[11px] text-[#888] leading-tight mt-0.5">
          {data.vendorName}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="text-[12px] font-bold text-[#111]">{data.price}</span>
          <span className="text-[10px] text-[#aaa]">·</span>
          <span className="text-[11px] text-[#888]">{data.distance}</span>
          <span className="ml-auto inline-flex items-center rounded-full bg-[#e8f5e9] px-2 py-0.5 text-[10px] font-semibold text-[#2e7d32]">
            Open
          </span>
        </div>
      </div>
    </div>
  );
}
