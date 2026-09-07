"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Phone,
  Mail,
  Lock,
  User,
  ArrowLeft,
  LogIn,
  UserPlus,
  ShoppingBag,
} from "lucide-react";
import { apiRequest, storeAuthPayload } from "@/lib/api/client";

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

const panelVariants = {
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

type Intent = "signin" | "create" | "guest";
type Step = "choose" | "phone" | "otp" | "details";

const PHONE_REGEX = /^(\+234|0)[789]\d{9}$/;

const INTENT_COPY: Record<
  Intent,
  { title: string; caption: string }
> = {
  signin: {
    title: "Sign in to SabiGet",
    caption: "Enter your phone number and we'll send a verification code.",
  },
  create: {
    title: "Create your SabiGet account",
    caption:
      "Verify your phone, then finish setting up your account in a few seconds.",
  },
  guest: {
    title: "Continue as a guest",
    caption: "Order without creating an account. We'll just verify your phone.",
  },
};

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [intent, setIntent] = useState<Intent | null>(null);
  const [step, setStep] = useState<Step>("choose");
  const [phone, setPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [otp, setOtp] = useState("");
  // Phone number the currently displayed OTP belongs to. Verification is bound
  // to this number, not the (possibly edited) input, so changing the phone
  // after AI/expired OTP always moves to a fresh code for the new number.
  const [otpSentFor, setOtpSentFor] = useState<string | null>(null);
  const [otpHint, setOtpHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const storeTokens = storeAuthPayload;

  // Reset the whole flow every time the modal opens so a previous session's
  // phone/OTP/session state can never leak into the next attempt. Adjusting
  // state while rendering (React's documented pattern for reacting to a
  // changing prop) beats an effect here: it resets before first paint and
  // avoids a cascading-render lint error.
  const [prevOpen, setPrevOpen] = useState(isOpen);
  if (prevOpen !== isOpen) {
    setPrevOpen(isOpen);
    if (isOpen) {
      setIntent(null);
      setStep("choose");
      setPhone("");
      setGuestEmail("");
      setOtp("");
      setOtpSentFor(null);
      setOtpHint(null);
      setFeedback(null);
      setCreateForm({ name: "", email: "", password: "" });
    }
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const chooseIntent = (nextIntent: Intent) => {
    setIntent(nextIntent);
    setStep("phone");
  };

  const goToPhone = () => {
    setStep("phone");
    setOtp("");
    setOtpSentFor(null);
    setOtpHint(null);
    setFeedback(null);
  };

  const requestOtp = async (targetPhone: string, email?: string) => {
    const response = await apiRequest("/auth/send-otp", {
      method: "POST",
      body: JSON.stringify({
        phone: targetPhone,
        ...(email ? { email } : {}),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "Unable to send OTP");
    }
    return data;
  };

  const handleSendOtp = async () => {
    if (!PHONE_REGEX.test(phone)) {
      setFeedback({
        type: "error",
        text: "Enter a valid Nigerian phone number, e.g. +2348123456789.",
      });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const data = await requestOtp(
        phone,
        intent === "guest" ? guestEmail : undefined,
      );
      setOtp("");
      setOtpSentFor(phone);
      // In development the code arrives on the server console; surface the
      // backend's explicit hint instead of hiding that delivery channel.
      setOtpHint(data.hint || data.message || null);
      setStep("otp");
      setFeedback({
        type: "success",
        text: "Verification code sent.",
      });
    } catch (error) {
      console.error("Failed to send OTP:", error);
      setFeedback({
        type: "error",
        text:
          error instanceof Error ? error.message : "Failed to send OTP.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!otpSentFor) return;
    setLoading(true);
    setFeedback(null);
    try {
      const data = await requestOtp(
        otpSentFor,
        intent === "guest" ? guestEmail : undefined,
      );
      setOtpHint(data.hint || data.message || otpHint);
      setFeedback({
        type: "success",
        text: "A new verification code has been sent.",
      });
    } catch (error) {
      console.error("Failed to resend OTP:", error);
      setFeedback({
        type: "error",
        text:
          error instanceof Error ? error.message : "Failed to resend OTP.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length < 6) {
      setFeedback({
        type: "error",
        text: "Enter the complete 6-digit verification code.",
      });
      return;
    }
    if (!otpSentFor) {
      setFeedback({
        type: "error",
        text: "No verification code was requested yet.",
      });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const response = await apiRequest("/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ phone: otpSentFor, code: otp }),
      });
      const data = await response.json();

      if (!response.ok) {
        const error = new Error(
          data.message || "OTP verification failed",
        ) as Error & { attemptsRemaining?: number };
        if (typeof data.attemptsRemaining === "number") {
          error.attemptsRemaining = data.attemptsRemaining;
        }
        throw error;
      }

      storeTokens(data);

      if (intent === "create") {
        setStep("details");
      } else {
        setFeedback({
          type: "success",
          text: "You're ready to order.",
        });
        onClose();
      }
    } catch (error) {
      console.error("Failed to verify OTP:", error);
      const message =
        error instanceof Error ? error.message : "Failed to verify OTP.";
      const attempts = (error as { attemptsRemaining?: number })
        .attemptsRemaining;
      setFeedback({
        type: "error",
        text:
          attempts !== undefined && attempts > 0
            ? `${message} You have ${attempts} attempt${
                attempts === 1 ? "" : "s"
              } left.`
            : message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!createForm.name.trim()) {
      setFeedback({ type: "error", text: "Please enter your full name." });
      return;
    }
    if (createForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createForm.email)) {
      setFeedback({ type: "error", text: "Enter a valid email address." });
      return;
    }
    if (createForm.password.length < 8) {
      setFeedback({
        type: "error",
        text: "Password must be at least 8 characters.",
      });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const response = await apiRequest("/auth/create-account", {
        method: "POST",
        body: JSON.stringify(createForm),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create account");
      }

      storeTokens(data);
      setFeedback({ type: "success", text: data.message || "Account created." });
      onClose();
    } catch (error) {
      console.error("Failed to create account:", error);
      const message =
        error instanceof Error ? error.message : "Failed to create account.";
      // The OTP already logged this phone in as a MEMBER; avoid a confusing
      // dead end and nudge the user back to Sign in.
      if (/already (a )?member/i.test(message)) {
        setFeedback({
          type: "error",
          text: "This phone already has an account. Please Sign in instead.",
        });
      } else {
        setFeedback({ type: "error", text: message });
      }
    } finally {
      setLoading(false);
    }
  };

  const renderPhoneStep = () => (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-gray-700">
          Phone number
        </span>
        <div className="flex items-center gap-3 rounded-xl border border-gray-300 px-3 py-3 focus-within:border-orange-500">
          <Phone className="h-4 w-4 text-gray-400" />
          <input
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="w-full border-0 bg-transparent text-sm outline-none"
            placeholder="+2348123456789"
          />
        </div>
      </label>

      <AnimatePresence initial={false}>
        {intent === "guest" && (
          <motion.label
            key="guest-email-field"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="block"
          >
            <span className="mb-2 block text-sm font-medium text-gray-700">
              Email (optional)
            </span>
            <div className="flex items-center gap-3 rounded-xl border border-gray-300 px-3 py-3 focus-within:border-orange-500">
              <Mail className="h-4 w-4 text-gray-400" />
              <input
                type="email"
                autoComplete="email"
                value={guestEmail}
                onChange={(event) => setGuestEmail(event.target.value)}
                className="w-full border-0 bg-transparent text-sm outline-none"
                placeholder="you@email.com"
              />
            </div>
            <span className="mt-1 block text-xs text-gray-400">
              Used if we cannot reach you on WhatsApp.
            </span>
          </motion.label>
        )}
      </AnimatePresence>

      <button
        onClick={handleSendOtp}
        disabled={loading}
        className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white disabled:bg-gray-300"
      >
        {loading ? "Sending..." : "Send verification code"}
      </button>

      <button
        type="button"
        onClick={() => {
          setIntent(null);
          setStep("choose");
          setFeedback(null);
        }}
        className="flex w-full items-center justify-center gap-1 rounded-xl px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>
    </div>
  );

  const renderOtpStep = () => (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        We sent a verification code to{" "}
        <span className="font-semibold text-gray-900">{otpSentFor}</span>.
      </p>

      {otpHint && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {otpHint}
        </p>
      )}

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-gray-700">
          Enter verification code
        </span>
        <div className="flex items-center gap-3 rounded-xl border border-gray-300 px-3 py-3 focus-within:border-orange-500">
          <Lock className="h-4 w-4 text-gray-400" />
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
            className="w-full border-0 bg-transparent text-center text-2xl font-bold tracking-[0.4em] outline-none"
            placeholder="000000"
            maxLength={6}
          />
        </div>
      </label>

      <button
        onClick={handleVerifyOtp}
        disabled={loading}
        className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white disabled:bg-gray-300"
      >
        {loading ? "Verifying..." : "Verify & Continue"}
      </button>

      <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 text-sm">
        <button
          type="button"
          onClick={goToPhone}
          className="flex items-center gap-1 font-medium text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Change phone number
        </button>
        <button
          type="button"
          onClick={handleResendOtp}
          disabled={loading}
          className="font-medium text-orange-500 disabled:text-gray-300"
        >
          Resend code
        </button>
      </div>
    </div>
  );

  const renderDetailsStep = () => (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-gray-700">
          Full name
        </span>
        <div className="flex items-center gap-3 rounded-xl border border-gray-300 px-3 py-3 focus-within:border-orange-500">
          <User className="h-4 w-4 text-gray-400" />
          <input
            type="text"
            autoComplete="name"
            value={createForm.name}
            onChange={(event) =>
              setCreateForm((prev) => ({ ...prev, name: event.target.value }))
            }
            className="w-full border-0 bg-transparent text-sm outline-none"
            placeholder="Ada Okafor"
          />
        </div>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-gray-700">
          Email
        </span>
        <div className="flex items-center gap-3 rounded-xl border border-gray-300 px-3 py-3 focus-within:border-orange-500">
          <Mail className="h-4 w-4 text-gray-400" />
          <input
            type="email"
            autoComplete="email"
            value={createForm.email}
            onChange={(event) =>
              setCreateForm((prev) => ({ ...prev, email: event.target.value }))
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
            autoComplete="new-password"
            value={createForm.password}
            onChange={(event) =>
              setCreateForm((prev) => ({
                ...prev,
                password: event.target.value,
              }))
            }
            className="w-full border-0 bg-transparent text-sm outline-none"
            placeholder="At least 8 characters"
          />
        </div>
        <span className="mt-1 block text-xs text-gray-400">
          {"You'll use this to sign in next time."}
        </span>
      </label>

      <button
        onClick={handleCreateAccount}
        disabled={loading}
        className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white disabled:bg-gray-300"
      >
        {loading ? "Creating account..." : "Create account"}
      </button>

      <button
        type="button"
        onClick={goToPhone}
        className="flex w-full items-center justify-center gap-1 rounded-xl px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Change phone number
      </button>
    </div>
  );

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
            role="dialog"
            aria-modal="true"
            aria-label={intent ? INTENT_COPY[intent].title : "SabiGet access"}
            className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[92%] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">
                  {intent && step !== "choose" ? "SabiGet" : "Welcome"}
                </p>
                <h2 className="mt-1 text-2xl font-bold text-gray-900">
                  {intent && step !== "choose"
                    ? INTENT_COPY[intent].title
                    : "Continue to SabiGet"}
                </h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <AnimatePresence mode="wait">
              {step === "choose" && (
                <motion.div
                  key="choose"
                  variants={panelVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="mt-5 space-y-3"
                >
                  <button
                    type="button"
                    onClick={() => chooseIntent("signin")}
                    className="group flex w-full items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-left hover:border-orange-500"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-500 group-hover:bg-orange-100">
                      <LogIn className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-gray-900">
                        Sign in
                      </span>
                      <span className="block text-xs text-gray-500">
                        I already have a SabiGet account.
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => chooseIntent("create")}
                    className="group flex w-full items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-left hover:border-orange-500"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-500 group-hover:bg-orange-100">
                      <UserPlus className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-gray-900">
                        Create account
                      </span>
                      <span className="block text-xs text-gray-500">
                        Save my orders, earn rewards, and sign in faster.
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => chooseIntent("guest")}
                    className="group flex w-full items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-left hover:border-orange-500"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-500 group-hover:bg-orange-100">
                      <ShoppingBag className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-gray-900">
                        Continue as a guest
                      </span>
                      <span className="block text-xs text-gray-500">
                        Shop now; you can create an account later.
                      </span>
                    </span>
                  </button>

                  <p className="pt-2 text-center text-sm text-gray-500">
                    Run a restaurant?{" "}
                    <Link
                      href="/vendor-dashboard"
                      onClick={onClose}
                      className="font-semibold text-orange-500 hover:underline"
                    >
                      Become a SabiGet vendor
                    </Link>
                  </p>
                </motion.div>
              )}

              {step === "phone" && (
                <motion.div
                  key="phone"
                  variants={panelVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="mt-5"
                >
                  {intent && (
                    <p className="mb-4 text-sm text-gray-500">
                      {INTENT_COPY[intent].caption}
                    </p>
                  )}
                  {renderPhoneStep()}
                </motion.div>
              )}

              {step === "otp" && (
                <motion.div
                  key="otp"
                  variants={panelVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="mt-5"
                >
                  {renderOtpStep()}
                </motion.div>
              )}

              {step === "details" && (
                <motion.div
                  key="details"
                  variants={panelVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="mt-5"
                >
                  <p className="mb-4 text-sm text-gray-500">
                    One last step — choose your account details.
                  </p>
                  {renderDetailsStep()}
                </motion.div>
              )}
            </AnimatePresence>

            {feedback && (
              <div
                role="alert"
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