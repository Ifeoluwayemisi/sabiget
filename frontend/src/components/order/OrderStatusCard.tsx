"use client";

import { useMemo } from "react";
import { CheckCircle2, Clock3, MapPin, PackageCheck, Truck } from "lucide-react";
import { getLatestOrderId } from "@/lib/orderTracker";
import { formatNaira } from "@/lib/format";
import { getOrderStatusMeta } from "@/lib/orderStatus";
import { useOrderStatus } from "@/hooks/useOrderStatus";

interface OrderStatusCardProps {
  orderId?: string | null;
  vendorName?: string;
  totalAmount?: number;
  reference?: string;
}

export default function OrderStatusCard({
  orderId,
  vendorName,
  totalAmount,
  reference,
}: OrderStatusCardProps) {
  const effectiveOrderId = orderId || getLatestOrderId();
  const { order, loading } = useOrderStatus(effectiveOrderId);

  const currentStatus = useMemo(
    () => getOrderStatusMeta(order?.status),
    [order],
  );

  if (!effectiveOrderId) return null;

  return (
    <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-strong)] p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#e63d00]">
            Order status
          </p>
          <h4 className="mt-1 text-lg font-bold text-[#111111]">
            {vendorName || "Your order"}
          </h4>
        </div>
        <div className="rounded-full bg-[#ffefe8] px-2.5 py-1 text-[10px] font-bold text-[#a82b00]">
          {order?.status || "PAYMENT STARTED"}
        </div>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[#ffefe8]">
        <div
          className="h-full rounded-full bg-linear-to-r from-[#ff4500] to-[#ff6a00] transition-all duration-500"
          style={{ width: `${currentStatus.progress}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-sm text-[#5f5a57]">
        <span className="inline-flex items-center gap-2 font-medium">
          {order?.status === "DELIVERED" || order?.status === "COMPLETED" ? (
            <CheckCircle2 className="h-4 w-4 text-[#2e7d32]" />
          ) : order?.status === "OUT_FOR_DELIVERY" ? (
            <Truck className="h-4 w-4 text-[#e63d00]" />
          ) : order?.status === "PREPARING" || order?.status === "ACCEPTED" ? (
            <PackageCheck className="h-4 w-4 text-[#e63d00]" />
          ) : (
            <Clock3 className="h-4 w-4 text-[#e63d00]" />
          )}
          {currentStatus.label}
        </span>
        {typeof totalAmount === "number" && (
          <span className="font-bold text-[#111111]">{formatNaira(totalAmount)}</span>
        )}
      </div>

      <div className="mt-4 space-y-2 text-sm text-[#5f5a57]">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#ff4500]" />
            Order ID
          </span>
          <span className="font-medium text-[#111111]">{effectiveOrderId}</span>
        </div>
        {reference && (
          <div className="flex items-center justify-between gap-3">
            <span>Reference</span>
            <span className="font-medium text-[#111111]">{reference}</span>
          </div>
        )}
      </div>

      {loading && (
        <p className="mt-3 text-xs text-[#8a8a8a]">
          Refreshing live order status...
        </p>
      )}
    </div>
  );
}