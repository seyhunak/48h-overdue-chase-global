import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold">About ClearDue</h1>
      <p className="mt-4 text-muted-foreground">
        ClearDue is a follow-up console for 5–50 person service firms — agencies, studios, consultancies,
        and contractors — that would rather get paid than chase payments. Founders told us the same story:
        the work is done, the invoice is sent, and then 5–15 hours a week evaporate into awkward
        reminders, inbox archaeology, and Friday spreadsheet sessions. ClearDue compresses that into minutes.
      </p>

      <h2 className="mt-8 text-xl font-semibold">What it does</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
        <li>Imports overdue invoices from a CSV upload or directly from Zoho Invoice.</li>
        <li>Validates amounts, currencies, due dates, and contacts in seconds.</li>
        <li>Drafts a proven 4-step follow-up sequence (pre-due, due, +7, +14, +30) per invoice.</li>
        <li>Sends over Email, SMS, and Push through your own OneSignal connection — only after your approval.</li>
        <li>Logs every touch in an exportable vault (PDF + CSV) your accountant believes.</li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold">How we think about follow-ups</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
        <li><strong>Human approval, always.</strong> The scheduler only queues drafts. Nothing sends without you pressing approve.</li>
        <li><strong>Polite by default, firm when it must be.</strong> Early steps nudge; late steps reference terms and escalation.</li>
        <li><strong>Guardrails over growth hacks.</strong> Max 1 touch per invoice per day, max 5 touches lifetime, 09:00–18:00 UTC send window, automatic stop for paid or opted-out contacts.</li>
        <li><strong>Your data stays yours.</strong> Invoice data generates your sequences and vault — nothing else. See the <Link className="underline" href="/privacy">privacy policy</Link>.</li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold">Pricing</h2>
      <p className="mt-3 text-muted-foreground">
        One pack: 100 credits for $99 ($0.99 per credit, 1 credit per invoice followed up), with 3 free
        credits on signup. No subscription, no seat fees. Details in the <Link className="underline" href="/terms">terms</Link>.
      </p>

      <p className="mt-8">
        <Link href="/app" className="underline">Open the workbench →</Link>
      </p>
    </div>
  );
}
