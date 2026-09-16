"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import Link from "next/link";
import { getConvexUrl, getClerkPublishableKey } from "@/infrastructure/env";
import { api } from "../../convex/_generated/api";

function fmtDate(ts: number) {
  return new Date(ts).toLocaleString();
}

export default function Page() {
  if (!getClerkPublishableKey())
    return <div className="mx-auto max-w-6xl px-4 py-12">Auth not configured. Set Clerk keys via scripts/seed-env.sh.</div>;
  return <DataInner />;
}

function DataInner() {
  const { isLoaded, user } = useUser();
  const convexUrl = getConvexUrl();
  const ready = Boolean(convexUrl && user);
  const submissions = useQuery(
    ready ? (api as any).submissions.listByOwner : ("skip" as any),
    ready ? { ownerClerkId: user!.id } : "skip",
  ) as any[] | undefined;
  const vault = useQuery(
    ready ? (api as any).vault.listByOwner : ("skip" as any),
    ready ? { ownerClerkId: user!.id } : "skip",
  ) as any[] | undefined;

  if (!isLoaded) return <div className="mx-auto max-w-6xl px-4 py-12">Loading…</div>;
  if (!user)
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <p>
          Please <Link className="underline" href="/sign-in">sign in</Link> to view your data.
        </p>
      </div>
    );
  if (!convexUrl)
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="text-2xl font-bold">Data unavailable</h1>
        <p className="mt-2" style={{ color: "var(--color-muted)" }}>Backend is not configured. Set NEXT_PUBLIC_CONVEX_URL via scripts/seed-env.sh.</p>
      </div>
    );

  const totalChased = (submissions ?? []).length;
  const creditsSpent = (submissions ?? []).reduce((s: number, r: any) => s + (r.creditsUsed ?? 0), 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10" style={{ background: "var(--color-paper)" }}>
      <p className="mono-label" style={{ color: "var(--color-muted)" }}>Data · tracked invoices</p>
      <h1 className="font-display mt-2 text-3xl font-semibold" style={{ color: "var(--color-ink)" }}>
        Your chase data
      </h1>
      <p className="tnum mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
        {totalChased} invoice(s) chased · {creditsSpent} credit(s) spent
      </p>

      <div className="mt-6 rounded-[10px] border p-4" style={{ borderColor: "var(--color-rule-2)" }}>
        <h2 className="font-semibold" style={{ color: "var(--color-ink)" }}>Tracked invoices</h2>
        {!submissions ? (
          <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>Loading…</p>
        ) : submissions.length === 0 ? (
          <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
            Nothing tracked yet. <Link className="underline" href="/app">Chase invoices in the workbench →</Link>
          </p>
        ) : (
          <table className="tnum mt-2 w-full text-sm">
            <thead>
              <tr className="mono-label text-left" style={{ color: "var(--color-muted)" }}>
                <th>Client</th><th>Invoice</th><th>Amount</th><th>Status</th><th>Credits</th><th>Logged</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((r: any) => (
                <tr key={r._id} className="border-t">
                  <td>{r.clientName}</td><td>{r.invoiceId}</td>
                  <td>{Number(r.amount).toFixed(2)}</td><td>{r.status}</td>
                  <td>{r.creditsUsed}</td><td>{r.createdAt ? fmtDate(r.createdAt) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-6 rounded-[10px] border p-4" style={{ borderColor: "var(--color-rule-2)" }}>
        <h2 className="font-semibold" style={{ color: "var(--color-ink)" }}>Vault log</h2>
        {!vault ? (
          <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>Loading…</p>
        ) : vault.length === 0 ? (
          <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>Vault is empty.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {vault.map((v: any) => (
              <li key={v._id} className="rounded-md border p-2" style={{ borderColor: "var(--color-rule-2)" }}>
                <span className="mono-label" style={{ color: "var(--color-muted)" }}>{v.kind}</span>{" "}
                <span className="font-semibold">{v.title}</span>{" "}
                <span style={{ color: "var(--color-muted)" }}>{v.createdAt ? fmtDate(v.createdAt) : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
