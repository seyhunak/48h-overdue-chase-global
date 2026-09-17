import Script from "next/script";

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold">Contact</h1>
      <p className="mt-4 text-muted-foreground">
        Support, billing questions, data deletion requests, or feedback on the follow-up sequences —
        send the form below. We reply within 1 business day.
      </p>

      <div className="mt-6 rounded-[10px] border p-4" style={{ borderColor: "var(--color-rule-2)" }}>
        <div data-youform-embed data-form="otblhnip" />
        <Script src="https://app.youform.com/embed.js" strategy="lazyOnload" />
        <p className="mt-2 text-sm text-muted-foreground">
          Include your account email and, for delivery issues, the invoice ID and the OneSignal
          notification ID shown in the workbench after sending.
        </p>
      </div>

      <h2 className="mt-8 text-xl font-semibold">Before you write</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
        <li><strong>Delivery problems?</strong> Check /connect first — the provider badges show whether OneSignal, Email, SMS, and Push are ready.</li>
        <li><strong>Zoho import empty?</strong> Invoices must be marked as Sent (not Draft) in Zoho, and multi-org accounts need the org ID saved in /connect.</li>
        <li><strong>Billing?</strong> Credits are 1 per invoice followed up; the admin can see your balance and usage.</li>
      </ul>
    </div>
  );
}
