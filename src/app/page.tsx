import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="font-body-x" style={{ background: "var(--color-paper)", color: "var(--color-ink-2)" }}>
      {/* Hero — asymmetric: title left (7), vault proof right (5) */}
      <section className="mx-auto grid max-w-6xl gap-8 px-4 pb-12 pt-12 md:grid-cols-12 md:pt-16">
        <div className="md:col-span-7">
          <p className="mono-label flex items-center gap-2" style={{ color: "var(--color-muted)" }}>
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-[2px]"
              style={{ background: "var(--color-accent)" }}
            />
            OverdueChase · fix-pack for service firms
          </p>
          <h1
            className="font-display mt-4 font-semibold"
            style={{
              color: "var(--color-ink)",
              fontSize: "var(--text-display-s)",
              lineHeight: 1.08,
              maxWidth: "20ch",
            }}
          >
            Stop losing 5–15h/week chasing overdue invoices
          </h1>
          <p className="mt-4 max-w-xl text-lg" style={{ color: "var(--color-ink-2)", lineHeight: 1.6 }}>
            Upload your overdue CSV. Validate in seconds. Fire a proven 4-step chase sequence. Export the vault as
            PDF + CSV. Built for founders/COOs at 5–50 person service firms.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/app"
              className="hallmark-btn hallmark-btn-primary inline-block px-8 py-4 text-lg font-semibold"
            >
              Upload 10 invoices — see cleared →
            </Link>
          </div>
          <p className="mono-label tnum mt-4" style={{ color: "var(--color-muted)" }}>
            CSV in · vault out · 1 credit / invoice · 3 free on signup
          </p>
        </div>
        <div className="md:col-span-5">
          <figure
            className="code-card overflow-hidden text-sm"
            aria-label="Vault export preview"
          >
            <div
              className="flex items-center gap-2 border-b px-4 py-2.5 text-xs"
              style={{ borderColor: "var(--color-graphite-2)" }}
            >
              <span aria-hidden className="flex gap-1.5">
                <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--color-dot)" }} />
                <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--color-dot)" }} />
                <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--color-dot)" }} />
              </span>
              <span className="tok-dim ml-1">vault-preview.csv</span>
              <span
                className="mono-label ml-auto rounded px-2 py-0.5"
                style={{ background: "var(--color-chip-bg)", color: "var(--color-accent-ink)" }}
              >
                vault log
              </span>
            </div>
            <div className="space-y-1.5 px-4 py-4">
              <p><span className="tok-dim">clientName,invoiceId,amount,currency,dueDate</span></p>
              <p><span className="tok-str">Acme,INV-001,1200,USD,2026-07-01</span> <span className="tok-key">· chased</span></p>
              <p><span className="tok-str">Bexley,INV-014,3400,USD,2026-06-18</span> <span className="tok-key">· chased</span></p>
              <p><span className="tok-str">Halden,INV-022,860,EUR,2026-07-09</span> <span className="tok-key">· chased</span></p>
              <p className="tok-dim">…validated in seconds → 4-step sequence → PDF + CSV</p>
            </div>
          </figure>
          <p className="mono-label tnum mt-3" style={{ color: "var(--color-muted)" }}>
            pre-due / due / +7 / +14 / +30
          </p>
        </div>
      </section>

      {/* Before / After — asymmetric split, hairline ruled */}
      <section
        className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-12"
        style={{ borderTop: "1px solid var(--color-rule)" }}
      >
        <div className="md:col-span-5">
          <h2 className="font-display text-xl font-semibold" style={{ color: "var(--color-ink)" }}>
            Before
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5" style={{ color: "var(--color-muted)" }}>
            <li>Spreadsheet + inbox archaeology every Friday</li>
            <li>Awkward “just checking in” emails, sent late</li>
            <li>Cash stuck 30–60 days past due</li>
            <li>5–15h/week of founder time burned</li>
          </ul>
        </div>
        <div
          className="rounded-[10px] border p-6 md:col-span-7"
          style={{ borderColor: "var(--color-rule-2)", background: "var(--color-paper-2)" }}
        >
          <h2 className="font-display flex items-center gap-2 text-xl font-semibold" style={{ color: "var(--color-ink)" }}>
            <span aria-hidden className="inline-block h-2 w-2 rounded-[2px]" style={{ background: "var(--color-accent)" }} />
            After
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5" style={{ color: "var(--color-ink-2)" }}>
            <li>CSV upload → validation table in seconds</li>
            <li>4-step sequence preview: pre-due / due / +7 / +14 / +30</li>
            <li>Vault log + one-click PDF and CSV export</li>
            <li>1 credit per invoice chased. Done in minutes.</li>
          </ul>
        </div>
      </section>

      {/* Pricing — single tier row, left-biased */}
      <section className="mx-auto max-w-6xl px-4 py-8">
        <div style={{ borderTop: "1px solid var(--color-rule)" }} className="grid gap-6 pt-12 md:grid-cols-12">
          <div className="md:col-span-4">
            <h2 className="font-display text-3xl font-semibold" style={{ color: "var(--color-ink)" }}>
              Pricing
            </h2>
            <p className="mt-2" style={{ color: "var(--color-muted)" }}>
              One pack. No tiers. No sprawl.
            </p>
          </div>
          <div className="md:col-span-8">
            <div
              className="flex flex-wrap items-baseline justify-between gap-4 rounded-[10px] border p-6"
              style={{ borderColor: "var(--color-rule-2)" }}
            >
              <div>
                <div className="font-display tnum text-xl font-semibold" style={{ color: "var(--color-ink)" }}>
                  100 credits — $1,000
                </div>
                <div className="tnum mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
                  $10/credit · 1 credit per invoice chased · free 3 on signup
                </div>
              </div>
              <Link
                href="/app"
                className="hallmark-btn rounded-md border px-6 py-3 font-semibold"
                style={{ borderColor: "var(--color-rule-2)", color: "var(--color-ink)" }}
              >
                Start with 3 free →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ — typographic rhythm, hairline dividers */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-12">
          <div className="md:col-span-4">
            <h2 className="font-display text-3xl font-semibold" style={{ color: "var(--color-ink)" }}>
              FAQ
            </h2>
            <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
              Straight answers. No sales doc.
            </p>
          </div>
          <div className="md:col-span-8">
            <div style={{ borderTop: "1px solid var(--color-rule)" }}>
              {[
                ["Who is this for?", "Founders/COOs at 5–50 person service firms with overdue B2B invoices."],
                ["How do credits work?", "1 credit per invoice chased. 100 credits = $1,000. 3 free on signup."],
                ["What do I get?", "Validation, 4-step chase preview, vault log, PDF + CSV exports."],
                ["Do you send emails for me?", "This fix-pack generates the sequence copy + vault proof; you send from your inbox."],
              ].map(([q, a]) => (
                <div key={q} className="py-5" style={{ borderBottom: "1px solid var(--color-rule)" }}>
                  <h3 className="font-semibold" style={{ color: "var(--color-ink)" }}>
                    {q}
                  </h3>
                  <p className="mt-1 max-w-2xl" style={{ color: "var(--color-ink-2)" }}>
                    {a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
