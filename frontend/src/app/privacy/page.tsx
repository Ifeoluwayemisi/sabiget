import Link from "next/link";

export const metadata = { title: "Privacy Policy" };

// Minimal placeholder so the Privacy link in account creation is functional.
// The actual policy is final legal copy that still needs to be written and
// approved before release; nothing on this page is legal advice.
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="sabiget-shell max-w-3xl">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">
            SabiGet
          </p>
          <h1 className="mt-2 text-3xl font-black text-gray-900">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Last reviewed: coming soon
          </p>

          <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This page is a placeholder. The final Privacy Policy must be
            drafted with legal guidance before SabiGet can rely on consent to
            it.
          </div>

          <div className="mt-8 space-y-6 text-sm leading-relaxed text-gray-700">
            <section>
              <h2 className="text-lg font-bold text-gray-900">1. Overview</h2>
              <p className="mt-2">
                SabiGet collects the information needed to provide orders,
                coordinate delivery, process prepaid payments, and protect
                every account. We do not sell your personal data.
              </p>
            </section>
            <section>
              <h2 className="text-lg font-bold text-gray-900">
                2. Placeholder content
              </h2>
              <p className="mt-2">
                Full clauses covering what we collect, how it is used, how long
                it is kept, sharing with vendors and payment providers, and
                your rights will be added here before launch.
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