"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  MapPin,
  PackageCheck,
  Truck,
} from "lucide-react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

interface OrderStatusCardProps {
  orderId?: string | null;
  vendorName?: string;
  totalAmount?: number;
  reference?: string;
}

const statusStyles: Record<string, { label: string; progress: number }> = {
  UNPAID: { label: "Awaiting payment", progress: 20 },
  PENDING: { label: "Order pending", progress: 30 },
  ACCEPTED: { label: "Vendor accepted", progress: 45 },
  PREPARING: { label: "Preparing your meal", progress: 65 },
  OUT_FOR_DELIVERY: { label: "Out for delivery", progress: 85 },
  DELIVERED: { label: "Delivered", progress: 100 },
  CANCELLED: { label: "Cancelled", progress: 0 },
};

export default function OrderStatusCard({
  orderId,
  vendorName,
  totalAmount,
  reference,
}: OrderStatusCardProps) {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(Boolean(orderId));

  const effectiveOrderId = orderId || localStorage.getItem("latestOrderId");

  useEffect(() => {
    if (!effectiveOrderId) return;

    const token = localStorage.getItem("accessToken");
    if (!token) {
      setLoading(false);
      return;
    }

    const loadOrder = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `${API_BASE_URL}/orders/${effectiveOrderId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (!response.ok) {
          throw new Error("Unable to fetch order");
        }

        const data = await response.json();
        setOrder(data.order || null);
      } catch (error) {
        console.error("Failed to fetch order status:", error);
      } finally {
        setLoading(false);
      }
    };

    loadOrder();
    const interval = setInterval(loadOrder, 15000);
    return () => clearInterval(interval);
  }, [effectiveOrderId]);

  const currentStatus = useMemo(() => {
    const rawStatus = order?.status || "UNPAID";
    return statusStyles[rawStatus] || { label: "Processing", progress: 40 };
  }, [order]);

  if (!effectiveOrderId) return null;

  return (
    <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-600">
            Order status
          </p>
          <h4 className="mt-1 text-lg font-bold text-gray-900">
            {vendorName || "Your order"}
          </h4>
        </div>
        <div className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-orange-700">
          {order?.status || "PAYMENT STARTED"}
        </div>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-orange-100">
        <div
          className="h-full rounded-full bg-linear-to-r from-orange-500 to-amber-500 transition-all duration-500"
          style={{ width: `${currentStatus.progress}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-sm text-gray-700">
        <span className="inline-flex items-center gap-2 font-medium">
          {order?.status === "DELIVERED" ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : order?.status === "OUT_FOR_DELIVERY" ? (
            <Truck className="h-4 w-4 text-orange-600" />
          ) : order?.status === "PREPARING" ? (
            <PackageCheck className="h-4 w-4 text-orange-600" />
          ) : (
            <Clock3 className="h-4 w-4 text-orange-600" />
          )}
          {currentStatus.label}
        </span>
        {typeof totalAmount === "number" && (
          <span className="font-bold text-gray-900">
            ₦{totalAmount.toLocaleString()}
          </span>
        )}
      </div>

      <div className="mt-4 space-y-2 text-sm text-gray-600">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2">
            <MapPin className="h-4 w-4 text-orange-500" />
            Order ID
          </span>
          <span className="font-medium text-gray-900">{orderId}</span>
        </div>
        {reference && (
          <div className="flex items-center justify-between gap-3">
            <span>Reference</span>
            <span className="font-medium text-gray-900">{reference}</span>
          </div>
        )}
      </div>

      {loading && (
        <p className="mt-3 text-xs text-gray-500">
          Refreshing live order status...
        </p>
      )}
    </div>
  );
}
