import Link from "next/link";

export const metadata = { title: "Terms & Conditions" };

// Minimal placeholder so the Terms link in account creation is functional.
// The actual policy is final legal copy that still needs to be written and
// approved before release; nothing on this page is legal advice.
export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="sabiget-shell max-w-3xl">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">
            SabiGet
          </p>
          <h1 className="mt-2 text-3xl font-black text-gray-900">
            Terms &amp; Conditions
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Last reviewed: coming soon
          </p>

          <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This page is a placeholder. The final Terms &amp; Conditions must
            be drafted with legal guidance before SabiGet can rely on consent
            to them.
          </div>

          <div className="mt-8 space-y-6 text-sm leading-relaxed text-gray-700">
            <section>
              <h2 className="text-lg font-bold text-gray-900">1. Overview</h2>
              <p className="mt-2">
                SabiGet is a location-aware marketplace connecting customers
                with nearby food vendors. Orders are prepaid, fulfillment is
                vendor-managed, and every delivery is verified before it is
                completed.
              </p>
            </section>
            <section>
              <h2 className="text-lg font-bold text-gray-900">
                2. Placeholder content
              </h2>
              <p className="mt-2">
                Full clauses covering accounts, orders, payments, refunds,
                vendor conduct, liability, and dispute resolution will be added
                here before launch.
              </p>
            </section>
          </div>

          <div className="mt-10 border-t border-gray-100 pt-6">
            <Link
              href="/"
              className="inline-flex min-h-[44px] items-center text-sm font-semibold text-orange-500 hover:underline"
            >
              Back to SabiGet
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}