import Link from "next/link";

const CHANNELS = [
  { name: "Email", desc: "Full-length follow-ups with subject lines your clients actually open. Polite first, firm when it counts." },
  { name: "SMS", desc: "Short, urgent escalation texts for high-value invoices — with opt-out handling built in." },
  { name: "Push", desc: "Push notifications for contacts registered in your OneSignal app." },
];

const STEPS = [
  { key: "Pre-due", desc: "A heads-up before the due date so invoices rarely go late in the first place." },
  { key: "Due", desc: "A same-day reminder with payment details and a reply-if-paid escape hatch." },
  { key: "+7", desc: "First overdue nudge — asks for a concrete payment date this week." },
  { key: "+14", desc: "Firm note with a 3-business-day window. Late-fee terms referenced." },
  { key: "+30", desc: "Final notice before escalation or collections." },
];

export default function ProductPage() {
  return (
    <div className="tally">
      <section className="tally-section">
        <div className="tally__container mx-auto max-w-3xl px-4">
          <span className="tally__eyebrow">◇ product</span>
          <h1 className="tally-section-head__title mt-2">
            The follow-up console that <span className="italic-accent">clears</span> overdue invoices.
          </h1>
          <p className="tally-section-head__desc mt-3">
            ClearDue takes your overdue invoices — CSV upload or one-click import from Zoho — validates
            them in seconds, drafts a proven 4-step follow-up sequence for each one, and sends it over
            Email, SMS, and Push after your approval. Every touch is logged in the vault with PDF and CSV
            export for finance.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/app" className="tally-tier__cta">
              Open the workbench →
            </Link>
            <Link href="#pricing" className="tally-link">
              See pricing
            </Link>
          </div>
        </div>
      </section>

      <section className="tally-section">
        <div className="tally__container mx-auto max-w-3xl px-4">
          <span className="tally__eyebrow">◇ import</span>
          <h2 className="tally-section-head__title mt-2">Your invoices, in seconds.</h2>
          <div className="tally-features__grid mt-4">
            <article className="tally-feature">
              <h3 className="tally-feature__title">CSV upload</h3>
              <p className="tally-feature__desc">
                Columns: clientName, invoiceId, amount, currency, dueDate, email (optional), phone
                (optional). Validation flags bad amounts, dates, and emails before anything is queued.
              </p>
            </article>
            <article className="tally-feature">
              <h3 className="tally-feature__title">Zoho Invoice import</h3>
              <p className="tally-feature__desc">
                Connect Zoho once in /connect, then pull unpaid invoices straight into the review table.
                Drafts, paid, and void invoices are filtered out automatically.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="tally-section">
        <div className="tally__container mx-auto max-w-3xl px-4">
          <span className="tally__eyebrow">◇ channels</span>
          <h2 className="tally-section-head__title mt-2">Email, SMS, and Push.</h2>
          <p className="tally-section-head__desc mt-3">
            Delivery runs through your own OneSignal connection (connected via Composio in /connect).
            Pick the channel per reminder at approval time.
          </p>
          <div className="tally-features__grid mt-4">
            {CHANNELS.map((c) => (
              <article key={c.name} className="tally-feature">
                <h3 className="tally-feature__title">{c.name}</h3>
                <p className="tally-feature__desc">{c.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="tally-section">
        <div className="tally__container mx-auto max-w-3xl px-4">
          <span className="tally__eyebrow">◇ sequence</span>
          <h2 className="tally-section-head__title mt-2">A 4-step ladder, polite by default.</h2>
          <div className="mt-4 space-y-3">
            {STEPS.map((s) => (
              <div key={s.key} className="rounded-[10px] border p-4" style={{ borderColor: "var(--color-rule-2)" }}>
                <h3 className="font-semibold">{s.key}</h3>
                <p className="text-sm" style={{ color: "var(--color-muted)" }}>{s.desc}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm" style={{ color: "var(--color-muted)" }}>
            Guardrails: nothing sends without your approval. Max 1 touch per invoice per day, max 5
            touches lifetime, send window 09:00–18:00 UTC. Paid and unsubscribed invoices stop the ladder
            automatically.
          </p>
        </div>
      </section>

      <section className="tally-section" id="pricing">
        <div className="tally__container mx-auto max-w-3xl px-4">
          <span className="tally__eyebrow">◇ pricing</span>
          <h2 className="tally-section-head__title mt-2">
            One pack that pays for <span className="italic-accent">itself</span>.
          </h2>
          <article className="tally-tier mt-4">
            <span className="tally-tier__badge">Single pack · featured</span>
            <div className="tally-tier__name">ClearDue pack</div>
            <div className="tally-tier__price tnum">100 credits — $99</div>
            <p className="tally-tier__desc">$0.99/credit · 1 credit per invoice followed up · free 3 on signup</p>
            <ul className="tally-tier__features">
              <li>CSV upload or Zoho import, validated in seconds</li>
              <li>4-step follow-up sequence preview</li>
              <li>Send over Email, SMS, and Push</li>
              <li>Vault log + PDF and CSV export</li>
              <li>Built for 5–50 person service firms</li>
            </ul>
            <Link href="/app" className="tally-tier__cta">
              Start with 3 free →
            </Link>
          </article>
        </div>
      </section>
    </div>
  );
}
