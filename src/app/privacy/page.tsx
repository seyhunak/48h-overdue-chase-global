export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated September 2026.</p>

      <h2 className="mt-8 text-xl font-semibold">1. What we collect</h2>
      <ul className="mt-2 list-disc space-y-2 pl-5 text-muted-foreground">
        <li><strong>Account identity</strong> via Clerk (sign-in, email address) — to identify your workspace and gate admin features.</li>
        <li><strong>Invoice data you import</strong> — client names, invoice IDs, amounts, currencies, due dates, and recipient emails/phones from CSV uploads or your Zoho Invoice connection.</li>
        <li><strong>Follow-up content and logs</strong> — drafted sequences, approval decisions, send attempts, and the vault audit trail.</li>
        <li><strong>Connection settings you save</strong> — Composio API key, OneSignal App ID, Zoho organization ID. Secrets stay server-side and are never shared between owners.</li>
        <li><strong>Payments</strong> — processed by Stripe. We store credit balances and usage counts, never card numbers.</li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold">2. How we use it</h2>
      <p className="mt-2 text-muted-foreground">
        Your invoice data is used only to generate your follow-up sequences, reminders, and vault —
        the core function of the product. Account and settings data operate your workspace (credits,
        scheduling, delivery through the providers you connect). We do not sell your data, train models
        on it, or share it with anyone except the providers you explicitly connect (Clerk, Convex,
        Composio/OneSignal, Zoho, Stripe) as needed to deliver the service.
      </p>

      <h2 className="mt-8 text-xl font-semibold">3. What we never do</h2>
      <ul className="mt-2 list-disc space-y-2 pl-5 text-muted-foreground">
        <li>Never sell or rent your data or your clients&apos; contact details.</li>
        <li>Never message your clients except through sends you explicitly approve.</li>
        <li>Never expose one owner&apos;s keys, invoices, or logs to another owner.</li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold">4. Retention and deletion</h2>
      <p className="mt-2 text-muted-foreground">
        Workspace data is kept while your account is active so your vault history persists. To delete
        everything associated with your account — invoices, reminders, vault entries, settings — send
        a deletion request via the <a className="underline" href="/contact">contact form</a> from your
        account email and we will confirm deletion within 5 business days.
      </p>

      <h2 className="mt-8 text-xl font-semibold">5. Cookies and analytics</h2>
      <p className="mt-2 text-muted-foreground">
        We use strictly necessary cookies for sign-in sessions (Clerk). We do not run third-party
        advertising trackers.
      </p>

      <h2 className="mt-8 text-xl font-semibold">6. Contact</h2>
      <p className="mt-2 text-muted-foreground">
        Privacy questions or requests: reach us via the <a className="underline" href="/contact">contact form</a>.
        We reply within 1 business day.
      </p>
    </div>
  );
}
