"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Phone, Lock, Mail } from "lucide-react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

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

interface Feedback {
  type: "error" | "success";
  text: string;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [tab, setTab] = useState<"guest" | "member" | "vendor">("guest");
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [memberForm, setMemberForm] = useState({
    phone: "",
    password: "",
    name: "",
    email: "",
  });
  const [vendorForm, setVendorForm] = useState({
    email: "",
    password: "",
    businessName: "",
    businessPhone: "",
  });

  const resetTabState = (nextTab: "guest" | "member" | "vendor") => {
    setTab(nextTab);
    setStep("phone");
    setOtp("");
    setFeedback(null);
    if (nextTab === "guest") {
      setPhone("");
    }
  };

  const storeTokens = (payload: {
    accessToken?: string;
    refreshToken?: string;
    user?: unknown;
  }) => {
    if (payload.accessToken) {
      localStorage.setItem("accessToken", payload.accessToken);
    }
    if (payload.refreshToken) {
      localStorage.setItem("refreshToken", payload.refreshToken);
    }
    if (payload.user) {
      localStorage.setItem("currentUser", JSON.stringify(payload.user));
    }
  };

  const handlePhoneSubmit = async () => {
    if (!phone) {
      setFeedback({ type: "error", text: "Please enter your phone number." });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to send OTP");
      }

      setStep("otp");
      setFeedback({
        type: "success",
        text: data.message || "OTP sent successfully.",
      });
    } catch (error) {
      console.error("Failed to send OTP:", error);
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to send OTP.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async () => {
    if (!otp) {
      setFeedback({
        type: "error",
        text: "Please enter the OTP sent to your phone.",
      });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: otp }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "OTP verification failed");
      }

      storeTokens(data);
      setFeedback({ type: "success", text: "You are signed in successfully." });
      onClose();
    } catch (error) {
      console.error("Failed to verify OTP:", error);
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to verify OTP.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMemberLogin = async () => {
    if (!memberForm.phone || !memberForm.password) {
      setFeedback({
        type: "error",
        text: "Phone number and password are required.",
      });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: memberForm.phone,
          password: memberForm.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Member login failed");
      }

      storeTokens(data);
      setFeedback({ type: "success", text: "Member login successful." });
      onClose();
    } catch (error) {
      console.error("Member login failed:", error);
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Member login failed.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVendorLogin = async () => {
    if (!vendorForm.email || !vendorForm.password) {
      setFeedback({
        type: "error",
        text: "Email and password are required.",
      });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/vendor/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: vendorForm.email,
          password: vendorForm.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Vendor login failed");
      }

      storeTokens(data);
      setFeedback({ type: "success", text: "Vendor login successful." });
      onClose();
    } catch (error) {
      console.error("Vendor login failed:", error);
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Vendor login failed.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/50"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
          />

          <motion.div
            className="fixed left-1/2 top-1/2 z-50 w-[92%] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 shadow-2xl"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">
                  Welcome
                </p>
                <h2 className="mt-1 text-2xl font-bold text-gray-900">
                  Sign in to SabiGet
                </h2>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 flex rounded-xl bg-gray-100 p-1">
              {(["guest", "member", "vendor"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => resetTabState(mode)}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold capitalize transition ${
                    tab === mode
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {tab === "guest" && (
                <motion.div
                  key="guest"
                  variants={tabVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="mt-5 space-y-4"
                >
                  {step === "phone" ? (
                    <>
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-gray-700">
                          Phone number
                        </span>
                        <div className="flex items-center gap-3 rounded-xl border border-gray-300 px-3 py-3 focus-within:border-orange-500">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <input
                            type="tel"
                            value={phone}
                            onChange={(event) => setPhone(event.target.value)}
                            className="w-full border-0 bg-transparent text-sm outline-none"
                            placeholder="+2348123456789"
                          />
                        </div>
                      </label>

                      <button
                        onClick={handlePhoneSubmit}
                        disabled={loading}
                        className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white disabled:bg-gray-300"
                      >
                        {loading ? "Sending..." : "Send OTP"}
                      </button>
                    </>
                  ) : (
                    <>
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-gray-700">
                          Enter OTP
                        </span>
                        <div className="flex items-center gap-3 rounded-xl border border-gray-300 px-3 py-3 focus-within:border-orange-500">
                          <Lock className="h-4 w-4 text-gray-400" />
                          <input
                            type="text"
                            value={otp}
                            onChange={(event) => setOtp(event.target.value)}
                            className="w-full border-0 bg-transparent text-center text-2xl font-bold tracking-[0.4em] outline-none"
                            placeholder="000000"
                          />
                        </div>
                      </label>

                      <button
                        onClick={handleOtpSubmit}
                        disabled={loading}
                        className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white disabled:bg-gray-300"
                      >
                        {loading ? "Verifying..." : "Verify & Continue"}
                      </button>
                    </>
                  )}
                </motion.div>
              )}

              {tab === "member" && (
                <motion.div
                  key="member"
                  variants={tabVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="mt-5 space-y-4"
                >
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-gray-700">
                      Full name
                    </span>
                    <input
                      value={memberForm.name}
                      onChange={(event) =>
                        setMemberForm((prev) => ({
                          ...prev,
                          name: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm outline-none focus:border-orange-500"
                      placeholder="Ada Okafor"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-gray-700">
                      Phone number
                    </span>
                    <input
                      value={memberForm.phone}
                      onChange={(event) =>
                        setMemberForm((prev) => ({
                          ...prev,
                          phone: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm outline-none focus:border-orange-500"
                      placeholder="+2348123456789"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-gray-700">
                      Email
                    </span>
                    <div className="flex items-center gap-3 rounded-xl border border-gray-300 px-3 py-3 focus-within:border-orange-500">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <input
                        type="email"
                        value={memberForm.email}
                        onChange={(event) =>
                          setMemberForm((prev) => ({
                            ...prev,
                            email: event.target.value,
                          }))
                        }
                        className="w-full border-0 bg-transparent text-sm outline-none"
                        placeholder="you@email.com"
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-gray-700">
                      Password
                    </span>
                    <div className="flex items-center gap-3 rounded-xl border border-gray-300 px-3 py-3 focus-within:border-orange-500">
                      <Lock className="h-4 w-4 text-gray-400" />
                      <input
                        type="password"
                        value={memberForm.password}
                        onChange={(event) =>
                          setMemberForm((prev) => ({
                            ...prev,
                            password: event.target.value,
                          }))
                        }
                        className="w-full border-0 bg-transparent text-sm outline-none"
                        placeholder="••••••••"
                      />
                    </div>
                  </label>

                  <button
                    onClick={handleMemberLogin}
                    disabled={loading}
                    className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white disabled:bg-gray-300"
                  >
                    {loading ? "Signing in..." : "Continue with member account"}
                  </button>
                </motion.div>
              )}

              {tab === "vendor" && (
                <motion.div
                  key="vendor"
                  variants={tabVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="mt-5 space-y-4"
                >
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-gray-700">
                      Business name
                    </span>
                    <input
                      value={vendorForm.businessName}
                      onChange={(event) =>
                        setVendorForm((prev) => ({
                          ...prev,
                          businessName: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm outline-none focus:border-orange-500"
                      placeholder="Buka & Flame"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-gray-700">
                      Business phone
                    </span>
                    <input
                      value={vendorForm.businessPhone}
                      onChange={(event) =>
                        setVendorForm((prev) => ({
                          ...prev,
                          businessPhone: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm outline-none focus:border-orange-500"
                      placeholder="+2348123456789"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-gray-700">
                      Email
                    </span>
                    <div className="flex items-center gap-3 rounded-xl border border-gray-300 px-3 py-3 focus-within:border-orange-500">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <input
                        type="email"
                        value={vendorForm.email}
                        onChange={(event) =>
                          setVendorForm((prev) => ({
                            ...prev,
                            email: event.target.value,
                          }))
                        }
                        className="w-full border-0 bg-transparent text-sm outline-none"
                        placeholder="vendor@business.com"
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-gray-700">
                      Password
                    </span>
                    <div className="flex items-center gap-3 rounded-xl border border-gray-300 px-3 py-3 focus-within:border-orange-500">
                      <Lock className="h-4 w-4 text-gray-400" />
                      <input
                        type="password"
                        value={vendorForm.password}
                        onChange={(event) =>
                          setVendorForm((prev) => ({
                            ...prev,
                            password: event.target.value,
                          }))
                        }
                        className="w-full border-0 bg-transparent text-sm outline-none"
                        placeholder="••••••••"
                      />
                    </div>
                  </label>

                  <button
                    onClick={handleVendorLogin}
                    disabled={loading}
                    className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white disabled:bg-gray-300"
                  >
                    {loading ? "Signing in..." : "Continue with vendor account"}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {feedback && (
              <div
                className={`mt-5 rounded-xl border px-3 py-2 text-sm ${
                  feedback.type === "success"
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {feedback.text}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
