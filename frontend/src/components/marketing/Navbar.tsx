"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Search, Menu, X } from "lucide-react";
import { useEffect, useRef, useState, useCallback, useSyncExternalStore } from "react";
import {
  getAccessToken,
  logout as logoutSession,
  subscribeToAuth,
} from "@/lib/api/client";
import { closeSocket } from "@/lib/socket";

interface NavbarProps {
  onSignIn?: () => void;
  onSignUp?: () => void;
}

export default function Navbar({ onSignIn, onSignUp }: NavbarProps) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const signedIn = useSyncExternalStore(
    subscribeToAuth,
    () => Boolean(getAccessToken()),
    () => false,
  );

  const handleSignOut = useCallback(async () => {
    await logoutSession();
    closeSocket();
    setMobileOpen(false);
  }, []);

  const openSearch = useCallback(() => {
    setMobileOpen(false);
    setSearchOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setQuery("");
  }, []);

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    }
  }, [searchOpen]);

  const handleSearchSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const q = query.trim();
      // A blank submit isn't a search — keep the field open and focused
      // rather than treating it as "browse all vendors".
      if (!q) {
        searchInputRef.current?.focus();
        return;
      }
      router.push(`/shop?q=${encodeURIComponent(q)}`);
      closeSearch();
    },
    [query, router, closeSearch],
  );

  return (
    <motion.nav
      className="sticky top-0 z-50 border-b border-black/6 bg-white"
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      <div className="sabiget-shell relative flex h-16 items-center">
        {/* Expanding search overlay — covers the row so it never overflows on any breakpoint */}
        {searchOpen && (
          <motion.form
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
            onSubmit={handleSearchSubmit}
            className="absolute inset-0 z-10 flex items-center gap-3 bg-white px-4 sm:px-6 lg:px-8"
            role="search"
          >
            <Search className="h-4 w-4 shrink-0 text-[#999999]" aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") closeSearch();
              }}
              placeholder="Search food, dishes or vendors..."
              className="flex-1 bg-transparent text-sm text-[#111111] outline-none placeholder:text-[#999999]"
            />
            <button
              type="submit"
              className="hidden shrink-0 rounded-full bg-[#ff4500] px-4 py-1.5 text-sm font-bold text-white transition-colors hover:bg-[#e63d00] sm:inline-flex"
            >
              Search
            </button>
            <button
              type="button"
              onClick={closeSearch}
              aria-label="Close search"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#444444] transition-colors hover:bg-black/5 hover:text-[#111111]"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.form>
        )}

        {/* Logo — left */}
        <Link href="/" className="flex items-center gap-2.5" aria-label="SabiGet home">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff4500] text-base font-black text-white shadow-[0_6px_16px_-6px_rgba(255,69,0,0.7)]">
            S
          </span>
          <span className="text-xl font-extrabold tracking-tight text-[#111111]">
            SabiGet
          </span>
        </Link>

        {/* Center nav links */}
        <div className="hidden flex-1 items-center justify-center gap-7 md:flex">
          <Link
            href="/#vendors"
            className="text-sm font-medium text-[#444444] transition-colors hover:text-[#111111]"
          >
            Vendors
          </Link>
          <Link
            href="/#how-it-works"
            className="text-sm font-medium text-[#444444] transition-colors hover:text-[#111111]"
          >
            How it works
          </Link>
          <Link
            href="/#for-vendors"
            className="text-sm font-medium text-[#444444] transition-colors hover:text-[#111111]"
          >
            For vendors
          </Link>
          <Link
            href="/orders"
            className="text-sm font-medium text-[#444444] transition-colors hover:text-[#111111]"
          >
            Orders
          </Link>
        </div>

        {/* Right actions */}
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <button
            type="button"
            onClick={openSearch}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#444444] transition-colors hover:bg-black/5 hover:text-[#111111]"
            aria-label="Search food, dishes or vendors"
          >
            <Search className="h-4 w-4" />
          </button>
          {signedIn ? (
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-full px-4 py-2 text-sm font-medium text-[#444444] transition-colors hover:bg-black/5 hover:text-[#111111]"
            >
              Sign out
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onSignIn}
                className="rounded-full px-4 py-2 text-sm font-medium text-[#444444] transition-colors hover:text-[#111111]"
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={onSignUp}
                className="rounded-full bg-[#ff4500] px-5 py-2 text-sm font-bold text-white shadow-[0_6px_16px_-6px_rgba(255,69,0,0.7)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#e63d00]"
              >
                Sign up
              </button>
            </>
          )}
        </div>

        {/* Mobile actions — search + menu */}
        <div className="ml-auto flex items-center gap-1 md:hidden">
          <button
            type="button"
            onClick={openSearch}
            className="flex h-10 w-10 items-center justify-center rounded-full text-[#444444] transition-colors hover:bg-black/5"
            aria-label="Search food, dishes or vendors"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchOpen(false);
              setMobileOpen(!mobileOpen);
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full text-[#444444] transition-colors hover:bg-black/5"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-black/6 bg-white md:hidden"
        >
          <div className="sabiget-shell space-y-1 py-4">
            <Link
              href="/#vendors"
              onClick={() => setMobileOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-medium text-[#444444] transition-colors hover:bg-black/5 hover:text-[#111111]"
            >
              Vendors
            </Link>
            <Link
              href="/#how-it-works"
              onClick={() => setMobileOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-medium text-[#444444] transition-colors hover:bg-black/5 hover:text-[#111111]"
            >
              How it works
            </Link>
            <Link
              href="/#for-vendors"
              onClick={() => setMobileOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-medium text-[#444444] transition-colors hover:bg-black/5 hover:text-[#111111]"
            >
              For vendors
            </Link>
            <Link
              href="/orders"
              onClick={() => setMobileOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-medium text-[#444444] transition-colors hover:bg-black/5 hover:text-[#111111]"
            >
              Orders
            </Link>
            <div className="border-t border-black/6 pt-3 mt-3">
              {signedIn ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[#444444] transition-colors hover:bg-black/5 hover:text-[#111111]"
                >
                  Sign out
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      onSignIn?.();
                    }}
                    className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[#444444] transition-colors hover:bg-black/5 hover:text-[#111111]"
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      onSignUp?.();
                    }}
                    className="rounded-full bg-[#ff4500] px-5 py-2.5 text-center text-sm font-bold text-white shadow-[0_6px_16px_-6px_rgba(255,69,0,0.7)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#e63d00]"
                  >
                    Sign up
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </motion.nav>
  );
}
