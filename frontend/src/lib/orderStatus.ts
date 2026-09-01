import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  PackageCheck,
  Truck,
  type LucideIcon,
} from "lucide-react";

/**
 * Mirrors the backend OrderStatus enum (prisma/schema.prisma).
 * Unknown future statuses fall back to a neutral presentation instead of
 * crashing, per the frontend AGENTS.md order-status UI rule.
 */
export interface OrderStatusMeta {
  label: string;
  /** Progress of the live tracking bar (0-100). */
  progress: number;
  /** Badge classes for list/dashboard presentation. */
  tone: string;
  icon: LucideIcon;
}

export const ORDER_STATUS_META: Record<string, OrderStatusMeta> = {
  UNPAID: {
    label: "Awaiting payment",
    progress: 20,
    tone: "bg-amber-100 text-amber-700",
    icon: Clock3,
  },
  PENDING: {
    label: "Order pending",
    progress: 30,
    tone: "bg-sky-100 text-sky-700",
    icon: Clock3,
  },
  ACCEPTED: {
    label: "Vendor accepted",
    progress: 45,
    tone: "bg-violet-100 text-violet-700",
    icon: PackageCheck,
  },
  PREPARING: {
    label: "Preparing your meal",
    progress: 65,
    tone: "bg-orange-100 text-orange-700",
    icon: PackageCheck,
  },
  OUT_FOR_DELIVERY: {
    label: "Out for delivery",
    progress: 85,
    tone: "bg-blue-100 text-blue-700",
    icon: Truck,
  },
  DELIVERED: {
    label: "Delivered",
    progress: 100,
    tone: "bg-emerald-100 text-emerald-700",
    icon: CheckCircle2,
  },
  COMPLETED: {
    label: "Completed",
    progress: 100,
    tone: "bg-emerald-100 text-emerald-700",
    icon: CheckCircle2,
  },
  CANCELLED_CUSTOMER: {
    label: "Cancelled by you",
    progress: 0,
    tone: "bg-red-100 text-red-700",
    icon: AlertCircle,
  },
  CANCELLED_VENDOR: {
    label: "Rejected by vendor",
    progress: 0,
    tone: "bg-red-100 text-red-700",
    icon: AlertCircle,
  },
  CANCELLED_AUTO_KILL: {
    label: "Expired before acceptance",
    progress: 0,
    tone: "bg-red-100 text-red-700",
    icon: AlertCircle,
  },
  CANCELLED_ADMIN: {
    label: "Cancelled by support",
    progress: 0,
    tone: "bg-red-100 text-red-700",
    icon: AlertCircle,
  },
  DISPUTED: {
    label: "Under review",
    progress: 50,
    tone: "bg-amber-100 text-amber-700",
    icon: AlertCircle,
  },
  REFUNDED: {
    label: "Refunded",
    progress: 0,
    tone: "bg-gray-200 text-gray-700",
    icon: AlertCircle,
  },
};

export const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  "DELIVERED",
  "COMPLETED",
  "REFUNDED",
  "CANCELLED_CUSTOMER",
  "CANCELLED_VENDOR",
  "CANCELLED_AUTO_KILL",
  "CANCELLED_ADMIN",
]);

export function getOrderStatusMeta(status?: string | null): OrderStatusMeta {
  const meta = status ? ORDER_STATUS_META[status] : undefined;
  return (
    meta ?? {
      label: "Processing",
      progress: 40,
      tone: "bg-gray-100 text-gray-700",
      icon: Clock3,
    }
  );
}

export function isTerminalStatus(status?: string | null): boolean {
  return status != null && TERMINAL_STATUSES.has(status);
}