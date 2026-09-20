import Link from "next/link";
import { Instagram, Twitter, Facebook, Music2 } from "lucide-react";

const socialLinks = [
  { label: "Instagram", href: "https://instagram.com", Icon: Instagram },
  { label: "Twitter", href: "https://twitter.com", Icon: Twitter },
  { label: "Facebook", href: "https://facebook.com", Icon: Facebook },
  { label: "TikTok", href: "https://tiktok.com", Icon: Music2 },
];

const footerLinks = {
  explore: [
    { label: "Nearby vendors", href: "/shop" },
    { label: "How it works", href: "/#how-it-works" },
    { label: "Why SabiGet", href: "/#why-sabiget" },
    { label: "Categories", href: "/#categories" },
  ],
  customers: [
    { label: "Your orders", href: "/orders" },
    { label: "Browse vendors", href: "/shop" },
    { label: "Guest checkout", href: "/shop" },
  ],
  vendors: [
    { label: "Become a vendor", href: "/vendor/onboarding" },
    { label: "Vendor dashboard", href: "/vendor/dashboard" },
  ],
};

export default function SocialFooter() {
  return (
    <footer className="bg-[#141414]">
      {/* Main footer */}
      <div className="sabiget-shell py-12 sm:py-16">
        <div className="mb-8 hidden justify-end gap-3 lg:flex">
          {socialLinks.map(({ label, href, Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Icon className="h-4 w-4" />
            </a>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Link href="/" className="inline-flex items-center gap-2.5" aria-label="SabiGet home">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff4500] text-base font-black text-white shadow-[0_6px_16px_-6px_rgba(255,69,0,0.7)]">
                  S
                </span>
                <span className="text-xl font-extrabold tracking-tight text-white">
                  SabiGet
                </span>
              </Link>
              <div className="flex items-center gap-3 lg:hidden">
                {socialLinks.map(({ label, href, Icon }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/50">
              Local food marketplace. Discover nearby vendors, order prepaid,
              and get your next craving sorted.
            </p>
          </div>

          {/* Explore */}
          <div>
            <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-white/30">
              Explore
            </h4>
            <ul className="space-y-3">
              {footerLinks.explore.map((link) => (
                <li key={link.href + link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/50 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Customers */}
          <div>
            <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-white/30">
              Customers
            </h4>
            <ul className="space-y-3">
              {footerLinks.customers.map((link) => (
                <li key={link.href + link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/50 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Vendors */}
          <div>
            <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-white/30">
              Vendors
            </h4>
            <ul className="space-y-3">
              {footerLinks.vendors.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/50 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/[0.06] pt-8 sm:flex-row">
          <p className="text-xs text-white/30">
            &copy; {new Date().getFullYear()} SabiGet. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-5 text-xs text-white/30">
            <span>Prepaid ordering &middot; Delivery verification on every order</span>
            <Link href="/privacy" className="transition-colors hover:text-white/60">
              Privacy Policy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-white/60">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
