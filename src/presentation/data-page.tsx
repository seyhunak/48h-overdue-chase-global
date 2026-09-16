"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { getConvexUrl, getClerkPublishableKey } from "@/infrastructure/env";
import { api } from "../../convex/_generated/api";

function fmtDate(ts: number) {
  return new Date(ts).toLocaleString();
}

function fmtUtc(ms: number | null | undefined) {
  if (typeof ms !== "number") return "—";
  try {
    return `${new Date(ms).toISOString().slice(0, 16).replace("T", " ")} UTC`;
  } catch {
    return "—";
  }
}

function fmtDiff(diffDays: number | null) {
  if (diffDays === null || diffDays === undefined) return "—";
  return diffDays > 0 ? `+${diffDays}` : `${diffDays}`;
}

type BoundaryRow = {
  invoiceId: string;
  clientName: string;
  amount: number;
  currency: string;
  dueDate: string;
  email: string;
  diffDays: number | null;
  dueStep: string | null;
  touches: number;
  paid: boolean;
  unsubscribed: boolean;
  lastTouchAt: number | null;
  steps: Array<{
    stepKey: string;
    status: string;
    scheduledFor: number;
    sentAt: number | null;
    attempts: number;
    lastError: string | null;
  }>;
  skipReasons: string[];
  createdAt: number;
};

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
  const boundary = useQuery(
    ready ? (api as any).reminders.getBoundaryMap : ("skip" as any),
    ready ? { ownerClerkId: user!.id } : "skip",
  ) as BoundaryRow[] | undefined;
  const [expanded, setExpanded] = useState<string[]>([]);
  const [opBusy, setOpBusy] = useState<string | null>(null);
  const [opError, setOpError] = useState<string | null>(null);
  const doMarkPaid = useMutation((api as any).reminders.markPaid);
  const doReopen = useMutation((api as any).reminders.reopen);
  const doUnsub = useMutation((api as any).reminders.setUnsubscribed);
  const doResub = useMutation((api as any).reminders.resubscribe);

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

  const toggle = (id: string) =>
    setExpanded((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10" style={{ background: "var(--color-paper)" }}>
      <p className="mono-label" style={{ color: "var(--color-muted)" }}>Data · tracked invoices</p>
      <h1 className="font-display mt-2 text-3xl font-semibold" style={{ color: "var(--color-ink)" }}>
        Your follow-up data
      </h1>
      <p className="tnum mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
        {totalChased} invoice(s) followed up · {creditsSpent} credit(s) spent
      </p>

      <div className="mt-6 rounded-[10px] border p-4" style={{ borderColor: "var(--color-rule-2)" }}>
        <p className="mono-label" style={{ color: "var(--color-muted)" }}>Ladder · live gates</p>
        <h2 className="font-semibold" style={{ color: "var(--color-ink)" }}>Boundary map</h2>
        {!boundary ? (
          <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>Loading…</p>
        ) : boundary.length === 0 ? (
          <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
            Nothing tracked yet. <Link className="underline" href="/app">Follow up on invoices in the workbench →</Link>
          </p>
        ) : (
          <>
            <div className="mt-2 overflow-x-auto">
              <table className="tnum w-full text-sm">
                <thead>
                  <tr className="mono-label text-left" style={{ color: "var(--color-muted)" }}>
                    <th>Invoice</th><th>Client</th><th>Due</th><th>Days±</th><th>Step due now</th><th>Touches</th><th>Status</th><th>Flags</th><th>Skip reason</th><th>Operator</th>
                  </tr>
                </thead>
                <tbody>
                  {boundary.map((b) => {
                    const skip = b.skipReasons.length > 0 ? b.skipReasons[0] : "—";
                    const flags = [b.paid ? "paid" : null, b.unsubscribed ? "unsub" : null].filter(Boolean);
                    const isOpen = expanded.includes(b.invoiceId);
                    const derivedStatus = b.paid ? "paid" : b.unsubscribed ? "unsubscribed" : `active${b.dueStep ? ` · ${b.dueStep} due` : ""}`;
                    const runOp = async (kind: "paid" | "reopen" | "unsub" | "resub") => {
                      if (!user) return;
                      setOpError(null);
                      setOpBusy(`${b.invoiceId}:${kind}`);
                      try {
                        const ownerClerkId = user.id;
                        if (kind === "paid") await doMarkPaid({ ownerClerkId, invoiceId: b.invoiceId, paid: true });
                        else if (kind === "reopen") await doReopen({ ownerClerkId, invoiceId: b.invoiceId });
                        else if (kind === "unsub") await doUnsub({ ownerClerkId, invoiceId: b.invoiceId, unsubscribed: true });
                        else await doResub({ ownerClerkId, invoiceId: b.invoiceId });
                      } catch (e: any) {
                        setOpError(e?.message ?? "operator action failed");
                      } finally {
                        setOpBusy(null);
                      }
                    };
                    const busyFor = (k: string) => opBusy === `${b.invoiceId}:${k}`;
                    return (
                      <tr key={b.invoiceId} className="border-t">
                        <td>
                          <button
                            type="button"
                            onClick={() => toggle(b.invoiceId)}
                            className="underline"
                            title={isOpen ? "Collapse step history" : "Expand step history"}
                            style={{ color: "var(--color-ink)" }}
                          >
                            {b.invoiceId} {isOpen ? "▾" : "▸"}
                          </button>
                        </td>
                        <td>{b.clientName}</td>
                        <td>{b.dueDate || "—"}</td>
                        <td className="tnum">{fmtDiff(b.diffDays)}</td>
                        <td>{b.dueStep ?? "—"}</td>
                        <td className="tnum">{b.touches}/5</td>
                        <td>
                          <span
                            className="mono-label rounded-full border px-2 py-0.5"
                            style={{ borderColor: "var(--color-rule-2)", background: "var(--color-chip-bg)", color: "var(--color-ink)" }}
                          >
                            {derivedStatus}
                          </span>
                        </td>
                        <td>{flags.length > 0 ? flags.join(" · ") : "—"}</td>
                        <td
                          title={b.skipReasons.length > 1 ? b.skipReasons.join(" · ") : undefined}
                          style={{ color: "var(--color-muted)" }}
                        >
                          {skip}
                        </td>
                        <td>
                          <div className="flex flex-wrap items-center gap-1 py-1">
                            {!b.paid ? (
                              <button type="button" disabled={busyFor("paid")} onClick={() => runOp("paid")} className="rounded-md border px-2 py-1 text-xs disabled:opacity-50" style={{ borderColor: "var(--color-rule-2)" }}>
                                {busyFor("paid") ? "…" : "Mark paid"}
                              </button>
                            ) : (
                              <button type="button" disabled={busyFor("reopen")} onClick={() => runOp("reopen")} className="rounded-md border px-2 py-1 text-xs disabled:opacity-50" style={{ borderColor: "var(--color-rule-2)" }}>
                                {busyFor("reopen") ? "…" : "Reopen"}
                              </button>
                            )}
                            {!b.unsubscribed ? (
                              <button type="button" disabled={busyFor("unsub")} onClick={() => runOp("unsub")} className="rounded-md border px-2 py-1 text-xs disabled:opacity-50" style={{ borderColor: "var(--color-rule-2)" }}>
                                {busyFor("unsub") ? "…" : "Unsubscribe"}
                              </button>
                            ) : (
                              <button type="button" disabled={busyFor("resub")} onClick={() => runOp("resub")} className="rounded-md border px-2 py-1 text-xs disabled:opacity-50" style={{ borderColor: "var(--color-rule-2)" }}>
                                {busyFor("resub") ? "…" : "Resubscribe"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 space-y-2">
              {boundary.map((b) =>
                expanded.includes(b.invoiceId) ? (
                  <div
                    key={`${b.invoiceId}-steps`}
                    className="rounded-md border p-3 text-sm"
                    style={{ borderColor: "var(--color-rule-2)" }}
                  >
                    <p className="mono-label" style={{ color: "var(--color-muted)" }}>
                      {b.invoiceId} · step history ({b.steps.length})
                    </p>
                    {b.steps.length === 0 ? (
                      <p className="mt-1" style={{ color: "var(--color-muted)" }}>
                        No ladder steps attempted yet.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {b.steps.map((s, i) => (
                          <li
                            key={`${s.stepKey}-${i}`}
                            className="tnum rounded-md border p-2"
                            style={{ borderColor: "var(--color-rule-2)" }}
                          >
                            <span className="font-semibold">[{s.stepKey}]</span>{" "}
                            <span
                              className="mono-label rounded-full border px-2 py-0.5"
                              style={{
                                borderColor: "var(--color-rule-2)",
                                background: "var(--color-chip-bg)",
                                color: "var(--color-ink)",
                              }}
                            >
                              {s.status}
                            </span>{" "}
                            <span style={{ color: "var(--color-muted)" }}>
                              sched {fmtUtc(s.scheduledFor)} · sent {fmtUtc(s.sentAt)} · attempts {s.attempts}
                            </span>
                            {s.lastError ? (
                              <span className="block" style={{ color: "var(--color-warning)" }}>
                                error: {s.lastError}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null,
              )}
            </div>
            {opError && (
              <p className="mt-2 text-sm" style={{ color: "var(--color-warning)" }}>
                Operator error: {opError}
              </p>
            )}
          </>
        )}
      </div>

      <div className="mt-6 rounded-[10px] border p-4" style={{ borderColor: "var(--color-rule-2)" }}>
        <h2 className="font-semibold" style={{ color: "var(--color-ink)" }}>Tracked invoices</h2>
        {!submissions ? (
          <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>Loading…</p>
        ) : submissions.length === 0 ? (
          <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
            Nothing tracked yet. <Link className="underline" href="/app">Follow up on invoices in the workbench →</Link>
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
                  <td>{Number(r.amount).toFixed(2)}</td><td>{r.status === "chased" ? "followed up" : r.status}</td>
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
