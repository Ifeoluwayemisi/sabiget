"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Phone, Lock, Mail } from "lucide-react";

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 300, damping: 30 },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.2 },
  },
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const tabVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3 },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: { duration: 0.2 },
  },
};

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [tab, setTab] = useState<"guest" | "member" | "vendor">("guest");
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const handlePhoneSubmit = async () => {
    if (!phone) return;
    setLoading(true);
    try {
      // Call backend to send OTP
      const response = await fetch("/api/v1/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      if (response.ok) {
        setStep("otp");
      }
    } catch (error) {
      console.error("Failed to send OTP:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async () => {
    if (!otp) return;
    setLoading(true);
    try {
      const response = await fetch("/api/v1/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: otp }),
      });
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);
        onClose();
      }
    } catch (error) {
      console.error("Failed to verify OTP:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/50 z-40"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-50"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">
                  Welcome to Sabiget
                </h2>
                <button
                  onClick={onClose}
                  className="text-white hover:bg-white/20 p-2 rounded-lg transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b">
                {(["guest", "member", "vendor"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setTab(t);
                      setStep("phone");
                      setPhone("");
                      setOtp("");
                    }}
                    className={`flex-1 px-4 py-3 font-semibold transition-all ${
                      tab === t
                        ? "text-orange-600 border-b-2 border-orange-600 bg-orange-50"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="p-6">
                <AnimatePresence mode="wait">
                  {tab === "guest" && (
                    <motion.div
                      key="guest"
                      variants={tabVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                    >
                      <div className="space-y-4">
                        <p className="text-gray-600 text-sm mb-6">
                          Browse and order without creating an account. No
                          password needed!
                        </p>

                        {step === "phone" && (
                          <div className="space-y-4">
                            <div className="relative">
                              <Phone className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                              <input
                                type="tel"
                                placeholder="+2348123456789"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                              />
                            </div>
                            <button
                              onClick={handlePhoneSubmit}
                              disabled={loading || !phone}
                              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white py-3 rounded-lg font-semibold transition"
                            >
                              {loading ? "Sending..." : "Send OTP"}
                            </button>
                          </div>
                        )}

                        {step === "otp" && (
                          <div className="space-y-4">
                            <p className="text-sm text-gray-600">
                              Enter the code sent to {phone}
                            </p>
                            <input
                              type="text"
                              placeholder="000000"
                              value={otp}
                              onChange={(e) =>
                                setOtp(e.target.value.slice(0, 6))
                              }
                              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none text-center text-2xl font-bold tracking-widest"
                            />
                            <button
                              onClick={handleOtpSubmit}
                              disabled={loading || !otp}
                              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white py-3 rounded-lg font-semibold transition"
                            >
                              {loading ? "Verifying..." : "Verify & Continue"}
                            </button>
                            <button
                              onClick={() => setStep("phone")}
                              className="w-full text-orange-600 hover:text-orange-700 py-2 font-semibold"
                            >
                              Change Number
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {tab === "member" && (
                    <motion.div
                      key="member"
                      variants={tabVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                    >
                      <div className="space-y-4">
                        <p className="text-gray-600 text-sm mb-6">
                          Create an account to save addresses and enjoy loyalty
                          rewards
                        </p>
                        <div className="relative">
                          <Phone className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                          <input
                            type="tel"
                            placeholder="+2348123456789"
                            className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                          />
                        </div>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                          <input
                            type="password"
                            placeholder="Password"
                            className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                          />
                        </div>
                        <button className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold transition">
                          Create Account
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {tab === "vendor" && (
                    <motion.div
                      key="vendor"
                      variants={tabVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                    >
                      <div className="space-y-4">
                        <p className="text-gray-600 text-sm mb-6">
                          Register your business and start selling on Sabiget
                        </p>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                          <input
                            type="email"
                            placeholder="business@example.com"
                            className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                          />
                        </div>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                          <input
                            type="password"
                            placeholder="Password"
                            className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                          />
                        </div>
                        <input
                          type="text"
                          placeholder="Business Name"
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                        />
                        <button className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold transition">
                          Register Vendor Account
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
