"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { MotionConfig } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import Navbar from "@/components/marketing/Navbar";
import HeroSection from "@/components/marketing/HeroSection";
import PopularCategories from "@/components/marketing/PopularCategories";
import HowItWorks from "@/components/marketing/HowItWorks";
import FeaturedVendors from "@/components/marketing/FeaturedVendors";
import WhySabiGet from "@/components/marketing/WhySabiGet";
import VendorAcquisition from "@/components/marketing/VendorAcquisition";
import SocialFooter from "@/components/marketing/SocialFooter";
import AuthModal from "@/components/auth/AuthModal";
import MenuModal from "@/components/cart/MenuModal";
import OrderStatusCard from "@/components/order/OrderStatusCard";
import {
  getAccessToken,
} from "@/lib/api/client";
import { getLatestOrderId, subscribeToLatestOrder } from "@/lib/orderTracker";

export default function HomePage() {
  const router = useRouter();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authIntent, setAuthIntent] = useState<"signin" | "create" | undefined>(undefined);
  const signedIn = useSyncExternalStore(
    () => () => {},
    () => Boolean(getAccessToken()),
    () => false,
  );
  const [selectedVendor, setSelectedVendor] = useState<{
    id: string | null;
    name: string;
  } | null>(null);
  const [liveOrderId, setLiveOrderId] = useState<string | null>(() =>
    getLatestOrderId(),
  );

  useEffect(() => {
    return subscribeToLatestOrder(() => {
      setLiveOrderId(getLatestOrderId());
    });
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <Navbar
        onSignIn={() => { setAuthIntent("signin"); setIsAuthOpen(true); }}
        onSignUp={() => { setAuthIntent("create"); setIsAuthOpen(true); }}
      />

      <HeroSection />

      <PopularCategories />

      <HowItWorks />

      <FeaturedVendors />

      {liveOrderId && (
        <section className="bg-white pb-4 pt-2">
          <div className="sabiget-shell max-w-3xl">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff4500]">
                  Live order
                </p>
                <h3 className="mt-1 text-2xl font-extrabold tracking-tight text-[#111111]">
                  Your order is being tracked
                </h3>
              </div>
              <Link
                href="/orders"
                className="inline-flex shrink-0 items-center gap-1.5 text-sm font-bold text-[#e63d00] hover:underline"
              >
                All orders
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <OrderStatusCard orderId={liveOrderId} />
          </div>
        </section>
      )}

      <WhySabiGet />

      <VendorAcquisition />

      <SocialFooter />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={() => router.push("/shop")}
        initialIntent={authIntent}
      />
      <MenuModal
        isOpen={Boolean(selectedVendor)}
        vendorId={selectedVendor?.id || null}
        vendorName={selectedVendor?.name || "Vendor"}
        onClose={() => setSelectedVendor(null)}
      />
    </MotionConfig>
  );
}
