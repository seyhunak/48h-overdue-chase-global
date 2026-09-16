"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "../../convex/_generated/api";
import { buildChaseSequence, parseCsv, validateInvoiceRow, type Invoice } from "@/domain/invoices";
import { getConvexUrl, getClerkPublishableKey } from "@/infrastructure/env";

function toCsv(rows: Invoice[]): string {
  const header = "clientName,invoiceId,amount,currency,dueDate,daysOverdue,status";
  const lines = rows.map((r) =>
    [r.clientName, r.invoiceId, String(r.amount), r.currency, r.dueDate, String(r.daysOverdue), r.status].join(","),
  );
  return [header, ...lines].join("\n");
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadPdf(invoices: Invoice[]) {
  const rows = invoices
    .map((r) => `${r.clientName} | ${r.invoiceId} | ${r.currency} ${r.amount.toFixed(2)} | due ${r.dueDate}`)
    .join("\n");
  // Minimal valid single-page PDF (client-side, no deps)
  const text = `Overdue Chase Export\n\n${rows}\n`;
  const esc = text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").split("\n");
  const contentStream = `BT /F1 11 Tf 40 760 Td 14 TL ${esc.map((l) => `(${l}) Tj T*`).join(" ")} ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n `).join("\n")}\n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  download("overdue-chase.pdf", pdf, "application/pdf");
}

function WorkbenchInner() {
  const { isLoaded, user } = useUser();
  const params = useSearchParams();
  const added = params.get("credits") === "added";
  const convexUrl = getConvexUrl();
  const convexReady = Boolean(convexUrl && user);
  const balanceQuery = useQuery(
    convexReady ? (api as any).credits.getBalance : ("skip" as any),
    convexReady ? { clerkId: user!.id } : "skip",
  );
  const ensureCredits = useMutation((api as any).credits.getOrCreate);
  const consumeCredits = useMutation((api as any).credits.consume);
  const recordSubmission = useMutation((api as any).submissions.record);

  const [raw, setRaw] = useState("");
  const [chased, setChased] = useState(false);

  const parsed = useMemo(() => {
    if (!raw) return { valid: [] as Invoice[], errors: [] as string[] };
    const rows = parseCsv(raw);
    const valid: Invoice[] = [];
    const errors: string[] = [];
    rows.forEach((row, i) => {
      const r = validateInvoiceRow(row);
      if (r.invoice) valid.push(r.invoice);
      else errors.push(`row ${i + 2}: ${r.error}`);
    });
    return { valid, errors };
  }, [raw]);

  const balance: number | null = typeof balanceQuery?.balance === "number" ? balanceQuery.balance : null;

  if (!isLoaded) return <div className="mx-auto max-w-6xl px-4 py-12">Loading…</div>;
  if (!user)
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <p>
          Please <Link className="underline" href="/sign-in">sign in</Link> to use the workbench.
        </p>
      </div>
    );

  if (!convexUrl) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="text-2xl font-bold">Workbench unavailable</h1>
        <p className="mt-2 text-muted-foreground">Backend is not configured. Set NEXT_PUBLIC_CONVEX_URL via scripts/seed-env.sh.</p>
      </div>
    );
  }

  if (balance === null) {
    ensureCredits({ clerkId: user.id }).catch(() => {});
    return <div className="mx-auto max-w-6xl px-4 py-12">Loading credits…</div>;
  }

  if (balance <= 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold">Out of credits</h1>
        <p className="mt-2 text-muted-foreground">Chasing costs 1 credit per invoice. Top up to keep clearing invoices.</p>
        <form action="/api/checkout" method="POST" className="mt-6">
          <button type="submit" className="rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground">
            Buy 100 credits — $1,000
          </button>
        </form>
        {added && <p className="mt-4 text-sm">Credits added — balance is refreshing…</p>}
      </div>
    );
  }

  const seq = parsed.valid.length > 0 ? buildChaseSequence(parsed.valid[0]) : [];

  async function handleChase() {
    await ensureCredits({ clerkId: user!.id });
    await consumeCredits({ clerkId: user!.id, amount: parsed.valid.length });
    for (const inv of parsed.valid) {
      await recordSubmission({
        ownerClerkId: user!.id,
        clientName: inv.clientName,
        invoiceId: inv.invoiceId,
        amount: inv.amount,
        status: "chased",
        creditsUsed: 1,
      });
    }
    setChased(true);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {added && <p className="mb-4 rounded-md border p-3 text-sm">Credits added — balance updated.</p>}
      <h1 className="text-3xl font-bold">Chase workbench</h1>
      <p className="mt-1 text-muted-foreground">Balance: {balance} credits · 1 credit per invoice</p>

      <div className="mt-6 rounded-xl border p-4">
        <h2 className="font-semibold">1. Upload CSV of overdue invoices</h2>
        <p className="text-sm text-muted-foreground">Columns: clientName,invoiceId,amount,currency,dueDate</p>
        <input
          type="file"
          accept=".csv"
          className="mt-3 text-sm"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) f.text().then(setRaw);
          }}
        />
        <textarea
          className="mt-3 h-28 w-full rounded-md border p-2 font-mono text-xs"
          placeholder="clientName,invoiceId,amount,currency,dueDate&#10;Acme,INV-001,1200,USD,2026-07-01"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
      </div>

      <div className="mt-6 rounded-xl border p-4">
        <h2 className="font-semibold">2. Validation table</h2>
        {parsed.valid.length === 0 && parsed.errors.length === 0 && (
          <p className="text-sm text-muted-foreground">No rows yet.</p>
        )}
        {parsed.valid.length > 0 && (
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th>Client</th><th>Invoice</th><th>Amount</th><th>Due</th><th>Days overdue</th>
              </tr>
            </thead>
            <tbody>
              {parsed.valid.map((r) => (
                <tr key={r.invoiceId} className="border-t">
                  <td>{r.clientName}</td><td>{r.invoiceId}</td>
                  <td>{r.currency} {r.amount.toFixed(2)}</td>
                  <td>{r.dueDate}</td><td>{r.daysOverdue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {parsed.errors.length > 0 && (
          <ul className="mt-2 text-sm text-red-600">{parsed.errors.map((e) => <li key={e}>{e}</li>)}</ul>
        )}
        <button
          onClick={handleChase}
          disabled={parsed.valid.length === 0 || balance < parsed.valid.length}
          className="mt-4 rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground disabled:opacity-50"
        >
          Chase {parsed.valid.length} invoice(s) — {parsed.valid.length} credit(s)
        </button>
        {chased && <p className="mt-2 text-sm text-green-700">Chased + logged to vault.</p>}
      </div>

      <div className="mt-6 rounded-xl border p-4">
        <h2 className="font-semibold">3. 4-step chase sequence preview (first invoice)</h2>
        {seq.map((s) => (
          <div key={s.key} className="mt-3 rounded-md bg-muted p-3 text-sm">
            <div className="font-semibold">[{s.key}] {s.subject}</div>
            <pre className="mt-1 whitespace-pre-wrap">{s.body}</pre>
          </div>
        ))}
        {seq.length === 0 && <p className="text-sm text-muted-foreground">Upload rows to preview.</p>}
      </div>

      <div className="mt-6 rounded-xl border p-4">
        <h2 className="font-semibold">4. Vault + export</h2>
        <div className="mt-3 flex gap-2">
          <button onClick={() => download("overdue-chase.csv", toCsv(parsed.valid), "text/csv")} className="rounded-md border px-4 py-2 text-sm">
            Export CSV
          </button>
          <button onClick={() => downloadPdf(parsed.valid)} className="rounded-md border px-4 py-2 text-sm">
            Export PDF
          </button>
        </div>
        <ul className="mt-3 text-sm text-muted-foreground">
          {parsed.valid.map((r) => <li key={r.invoiceId}>vault · {r.clientName} · {r.invoiceId}</li>)}
        </ul>
      </div>
    </div>
  );
}

export default function Page() {
  if (!getClerkPublishableKey()) return <div className="mx-auto max-w-6xl px-4 py-12">Auth not configured. Set Clerk keys via scripts/seed-env.sh.</div>;
  return <WorkbenchInner />;
}
