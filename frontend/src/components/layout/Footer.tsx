import Link from "next/link";
import { MapPin } from "lucide-react";

const exploreLinks = [
  { label: "Nearby vendors", href: "/#vendors" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Why SabiGet", href: "/#trust" },
];

const customerLinks = [
  { label: "Your orders", href: "/orders" },
];

const vendorLinks = [
  { label: "Become a vendor", href: "/vendor-dashboard" },
];

export default function Footer() {
  return (
    <footer className="bg-[#111111] text-white">
      <div className="sabiget-shell py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <p className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ff4500] text-sm font-black">
                S
              </span>
              SabiGet
            </p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/60">
              Your favorite local meals, delivered fast — with secure payment
              and verified handoff on every order.
            </p>
            <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-white/50">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              Lagos, Nigeria
            </p>
          </div>

          <nav aria-label="Explore">
            <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-white/40">
              Explore
            </h3>
            <ul className="mt-4 space-y-2.5">
              {exploreLinks.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="inline-flex min-h-[32px] items-center text-sm text-white/70 transition-colors hover:text-[#ff6a00]"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Customers">
            <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-white/40">
              Customers
            </h3>
            <ul className="mt-4 space-y-2.5">
              {customerLinks.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="inline-flex min-h-[32px] items-center text-sm text-white/70 transition-colors hover:text-[#ff6a00]"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Vendors">
            <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-white/40">
              Vendors
            </h3>
            <ul className="mt-4 space-y-2.5">
              {vendorLinks.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="inline-flex min-h-[32px] items-center text-sm text-white/70 transition-colors hover:text-[#ff6a00]"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center">
          <p className="text-sm text-white/50">
            © {new Date().getFullYear()} SabiGet. All rights reserved.
          </p>
          <p className="text-sm text-white/40">
            Prepaid ordering · Delivery verification on every order
          </p>
        </div>
      </div>
    </footer>
  );
}
