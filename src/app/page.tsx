import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="py-16 text-center">
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          Stop losing 5–15h/week chasing overdue invoices
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Upload your overdue CSV. Validate in seconds. Fire a proven 4-step chase sequence. Export the vault as PDF +
          CSV. Built for founders/COOs at 5–50 person service firms.
        </p>
        <div className="mt-8">
          <Link
            href="/app"
            className="inline-block rounded-lg bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground"
          >
            Upload 10 invoices — see cleared →
          </Link>
        </div>
      </section>

      <section className="grid gap-6 py-12 md:grid-cols-2">
        <div className="rounded-xl border p-6">
          <h2 className="text-xl font-semibold">Before</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
            <li>Spreadsheet + inbox archaeology every Friday</li>
            <li>Awkward “just checking in” emails, sent late</li>
            <li>Cash stuck 30–60 days past due</li>
            <li>5–15h/week of founder time burned</li>
          </ul>
        </div>
        <div className="rounded-xl border p-6">
          <h2 className="text-xl font-semibold">After</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
            <li>CSV upload → validation table in seconds</li>
            <li>4-step sequence preview: pre-due / due / +7 / +14 / +30</li>
            <li>Vault log + one-click PDF and CSV export</li>
            <li>1 credit per invoice chased. Done in minutes.</li>
          </ul>
        </div>
      </section>

      <section className="py-12 text-center">
        <h2 className="text-3xl font-bold">Pricing</h2>
        <p className="mt-2 text-muted-foreground">One pack. No tiers. No sprawl.</p>
        <div className="mx-auto mt-6 max-w-md rounded-xl border p-8">
          <div className="text-xl font-semibold">100 credits — $1,000</div>
          <div className="mt-1 text-sm text-muted-foreground">$10/credit · 1 credit per invoice chased · free 3 on signup</div>
          <Link
            href="/app"
            className="mt-6 inline-block rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground"
          >
            Start with 3 free →
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-3xl py-12">
        <h2 className="text-3xl font-bold">FAQ</h2>
        <div className="mt-6 space-y-4">
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Who is this for?</h3>
            <p className="text-muted-foreground">Founders/COOs at 5–50 person service firms with overdue B2B invoices.</p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">How do credits work?</h3>
            <p className="text-muted-foreground">1 credit per invoice chased. 100 credits = $1,000. 3 free on signup.</p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">What do I get?</h3>
            <p className="text-muted-foreground">Validation, 4-step chase preview, vault log, PDF + CSV exports.</p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Do you send emails for me?</h3>
            <p className="text-muted-foreground">This fix-pack generates the sequence copy + vault proof; you send from your inbox.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
