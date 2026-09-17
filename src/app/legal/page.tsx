import Link from "next/link";

export default function LegalPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold">Legal</h1>
      <p className="mt-4 text-muted-foreground">
        The rules and promises behind ClearDue, in plain language. Last updated September 2026.
      </p>

      <h2 className="mt-8 text-xl font-semibold">
        <Link className="underline" href="/terms">Terms of Service</Link>
      </h2>
      <p className="mt-2 text-muted-foreground">
        What you pay for (credits, 1 per invoice followed up), what you agree to (no spam, respect
        opt-outs, you approve every send), and the limits of the service. 100 credits $99 · 3 free on
        signup · no refunds on consumed credits.
      </p>

      <h2 className="mt-8 text-xl font-semibold">
        <Link className="underline" href="/privacy">Privacy Policy</Link>
      </h2>
      <p className="mt-2 text-muted-foreground">
        What we collect (your account, your invoice data, delivery credentials you connect), what we
        never do with it (sell it, train on it, share it beyond the providers you connect), and how to
        get your data deleted.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Contact for legal requests</h2>
      <p className="mt-2 text-muted-foreground">
        Deletion requests, data questions, or abuse reports: reach us via the{" "}
        <Link className="underline" href="/contact">contact form</Link>. We reply
        within 1 business day.
      </p>
    </div>
  );
}
