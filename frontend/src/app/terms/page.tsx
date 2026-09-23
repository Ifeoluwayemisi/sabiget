import Link from "next/link";

export const metadata = { title: "Terms & Conditions — SabiGet" };

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--color-surface)] px-4 py-10 sm:py-16">
      <div className="sabiget-shell max-w-3xl">
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-strong)] p-6 shadow-[var(--shadow-card)] sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ff4500]">
            SabiGet
          </p>
          <h1 className="mt-2 text-xl font-extrabold text-[#111111] sm:text-2xl">
            Terms &amp; Conditions
          </h1>
          <p className="mt-2 text-sm text-[#8a8a8a]">
            Last reviewed: pending legal finalisation
          </p>

          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            These terms outline how SabiGet works and what you agree to when
            using the service. Final legal review is pending — please contact us
            if you have questions before relying on this document.
          </div>

          <div className="mt-8 space-y-8 text-sm leading-relaxed text-[#5f5a57]">
            <section>
              <h2 className="text-base font-bold text-[#111111]">
                1. About SabiGet
              </h2>
              <p className="mt-2">
                SabiGet is a location-aware marketplace connecting customers
                with nearby food vendors. SabiGet coordinates discovery,
                ordering, and prepaid payment. Vendors manage their own
                fulfillment and delivery.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-[#111111]">
                2. Accounts and guest checkout
              </h2>
              <p className="mt-2">
                You may browse SabiGet without creating an account. To place an
                order you will need to verify a phone number. You may choose to
                create a full account at any time. You are responsible for
                keeping your account credentials secure.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-[#111111]">
                3. Orders and payments
              </h2>
              <p className="mt-2">
                All orders are prepaid. SabiGet does not support cash on
                delivery. When you place an order, the backend calculates the
                authoritative total including any applicable fees. Payment is
                processed through Paystack and SabiGet does not store your card
                details.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-[#111111]">
                4. Delivery and fulfillment
              </h2>
              <p className="mt-2">
                Vendors are responsible for preparing orders and coordinating
                delivery. SabiGet is not a logistics company and does not
                operate its own delivery fleet. Delivery verification is
                completed through a verification code system before an order is
                marked as delivered.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-[#111111]">
                5. Cancellations and refunds
              </h2>
              <p className="mt-2">
                Order cancellation and refund eligibility is governed by SabiGet
                policies and the current order state. Specific cancellation and
                refund terms are being finalised and will be documented here.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-[#111111]">
                6. Acceptable use
              </h2>
              <p className="mt-2">
                You agree to use SabiGet only for lawful purposes. You must not
                misuse the service, attempt to access it in unauthorised ways,
                or interfere with its operation.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-[#111111]">
                7. Changes to these terms
              </h2>
              <p className="mt-2">
                We may update these terms from time to time. When we make
                material changes, we will notify you through the service or by
                other appropriate means.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-[#111111]">8. Contact</h2>
              <p className="mt-2">
                If you have questions about these terms, please reach out
                through the SabiGet support channel.
              </p>
            </section>
          </div>

          <div className="mt-10 border-t border-[var(--color-line)] pt-6">
            <Link
              href="/"
              className="inline-flex min-h-[44px] items-center text-sm font-semibold text-[#ff4500] hover:underline"
            >
              Back to SabiGet
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
