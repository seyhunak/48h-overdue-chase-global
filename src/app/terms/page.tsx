export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated September 2026.</p>

      <h2 className="mt-8 text-xl font-semibold">1. The service</h2>
      <p className="mt-2 text-muted-foreground">
        ClearDue is a follow-up console for overdue invoices. You import invoices (CSV upload or Zoho
        Invoice), review machine-drafted follow-up sequences, approve sends over Email, SMS, or Push via
        your own connected OneSignal account, and export a vault log of every touch.
      </p>

      <h2 className="mt-8 text-xl font-semibold">2. Credits and payments</h2>
      <ul className="mt-2 list-disc space-y-2 pl-5 text-muted-foreground">
        <li>Following up costs <strong>1 credit per invoice</strong>, charged when you press follow up — not at send time.</li>
        <li>Credit pack: <strong>100 credits for $99</strong> ($0.99 per credit), processed by Stripe.</li>
        <li>New accounts receive <strong>3 free credits</strong> on signup.</li>
        <li><strong>No refunds on consumed credits.</strong> Unused credits stay on your account.</li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold">3. Your responsibilities</h2>
      <ul className="mt-2 list-disc space-y-2 pl-5 text-muted-foreground">
        <li><strong>You approve every send.</strong> The scheduler only queues drafts; delivery happens exclusively through your explicit approval.</li>
        <li>Only follow up on invoices you have a legitimate right to collect, to contacts you have a legitimate reason to message.</li>
        <li>Respect opt-outs and applicable messaging law (including SMS consent and STOP handling in your jurisdiction). You are the sender; ClearDue is your tool.</li>
        <li>Keep your connected accounts (Composio, OneSignal, Zoho, Stripe) secure. Activity under your account is your responsibility.</li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold">4. Delivery</h2>
      <p className="mt-2 text-muted-foreground">
        Delivery depends on providers you connect (OneSignal via Composio) and on recipient
        subscriptions — e.g. an email address must be subscribed in your OneSignal app to receive
        email. We report provider acceptance and recipient counts where the provider returns them, but
        we cannot guarantee inbox placement or delivery.
      </p>

      <h2 className="mt-8 text-xl font-semibold">5. Data</h2>
      <p className="mt-2 text-muted-foreground">
        Invoice data you import is used only to generate your sequences, reminders, and vault. API keys
        and OAuth tokens you connect stay server-side and are never shared between owners. See the{" "}
        <a className="underline" href="/privacy">privacy policy</a> for retention and deletion.
      </p>

      <h2 className="mt-8 text-xl font-semibold">6. Fair use and termination</h2>
      <p className="mt-2 text-muted-foreground">
        No spam, no unlawful collection, no abuse of the service or other users. We may suspend accounts
        that violate these terms. You may stop using ClearDue at any time; contact us to delete your data.
      </p>

      <h2 className="mt-8 text-xl font-semibold">7. Liability</h2>
      <p className="mt-2 text-muted-foreground">
        ClearDue is provided as-is, without warranties. To the maximum extent permitted by law, our
        liability is limited to the amount you paid in the 12 months before the claim. Nothing here
        limits liability that cannot be limited by law.
      </p>

      <h2 className="mt-8 text-xl font-semibold">8. Contact</h2>
      <p className="mt-2 text-muted-foreground">
        Questions about these terms: reach us via the <a className="underline" href="/contact">contact form</a>.
      </p>
    </div>
  );
}
