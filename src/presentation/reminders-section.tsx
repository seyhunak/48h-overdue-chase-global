"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";

type Reminder = {
  _id: string;
  clientName: string;
  invoiceId: string;
  recipientEmail?: string;
  channel?: string;
  stepKey: string;
  subject: string;
  scheduledFor: number;
  status: string;
  attempts: number;
  lastError?: string;
  sentAt?: number;
  createdAt: number;
};

const CHANNELS = ["email", "sms", "push"] as const;

function fmtUtc(ms: number): string {
  try {
    return `${new Date(ms).toISOString().slice(0, 16).replace("T", " ")} UTC`;
  } catch {
    return "—";
  }
}

export function ReminderDispatchSection({ userId }: { userId: string }) {
  const settings = useQuery((api as any).reminders.getSettings, { ownerClerkId: userId }) as any;
  const pending = useQuery((api as any).reminders.getPending, { ownerClerkId: userId }) as
    | Reminder[]
    | undefined;
  const history = useQuery((api as any).reminders.getHistory, {
    ownerClerkId: userId,
    limit: 50,
  }) as Reminder[] | undefined;

  const doSetScheduler = useMutation((api as any).reminders.setScheduler);
  const doSweep = useMutation((api as any).reminders.runDueSweepForOwner);
  const doApprove = useMutation((api as any).reminders.approve);
  const doSkip = useMutation((api as any).reminders.skip);

  const [busy, setBusy] = useState<string[]>([]);
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [rowOk, setRowOk] = useState<Record<string, string>>({});
  const [rowChannel, setRowChannel] = useState<Record<string, string>>({});
  const [sweepMsg, setSweepMsg] = useState<string | null>(null);

  const enabled = Boolean(settings?.schedulerEnabled);
  const isBusy = (id: string) => busy.includes(id);
  const markBusy = (id: string, on: boolean) =>
    setBusy((b) => (on ? [...b, id] : b.filter((x) => x !== id)));

  async function handleToggle() {
    setSweepMsg(null);
    try {
      await doSetScheduler({ ownerClerkId: userId, enabled: !enabled });
    } catch (e: any) {
      setSweepMsg(e?.message ?? "failed to update scheduler");
    }
  }

  async function handleSweep() {
    setSweepMsg("Sweeping…");
    try {
      const r = (await doSweep({ ownerClerkId: userId })) as {
        queued: number;
        skipped: Array<{ invoiceId: string; reason: string }>;
      };
      setSweepMsg(
        r.queued > 0
          ? `Sweep queued ${r.queued} reminder(s) for approval.`
          : "Sweep complete — nothing new to queue.",
      );
    } catch (e: any) {
      setSweepMsg(e?.message ?? "sweep failed");
    }
  }

  async function handleApproveAndSend(r: Reminder) {
    setRowError((m) => ({ ...m, [r._id]: "" }));
    setRowOk((m) => ({ ...m, [r._id]: "" }));
    markBusy(r._id, true);
    const channel = "email";
    try {
      await doApprove({ ownerClerkId: userId, reminderId: r._id });
      const res = await fetch("/api/reminders/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Pass the queued per-invoice recipient through; the send route
        // prioritizes explicit `to` > reminder.recipientEmail > RESEND_TO.
        body: JSON.stringify({
          reminderId: r._id,
          channel,
          ...(r.recipientEmail?.trim() ? { to: r.recipientEmail.trim() } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `send failed (${res.status})`);
      setRowOk((m) => ({ ...m, [r._id]: `Approved + sent via ${channel}.` }));
    } catch (e: any) {
      setRowError((m) => ({ ...m, [r._id]: e?.message ?? "failed" }));
    } finally {
      markBusy(r._id, false);
    }
  }

  async function handleSkip(r: Reminder) {
    setRowError((m) => ({ ...m, [r._id]: "" }));
    markBusy(r._id, true);
    try {
      await doSkip({ ownerClerkId: userId, reminderId: r._id });
    } catch (e: any) {
      setRowError((m) => ({ ...m, [r._id]: e?.message ?? "skip failed" }));
    } finally {
      markBusy(r._id, false);
    }
  }

  return (
    <div className="mt-6 rounded-[10px] border p-4" style={{ borderColor: "var(--color-rule-2)" }}>
      <p className="mono-label" style={{ color: "var(--color-muted)" }}>
        Reminders · human approval required
      </p>
      <h2 className="font-display mt-1 text-xl font-semibold" style={{ color: "var(--color-ink)" }}>
        5. Reminder dispatch
      </h2>
      <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
        The scheduler only queues drafts — nothing sends without your approval. Max 1 touch per
        invoice per day, max 5 touches, send window 09:00–18:00 UTC.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleToggle}
          disabled={settings === undefined}
          className="hallmark-btn rounded-md border px-4 py-2 text-sm disabled:opacity-50"
          style={{ borderColor: "var(--color-rule-2)" }}
        >
          Scheduler: {settings === undefined ? "…" : enabled ? "Enabled" : "Paused"}
        </button>
        <button
          type="button"
          onClick={handleSweep}
          className="hallmark-btn hallmark-btn-primary px-4 py-2 text-sm font-semibold"
        >
          Run due sweep now
        </button>
        {sweepMsg && (
          <span className="text-sm" style={{ color: "var(--color-muted)" }}>
            {sweepMsg}
          </span>
        )}
      </div>

      <h3 className="mono-label mt-5" style={{ color: "var(--color-muted)" }}>
        Pending approval
      </h3>
      {pending === undefined && (
        <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
          Loading queue…
        </p>
      )}
      {pending !== undefined && pending.length === 0 && (
        <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
          Queue is empty — run a sweep or follow up on new invoices.
        </p>
      )}
      {pending !== undefined && pending.length > 0 && (
        <div className="mt-2 overflow-x-auto">
          <table className="tnum w-full text-sm">
            <thead>
              <tr className="mono-label text-left" style={{ color: "var(--color-muted)" }}>
                <th>Client</th>
                <th>Invoice</th>
                <th>Recipient</th>
                <th>Step</th>
                <th>Subject</th>
                <th>Channel</th>
                <th>Scheduled</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((r) => (
                <tr key={r._id} className="border-t">
                  <td>{r.clientName}</td>
                  <td>{r.invoiceId}</td>
                  <td>{r.recipientEmail?.trim() ? r.recipientEmail : "—"}</td>
                  <td>{r.stepKey}</td>
                  <td className="max-w-[280px] truncate" title={r.subject}>
                    {r.subject}
                  </td>
                  <td>email</td>
                  <td>{fmtUtc(r.scheduledFor)}</td>
                  <td>
                    <div className="flex flex-wrap items-center gap-2 py-1">
                      <button
                        type="button"
                        onClick={() => handleApproveAndSend(r)}
                        disabled={isBusy(r._id)}
                        className="hallmark-btn hallmark-btn-primary px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                      >
                        {isBusy(r._id) ? "Working…" : "Approve + Send"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSkip(r)}
                        disabled={isBusy(r._id)}
                        className="hallmark-btn rounded-md border px-3 py-1.5 text-xs disabled:opacity-50"
                        style={{ borderColor: "var(--color-rule-2)" }}
                      >
                        Skip
                      </button>
                    </div>
                    {rowError[r._id] && (
                      <p className="text-xs" style={{ color: "var(--color-warning)" }}>
                        {rowError[r._id]}
                      </p>
                    )}
                    {rowOk[r._id] && (
                      <p className="text-xs" style={{ color: "var(--color-ok)" }}>
                        {rowOk[r._id]}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="mono-label mt-5" style={{ color: "var(--color-muted)" }}>
        Sent history
      </h3>
      {history === undefined && (
        <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
          Loading history…
        </p>
      )}
      {history !== undefined && history.length === 0 && (
        <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
          No reminders sent, skipped, or failed yet.
        </p>
      )}
      {history !== undefined && history.length > 0 && (
        <ul className="tnum mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
          {history.map((r) => (
            <li key={r._id}>
              {r.clientName} · {r.invoiceId} · {r.stepKey} · status: {r.status}
              {typeof r.sentAt === "number" ? ` · sent ${fmtUtc(r.sentAt)}` : ""}
              {typeof r.attempts === "number" ? ` · attempts: ${r.attempts}` : ""}
              {r.lastError ? ` · error: ${r.lastError}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
