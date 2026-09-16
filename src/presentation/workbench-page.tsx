"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "../../convex/_generated/api";
import { buildChaseSequence, parseCsv, validateInvoiceRow, type Invoice } from "@/domain/invoices";
import { getConvexUrl, getClerkPublishableKey } from "@/infrastructure/env";
import { ReminderDispatchSection } from "@/presentation/reminders-section";

const SAMPLE_CSV = `clientName,invoiceId,amount,currency,dueDate,email
Acme Corp,INV-001,1200,USD,2026-07-01,ap@acme-corp.example
Globex,INV-002,850.5,USD,2026-07-05,finance@globex.example
Initech,INV-003,4300,EUR,2026-07-10,accounts@initech.example
Umbrella Co,INV-004,975,USD,2026-07-12,billing@umbrella-co.example
Hooli,INV-005,2500,USD,2026-07-15,ap@hooli.example
Stark Industries,INV-006,11200,USD,2026-07-18,finance@stark-industries.example
Wayne Enterprises,INV-007,640,GBP,2026-07-20,accounts@wayne-enterprises.example
Massive Dynamic,INV-008,1890,USD,2026-07-22,ap@massive-dynamic.example
Cyberdyne,INV-009,3300,USD,2026-07-25,billing@cyberdyne.example
Tyrell Corp,INV-010,720,EUR,2026-07-28,finance@tyrell-corp.example`;

function toCsv(rows: Invoice[]): string {
  const header = "clientName,invoiceId,amount,currency,dueDate,email,daysOverdue,status";
  const lines = rows.map((r) =>
    [r.clientName, r.invoiceId, String(r.amount), r.currency, r.dueDate, r.email, String(r.daysOverdue), r.status].join(","),
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
  const historyArgs = convexReady ? { ownerClerkId: user!.id } : "skip";
  const pastSubmissions = useQuery(
    convexReady ? (api as any).submissions.listByOwner : ("skip" as any),
    historyArgs,
  ) as Array<{ _id: string; clientName: string; invoiceId: string; amount: number; status: string; creditsUsed: number; createdAt: number }> | undefined;
  const vaultEntries = useQuery(
    convexReady ? (api as any).vault.listByOwner : ("skip" as any),
    historyArgs,
  ) as Array<{ _id: string; kind: string; title: string; createdAt: number }> | undefined;

  const [raw, setRaw] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [chasedIds, setChasedIds] = useState<string[]>([]);

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

  useEffect(() => {
    if (convexReady && user && balance === null) {
      ensureCredits({ clerkId: user.id }).catch(() => {});
    }
  }, [convexReady, user, balance, ensureCredits]);

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
        <p className="mt-2" style={{ color: "var(--color-muted)" }}>Backend is not configured. Set NEXT_PUBLIC_CONVEX_URL via scripts/seed-env.sh.</p>
      </div>
    );
  }

  if (balance === null) {
    return <div className="mx-auto max-w-6xl px-4 py-12">Loading credits…</div>;
  }

  if (balance <= 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="font-display text-3xl font-semibold" style={{ color: "var(--color-ink)" }}>Out of credits</h1>
        <p className="mt-2" style={{ color: "var(--color-muted)" }}>Chasing costs 1 credit per invoice. Top up to keep clearing invoices.</p>
        <form action="/api/checkout" method="POST" className="mt-6">
          <button type="submit" className="hallmark-btn hallmark-btn-primary px-6 py-3 font-semibold">
            Buy 100 credits — $99
          </button>
        </form>
        {added && <p className="mt-4 text-sm">Credits added — balance is refreshing…</p>}
      </div>
    );
  }

  const selectedInvoice: Invoice | null =
    parsed.valid.find((v) => v.invoiceId === selectedInvoiceId) ?? parsed.valid[0] ?? null;
  const seq = selectedInvoice ? buildChaseSequence(selectedInvoice) : [];
  const isAlreadyChased =
    parsed.valid.length > 0 &&
    chasedIds.length > 0 &&
    parsed.valid.every((v) => chasedIds.includes(v.invoiceId));
  const sortedHistory = pastSubmissions ? [...pastSubmissions].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)) : undefined;
  const sortedVault = vaultEntries ? [...vaultEntries].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)) : undefined;

  function handleRawChange(next: string) {
    setRaw(next);
    setChasedIds([]);
  }

  function handleLoadSample() {
    setRaw(SAMPLE_CSV);
    setSelectedInvoiceId(null);
    setChasedIds([]);
  }

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
    setChasedIds(parsed.valid.map((v) => v.invoiceId));
  }

  return (
    <div className="font-body-x mx-auto max-w-6xl px-4 py-10" style={{ background: "var(--color-paper)" }}>
      {added && (
        <p className="mb-4 rounded-md border p-3 text-sm" style={{ borderColor: "var(--color-rule-2)" }}>
          Credits added — balance updated.
        </p>
      )}
      <p className="mono-label" style={{ color: "var(--color-muted)" }}>
        Workbench · 1 credit / invoice
      </p>
      <h1 className="font-display mt-2 text-3xl font-semibold" style={{ color: "var(--color-ink)" }}>
        Chase workbench
      </h1>
      <p className="tnum mt-1" style={{ color: "var(--color-muted)" }}>
        Balance: {balance} credits · 1 credit per invoice
      </p>

      <div className="mt-6 rounded-[10px] border p-4" style={{ borderColor: "var(--color-rule-2)" }}>
        <h2 className="font-semibold" style={{ color: "var(--color-ink)" }}>
          1. Upload CSV of overdue invoices
        </h2>
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>Columns: clientName,invoiceId,amount,currency,dueDate,email (optional)</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="file"
            accept=".csv"
            className="text-sm"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) f.text().then((t) => { setRaw(t); setSelectedInvoiceId(null); setChasedIds([]); });
            }}
          />
          <button
            type="button"
            onClick={handleLoadSample}
            className="hallmark-btn rounded-md border px-4 py-2 text-sm"
            style={{ borderColor: "var(--color-rule-2)" }}
          >
            Load sample (10 invoices)
          </button>
        </div>
        <textarea
          className="mt-3 h-28 w-full rounded-md border p-2 font-mono text-xs"
          placeholder="clientName,invoiceId,amount,currency,dueDate,email&#10;Acme,INV-001,1200,USD,2026-07-01,ap@acme-corp.example"
          value={raw}
          onChange={(e) => handleRawChange(e.target.value)}
        />
      </div>

      <div className="mt-6 rounded-[10px] border p-4" style={{ borderColor: "var(--color-rule-2)" }}>
        <h2 className="font-semibold" style={{ color: "var(--color-ink)" }}>
          2. Validation table
        </h2>
        {parsed.valid.length === 0 && parsed.errors.length === 0 && (
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>No rows yet.</p>
        )}
        {parsed.valid.length > 0 && (
          <table className="tnum mt-2 w-full text-sm">
            <thead>
              <tr className="mono-label text-left" style={{ color: "var(--color-muted)" }}>
                <th>Client</th><th>Invoice</th><th>Amount</th><th>Due</th><th>Email</th><th>Days overdue</th><th>State</th>
              </tr>
            </thead>
            <tbody>
              {parsed.valid.map((r) => {
                const isSelected = selectedInvoice?.invoiceId === r.invoiceId;
                const isChased = chasedIds.includes(r.invoiceId);
                return (
                  <tr
                    key={r.invoiceId}
                    onClick={() => setSelectedInvoiceId(r.invoiceId)}
                    className="cursor-pointer border-t"
                    style={isSelected ? { background: "var(--color-chip-bg)" } : undefined}
                  >
                    <td>{r.clientName}</td><td>{r.invoiceId}</td>
                    <td>{r.currency} {r.amount.toFixed(2)}</td>
                    <td>{r.dueDate}</td><td>{r.email || "—"}</td><td>{r.daysOverdue}</td>
                    <td style={{ color: "var(--color-muted)" }}>{isChased ? "chased" : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {parsed.errors.length > 0 && (
          <ul className="mt-2 text-sm" style={{ color: "var(--color-warning)" }}>{parsed.errors.map((e) => <li key={e}>{e}</li>)}</ul>
        )}
        <button
          onClick={handleChase}
          disabled={parsed.valid.length === 0 || balance < parsed.valid.length || isAlreadyChased}
          className="hallmark-btn hallmark-btn-primary mt-4 px-5 py-2.5 font-semibold disabled:opacity-50"
        >
          {isAlreadyChased
            ? `Chased ${parsed.valid.length} invoice(s) — already logged`
            : `Chase ${parsed.valid.length} invoice(s) — ${parsed.valid.length} credit(s)`}
        </button>
        {isAlreadyChased && (
          <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
            Chased {chasedIds.length} invoice(s) · used {chasedIds.length} credit(s) · balance now {balance}. Edit the CSV to chase a new batch.
          </p>
        )}
        {!isAlreadyChased && chasedIds.length === 0 && parsed.valid.length > 0 && (
          <p className="tnum mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
            Projected balance after chase: {balance - parsed.valid.length}
          </p>
        )}
      </div>

      <div className="mt-6 rounded-[10px] border p-4" style={{ borderColor: "var(--color-rule-2)" }}>
        <h2 className="font-semibold" style={{ color: "var(--color-ink)" }}>
          3. 4-step chase sequence preview{selectedInvoice ? ` (${selectedInvoice.invoiceId})` : ""}
        </h2>
        {parsed.valid.length > 0 && (
          <label className="mt-3 block text-sm" style={{ color: "var(--color-muted)" }}>
            Invoice{" "}
            <select
              className="mt-1 rounded-md border p-2 text-sm"
              style={{ borderColor: "var(--color-rule-2)", color: "var(--color-ink)" }}
              value={selectedInvoice?.invoiceId ?? ""}
              onChange={(e) => setSelectedInvoiceId(e.target.value || null)}
            >
              {parsed.valid.map((v) => (
                <option key={v.invoiceId} value={v.invoiceId}>
                  {v.invoiceId} — {v.clientName}
                </option>
              ))}
            </select>
          </label>
        )}
        {seq.map((s) => (
          <div key={s.key} className="code-card mt-3 p-3 text-sm">
            <div className="font-semibold"><span className="tok-key">[{s.key}]</span> <span className="tok-str">{s.subject}</span></div>
            <pre className="tok-dim mt-1 whitespace-pre-wrap">{s.body}</pre>
          </div>
        ))}
        {seq.length === 0 && <p className="text-sm" style={{ color: "var(--color-muted)" }}>Upload rows to preview.</p>}
      </div>

      <div className="mt-6 rounded-[10px] border p-4" style={{ borderColor: "var(--color-rule-2)" }}>
        <h2 className="font-semibold" style={{ color: "var(--color-ink)" }}>
          4. Vault + export
        </h2>
        <div className="mt-3">
          <h3 className="mono-label" style={{ color: "var(--color-muted)" }}>Persisted history</h3>
          {sortedHistory === undefined && (
            <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>Loading history…</p>
          )}
          {sortedHistory !== undefined && sortedHistory.length === 0 && (
            <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>No past chases yet — chase a batch to log it here.</p>
          )}
          {sortedHistory !== undefined && sortedHistory.length > 0 && (
            <ul className="tnum mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
              {sortedHistory.map((h) => (
                <li key={h._id}>
                  {h.clientName} · {h.invoiceId} · status: {h.status} · credits used: {h.creditsUsed}
                </li>
              ))}
            </ul>
          )}
          {sortedVault !== undefined && sortedVault.length > 0 && (
            <ul className="tnum mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
              {sortedVault.map((v) => (
                <li key={v._id}>
                  vault · {v.kind} · {v.title}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={() => download("overdue-chase.csv", toCsv(parsed.valid), "text/csv")} className="hallmark-btn rounded-md border px-4 py-2 text-sm" style={{ borderColor: "var(--color-rule-2)" }}>
            Export CSV
          </button>
          <button onClick={() => downloadPdf(parsed.valid)} className="hallmark-btn rounded-md border px-4 py-2 text-sm" style={{ borderColor: "var(--color-rule-2)" }}>
            Export PDF
          </button>
        </div>
        <ul className="tnum mt-3 text-sm" style={{ color: "var(--color-muted)" }}>
          {parsed.valid.map((r) => <li key={r.invoiceId}>vault · {r.clientName} · {r.invoiceId}</li>)}
        </ul>
      </div>

      <ReminderDispatchSection userId={user.id} />
    </div>
  );
}

export default function Page() {
  if (!getClerkPublishableKey()) return <div className="mx-auto max-w-6xl px-4 py-12">Auth not configured. Set Clerk keys via scripts/seed-env.sh.</div>;
  return <WorkbenchInner />;
}
