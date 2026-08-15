"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Hero from "@/components/landing/Hero";
import HowItWorks from "@/components/landing/HowItWorks";
import AuthModal from "@/components/auth/AuthModal";
import VendorCard from "@/components/landing/VendorCard";
import Footer from "@/components/layout/Footer";
import MenuModal from "@/components/cart/MenuModal";
import OrderStatusCard from "@/components/order/OrderStatusCard";
import { API_BASE_URL } from "@/lib/api/client";
import {
  sampleVendors,
  type VendorCardData,
} from "@/features/home/data/vendors";

export default function HomePage() {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<{
    id: string | null;
    name: string;
  } | null>(null);
  const [vendors, setVendors] = useState<VendorCardData[]>(sampleVendors);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [liveOrderId, setLiveOrderId] = useState<string | null>(null);

  useEffect(() => {
    const syncLiveOrder = () => {
      setLiveOrderId(localStorage.getItem("latestOrderId"));
    };

    syncLiveOrder();
    window.addEventListener("storage", syncLiveOrder);

    return () => {
      window.removeEventListener("storage", syncLiveOrder);
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      setVendors(sampleVendors);
      return;
    }

    const fetchNearbyVendors = async () => {
      setLoadingVendors(true);

      try {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const { latitude, longitude } = position.coords;
              const response = await fetch(
                `${API_BASE_URL}/customers/nearby-vendors?latitude=${latitude}&longitude=${longitude}&radius=5`,
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                },
              );

              if (!response.ok) {
                setVendors(sampleVendors);
                return;
              }

              const data = await response.json();
              const mapped = (data.vendors || []).map((vendor: any) => ({
                name: vendor.name,
                image:
                  vendor.bannerImage ||
                  vendor.logo ||
                  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=250&fit=crop",
                rating: Number(vendor.averageRating || 4.5),
                reviews: Number(vendor.totalReviews || 0),
                distance: `${Number(vendor.distanceKm || 0).toFixed(1)} km`,
                deliveryTime: `${vendor.estimatedDeliveryMinutes || 30} mins`,
                category: vendor.lga || "Local",
              }));

              setVendors(mapped.length > 0 ? mapped : sampleVendors);
            },
            () => setVendors(sampleVendors),
            { enableHighAccuracy: true, timeout: 10000 },
          );
        } else {
          setVendors(sampleVendors);
        }
      } catch (error) {
        console.error("Nearby vendors fetch failed:", error);
        setVendors(sampleVendors);
      } finally {
        setLoadingVendors(false);
      }
    };

    fetchNearbyVendors();
  }, []);

  return (
    <>
      <motion.nav
        className="sticky top-0 z-40 border-b border-gray-100 backdrop-blur-md bg-white/80"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-3xl">🍽️</span>
            <span className="font-black text-2xl text-gray-900">SabiGet</span>
          </div>

          <motion.button
            onClick={() => setIsAuthOpen(true)}
            className="px-6 py-2 bg-linear-to-r from-orange-500 to-amber-600 text-white font-bold rounded-lg hover:shadow-lg transition-all duration-300"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Sign In
          </motion.button>
        </div>
      </motion.nav>

      <Hero onGetStarted={() => setIsAuthOpen(true)} />

      <section className="py-20 px-4 bg-gray-50">
        <motion.div
          className="max-w-6xl mx-auto"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <motion.div
            className="mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Featured Vendors Near You
            </h2>
            <p className="text-xl text-gray-600">
              Browse top-rated local vendors and get your favorite meals
              delivered fast
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {vendors.map((vendor, idx) => (
              <motion.div
                key={`${vendor.name}-${idx}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1, duration: 0.5 }}
              >
                <div
                  onClick={() =>
                    setSelectedVendor({
                      id: `vendor-${idx}`,
                      name: vendor.name,
                    })
                  }
                >
                  <VendorCard {...vendor} />
                </div>
              </motion.div>
            ))}
          </div>

          {loadingVendors && (
            <div className="mt-6 text-center text-sm text-gray-500">
              Finding vendors near you...
            </div>
          )}

          <motion.div
            className="mt-12 text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <motion.button
              onClick={() => setIsAuthOpen(true)}
              className="px-8 py-4 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 transform hover:scale-105 transition-all duration-300"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Browse All Vendors →
            </motion.button>
          </motion.div>
        </motion.div>
      </section>

      <HowItWorks />

      <section className="py-20 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-500">
              Live order tracking
            </p>
            <h3 className="mt-3 text-3xl md:text-4xl font-bold text-gray-900">
              Track every order from checkout to delivery
            </h3>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {liveOrderId ? (
              <OrderStatusCard orderId={liveOrderId} />
            ) : (
              <>
                <OrderStatusCard
                  orderId="demo-order-1001"
                  vendorName="Buka & Flame"
                  totalAmount={11800}
                  reference="SG-ORD-1001"
                />
                <OrderStatusCard
                  orderId="demo-order-1002"
                  vendorName="Pepper Pot Express"
                  totalAmount={8700}
                  reference="SG-ORD-1002"
                />
              </>
            )}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 bg-linear-to-r from-orange-500 to-amber-600 relative overflow-hidden">
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Ready to enjoy your next meal?
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Sign in with just your phone number. No password needed. Browse
            vendors, order securely, and verify every delivery.
          </p>
          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <motion.button
              onClick={() => setIsAuthOpen(true)}
              className="px-8 py-4 bg-white text-orange-600 font-bold rounded-lg hover:bg-gray-100 transform hover:scale-105 transition-all duration-300 text-lg"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              🚀 Get Started
            </motion.button>
            <motion.button
              className="px-8 py-4 bg-white/20 text-white font-bold border-2 border-white rounded-lg hover:bg-white/30 transform hover:scale-105 transition-all duration-300 text-lg backdrop-blur-sm"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Learn More
            </motion.button>
          </motion.div>
        </div>
      </section>

      <Footer />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <MenuModal
        isOpen={Boolean(selectedVendor)}
        vendorId={selectedVendor?.id || null}
        vendorName={selectedVendor?.name || "Vendor"}
        onClose={() => setSelectedVendor(null)}
      />
    </>
  );
}
