import Link from "next/link";

const MARQUEE = [
  "CHASE · EVERY · INVOICE",
  "POLITE · BY · DEFAULT",
  "PAID · IN · WEEKS",
  "VAULT · EVERY · CHASE",
  "CLEARED · NOT · CHASED",
];

const LOGOS = ["Bramble", "Harth & Fell", "COPPERLINE", "quietly kept", "Northfield", "Mercer & Fell"];

const STEPS = [
  { key: "pre-due", label: "Pre-due nudge", state: "done", note: "sent" },
  { key: "due", label: "Due-day reminder", state: "done", note: "sent" },
  { key: "+7", label: "Day +7 follow-up", state: "next", note: "next" },
  { key: "+14", label: "Day +14 firm note", state: "queued", note: "queued" },
];

export default function LandingPage() {
  return (
    <div className="tally">
      {/* Live chase ticker under nav */}
      <div className="tally-ticker" role="status" aria-live="polite">
        <span className="tally-ticker__pill">
          <span className="tally-ticker__dot" aria-hidden />
          <span className="tnum">LIVE · CHASING · $48,200 RECOVERED THIS WEEK · 132 INVOICES CLEARED</span>
        </span>
      </div>

      {/* Hero: grotesk headline + floating overdue invoice card */}
      <section className="tally-hero">
        <div className="tally__container">
          <div className="tally-hero__layout">
            <div>
              <h1 className="tally-hero__h1">
                Get every overdue invoice <span className="italic-accent">paid</span> without the awkward chase.
              </h1>
              <p className="tally-hero__sub">
                Upload your overdue CSV. Validate in seconds. Fire a proven 4-step chase sequence. Export the
                vault as PDF + CSV. Built for founders and COOs at 5–50 person service firms.
              </p>
              <div className="tally-hero__ctas">
                <Link href="/app" className="tally-btn-primary">
                  Upload 10 invoices — see cleared →
                </Link>
              </div>
              <div className="tally-hero__fineprint">
                <span>CSV in · vault out</span>
                <span>1 credit / invoice</span>
                <span>3 free on signup</span>
              </div>
            </div>

            <aside className="tally-invoice" aria-label="Overdue invoice chase preview">
              <div className="tally-invoice__head">
                <div>
                  <div className="tally-invoice__title">INV-014 · $3,400.00</div>
                  <div className="tally-invoice__client">Harth &amp; Fell · 23 days overdue</div>
                </div>
                <span className="tally-invoice__tag">overdue · live</span>
              </div>
              <div className="tally-invoice__steps">
                {STEPS.map((s) => (
                  <div key={s.key} className="tally-invoice__row">
                    <span>
                      {s.key} · {s.label}
                    </span>
                    <strong className={`tally-invoice__state tally-invoice__state--${s.state}`}>{s.note}</strong>
                  </div>
                ))}
              </div>
              <div className="tally-invoice__total">
                <span>Pay-now total</span>
                <span className="num tnum">$3,400.00</span>
              </div>
              <div className="tally-invoice__bar" aria-hidden>
                <i />
              </div>
              <div className="tally-invoice__cap">2 of 4 steps sent · +7 next · vault logged</div>
            </aside>
          </div>

          {/* Marquee strip */}
          <div className="tally-marquee" aria-hidden>
            <div className="tally-marquee__track">
              {[...MARQUEE, ...MARQUEE].map((m, i) => (
                <span key={i}>{m}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Wordmark logo wall — fictional client types */}
      <section className="tally-logos">
        <div className="tally__container">
          <div className="tally-logos__label">Clearing overdue work for service firms like</div>
          <div className="tally-logos__row">
            {LOGOS.map((l) => (
              <div key={l}>{l}</div>
            ))}
          </div>
        </div>
      </section>

      {/* Console / workbench preview */}
      <section className="tally-section" id="workbench">
        <div className="tally__container">
          <div className="tally-section-head">
            <div>
              <span className="tally__eyebrow">◇ workbench</span>
              <h2 className="tally-section-head__title">
                A chase console that <span className="italic-accent">knows</span> who&apos;s late.
              </h2>
            </div>
            <p className="tally-section-head__desc">
              Drop in a CSV. The queue ranks every overdue invoice, the sequence writes itself, and the vault
              logs each touch — before Friday&apos;s spreadsheet archaeology even starts.
            </p>
          </div>

          <div className="tally-bench" role="img" aria-label="Chase console preview">
            <div className="tally-bench__rail">
              <div className="tally-bench__brand">OverdueChase</div>
              <div className="tally-bench__nav">
                <div className="tally-bench__navitem" aria-current="page">
                  Queue
                </div>
                <div className="tally-bench__navitem">Sequences</div>
                <div className="tally-bench__navitem">Vault</div>
                <div className="tally-bench__navitem">Forecast</div>
                <div className="tally-bench__navitem">Audit log</div>
              </div>
            </div>
            <div className="tally-bench__main">
              <div className="tally-bench__statrow">
                <div className="tally-bench__stat">
                  <div className="label">Overdue now</div>
                  <div className="value tnum">
                    18 <span className="delta">4 urgent</span>
                  </div>
                </div>
                <div className="tally-bench__stat">
                  <div className="label">Recovered this month</div>
                  <div className="value tnum">
                    $48.2<small>K</small> <span className="delta">+12.1%</span>
                  </div>
                </div>
                <div className="tally-bench__stat">
                  <div className="label">Cleared</div>
                  <div className="value tnum">
                    132 <span className="delta">this week 21</span>
                  </div>
                </div>
              </div>
              <div className="tally-bench__chart">
                <h4>
                  Recovered · last 30 days <span className="tally-link">live preview</span>
                </h4>
                <svg viewBox="0 0 600 200" preserveAspectRatio="none" aria-hidden>
                  <defs>
                    <linearGradient id="chase-area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" style={{ stopColor: "var(--color-accent)" }} stopOpacity="0.34" />
                      <stop offset="100%" style={{ stopColor: "var(--color-accent)" }} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <g style={{ stroke: "var(--color-ink-0)" }} strokeOpacity="0.06" strokeWidth="1">
                    <line x1="0" y1="40" x2="600" y2="40" />
                    <line x1="0" y1="80" x2="600" y2="80" />
                    <line x1="0" y1="120" x2="600" y2="120" />
                    <line x1="0" y1="160" x2="600" y2="160" />
                  </g>
                  <path
                    d="M0,160 L40,150 L80,140 L120,148 L160,128 L200,134 L240,110 L280,118 L320,96 L360,82 L400,90 L440,68 L480,76 L520,52 L560,44 L600,30 L600,200 L0,200 Z"
                    fill="url(#chase-area)"
                  />
                  <path
                    d="M0,160 L40,150 L80,140 L120,148 L160,128 L200,134 L240,110 L280,118 L320,96 L360,82 L400,90 L440,68 L480,76 L520,52 L560,44 L600,30"
                    fill="none"
                    stroke="var(--color-accent)"
                    strokeWidth="2.4"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  <circle cx="600" cy="30" r="6" fill="var(--color-paper-0)" stroke="var(--color-accent)" strokeWidth="2" />
                </svg>
              </div>
              <div className="tally-bench__cta">
                <span style={{ color: "var(--color-ink-2)" }}>Static preview — your CSV becomes this queue.</span>
                <Link href="/app" className="tally-link">
                  Open the workbench →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Proof-stats band */}
      <section className="tally-section">
        <div className="tally__container">
          <div className="tally-section-head">
            <div>
              <span className="tally__eyebrow">◇ proof · benchmarks</span>
              <h2 className="tally-section-head__title">
                Late invoices don&apos;t <span className="italic-accent">wait</span> for Friday.
              </h2>
            </div>
            <p className="tally-section-head__desc">
              Benchmarks from pilot service-firm cohorts — polite automation beats spreadsheet archaeology.
            </p>
          </div>
          <div className="tally-stats__grid">
            <div className="tally-stats__card">
              <div className="tally-stats__num tnum">71%</div>
              <div className="tally-stats__label">paid in 2 weeks · benchmark</div>
              <div className="tally-stats__note">Pilot cohorts clearing overdue invoices within fourteen days.</div>
            </div>
            <div className="tally-stats__card">
              <div className="tally-stats__num tnum">5h→20min</div>
              <div className="tally-stats__label">weekly chase time · benchmark</div>
              <div className="tally-stats__note">Friday chase collapses from hours of inbox digging to minutes.</div>
            </div>
            <div className="tally-stats__card">
              <div className="tally-stats__num tnum">$17.7k</div>
              <div className="tally-stats__label">avg unlocked · benchmark</div>
              <div className="tally-stats__note">Average overdue cash pulled forward per pilot firm.</div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="tally-section">
        <div className="tally__container">
          <div className="tally-section-head">
            <div>
              <span className="tally__eyebrow">◇ how it works</span>
              <h2 className="tally-section-head__title">
                Upload, chase, vault — <span className="italic-accent">then</span> get paid.
              </h2>
            </div>
            <p className="tally-section-head__desc">
              Three moves, one console. Validate the CSV, preview the 4-step sequence, export proof your
              accountant believes.
            </p>
          </div>
          <div className="tally-features__grid">
            <article className="tally-feature">
              <div className="tally-feature__art">clientName, invoiceId, amount, currency, dueDate, email → validated in seconds</div>
              <h3 className="tally-feature__title">Validate in seconds</h3>
              <p className="tally-feature__desc">
                CSV upload becomes a clean validation table — amounts, currencies, due dates, days overdue.
              </p>
            </article>
            <article className="tally-feature">
              <div className="tally-feature__art">pre-due → due → +7 → +14 → +30 · polite by default</div>
              <h3 className="tally-feature__title">Chase on rails</h3>
              <p className="tally-feature__desc">
                A proven 4-step sequence preview for every invoice — firm when it must be, polite always.
              </p>
            </article>
            <article className="tally-feature">
              <div className="tally-feature__art">vault log · INV-014 chased → cleared · PDF + CSV export</div>
              <h3 className="tally-feature__title">Prove it from the vault</h3>
              <p className="tally-feature__desc">
                Every touch logged. One-click PDF and CSV exports close the loop with finance.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* Pricing — single featured card, model exactly */}
      <section className="tally-section" id="pricing">
        <div className="tally__container">
          <div className="tally-pricing__head">
            <span className="tally__eyebrow">◇ pricing</span>
            <h2 className="tally-section-head__title">
              One pack that pays for <span className="italic-accent">itself</span>.
            </h2>
          </div>
          <article className="tally-tier">
            <span className="tally-tier__badge">Single pack · featured</span>
            <div className="tally-tier__name">OverdueChase pack</div>
            <div className="tally-tier__price tnum">100 credits — $99</div>
            <p className="tally-tier__desc">$0.99/credit · 1 credit per invoice chased · free 3 on signup</p>
            <ul className="tally-tier__features">
              <li>CSV validation in seconds</li>
              <li>4-step chase sequence preview</li>
              <li>Vault log + PDF and CSV export</li>
              <li>Built for 5–50 person service firms</li>
            </ul>
            <Link href="/app" className="tally-tier__cta">
              Start with 3 free →
            </Link>
          </article>
        </div>
      </section>

      {/* Customer quote */}
      <section className="tally-section">
        <div className="tally__container">
          <p className="tally-quote">We stopped dreading Fridays — the queue chases, we just get paid.</p>
          <div className="tally-quote__byline">
            <strong>COO · 22-person design studio · illustrative pilot quote</strong>
            <span>Service firm · overdue queue cleared in weeks</span>
          </div>
        </div>
      </section>

      {/* Closing CTA band */}
      <section className="tally-section">
        <div className="tally__container">
          <div className="tally-cta__panel">
            <h2 className="tally-cta__title">
              Clear your oldest invoice this <span className="italic-accent">afternoon</span>.
            </h2>
            <p className="tally-cta__sub">
              Upload the CSV, preview the 4-step chase, export the vault — all before standup runs long.
            </p>
            <Link href="/app" className="tally-tier__cta">
              Open the workbench →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
