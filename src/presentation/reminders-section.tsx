"use client";

import { useMutation, useQuery } from "convex/react";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { api } from "../../convex/_generated/api";

type Reminder = {
  _id: string;
  clientName: string;
  invoiceId: string;
  recipientEmail?: string;
  recipientPhone?: string;
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
type Channel = (typeof CHANNELS)[number];

const CHANNEL_LABEL: Record<Channel, string> = { email: "Email", sms: "SMS", push: "Push" };

function channelLabel(value?: string | null): string {
  const v = (value ?? "email").trim().toLowerCase();
  if (v === "email") return "Email";
  if (v === "sms") return "SMS";
  if (v === "push") return "Push";
  // Titlecase anything unexpected instead of leaking raw lowercase.
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : "Email";
}

function normalizeChannel(value?: string | null): Channel {
  const v = (value ?? "email").trim().toLowerCase();
  return v === "sms" || v === "push" ? (v as Channel) : "email";
}

function titlecaseStatus(value?: string | null): string {
  const v = (value ?? "").trim().toLowerCase().replace(/_/g, " ");
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : "—";
}

function Pill({ tone, children }: { tone: "ok" | "bad" | "muted"; children: ReactNode }) {
  const color =
    tone === "ok" ? "var(--color-ok)" : tone === "bad" ? "var(--color-warning)" : "var(--color-muted)";
  return (
    <span
      className="mono-label inline-block rounded-full border px-2.5 py-0.5"
      style={{ borderColor: "var(--color-rule-2)", color }}
    >
      {children}
    </span>
  );
}

function StatusPill({ status }: { status?: string | null }) {
  const v = (status ?? "").trim().toLowerCase();
  const tone = v === "sent" ? "ok" : v === "failed" ? "bad" : "muted";
  return <Pill tone={tone}>{titlecaseStatus(status)}</Pill>;
}

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
  const decisions = useQuery((api as any).reminders.listDecisions, {
    ownerClerkId: userId,
    limit: 20,
  }) as Array<{ _id: string }> | undefined;

  const doSetScheduler = useMutation((api as any).reminders.setScheduler);
  const doSweep = useMutation((api as any).reminders.runDueSweepForOwner);
  const doApprove = useMutation((api as any).reminders.approve);
  const doSkip = useMutation((api as any).reminders.skip);
  const doSetChannel = useMutation((api as any).reminders.setChannel);
  const doRetry = useMutation((api as any).reminders.retry);

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
    // Per-row channel override wins; the queued channel is the default.
    // Persisted first so the audit trail (vault log) matches what was sent.
    const channel = normalizeChannel(rowChannel[r._id] ?? r.channel);
    // Recipient follows the channel: SMS needs the phone number, Email/Push
    // use the email address.
    const to =
      channel === "sms"
        ? (r.recipientPhone?.trim() || "")
        : (r.recipientEmail?.trim() || "");
    try {
      if (normalizeChannel(r.channel) !== channel) {
        await doSetChannel({ ownerClerkId: userId, reminderId: r._id, channel });
      }
      await doApprove({ ownerClerkId: userId, reminderId: r._id });
      const res = await fetch("/api/reminders/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Pass the queued per-invoice recipient through; the send route
        // prioritizes explicit `to` > reminder.recipientEmail > RESEND_TO.
        body: JSON.stringify({
          reminderId: r._id,
          channel,
          ...(to ? { to } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `send failed (${res.status})`);
      const recipients = typeof data?.recipients === "number" ? data.recipients : null;
      const onesignalId = typeof data?.onesignalId === "string" ? data.onesignalId : null;
      setRowOk((m) => ({
        ...m,
        [r._id]:
          recipients === 0
            ? `Accepted by OneSignal but 0 recipients — the address is likely not subscribed in this OneSignal app, or the email sender is not configured. Check the OneSignal dashboard (Messages → Delivery, Audience, Settings → Email).`
            : `Approved + sent via ${channelLabel(channel)}${recipients !== null ? ` — ${recipients} recipient(s)` : ""}${onesignalId ? ` · ID ${onesignalId}` : ""}.`,
      }));
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

  async function handleRetry(r: Reminder) {
    setRowError((m) => ({ ...m, [r._id]: "" }));
    setRowOk((m) => ({ ...m, [r._id]: "" }));
    markBusy(r._id, true);
    try {
      await doRetry({ ownerClerkId: userId, reminderId: r._id });
      setRowOk((m) => ({ ...m, [r._id]: "Re-queued for approval — pick a channel above and Approve + Send." }));
    } catch (e: any) {
      setRowError((m) => ({ ...m, [r._id]: e?.message ?? "retry failed" }));
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
                  <td>
                    {r.recipientEmail?.trim() ? r.recipientEmail : "—"}
                    {r.recipientPhone?.trim() ? ` · ${r.recipientPhone.trim()}` : ""}
                  </td>
                  <td>{r.stepKey}</td>
                  <td className="max-w-[280px] truncate" title={r.subject}>
                    {r.subject}
                  </td>
                  <td>
                    <select
                      aria-label={`Channel for ${r.invoiceId}`}
                      className="rounded-md border p-1 text-xs"
                      style={{ borderColor: "var(--color-rule-2)", color: "var(--color-ink)" }}
                      value={normalizeChannel(rowChannel[r._id] ?? r.channel)}
                      onChange={(e) =>
                        setRowChannel((m) => ({ ...m, [r._id]: normalizeChannel(e.target.value) }))
                      }
                      disabled={isBusy(r._id)}
                    >
                      {CHANNELS.map((c) => (
                        <option key={c} value={c}>
                          {CHANNEL_LABEL[c]}
                        </option>
                      ))}
                    </select>
                  </td>
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
                        {rowError[r._id]}{" "}
                        {/connect OneSignal/i.test(rowError[r._id]) && (
                          <Link className="underline" href="/connect">
                            Open /connect
                          </Link>
                        )}
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
        Recent sweep decisions
      </h3>
      <p className="mt-1 text-xs" style={{ color: "var(--color-muted)" }}>
        What the intelligent sweep decided per invoice — queue a reminder (Email/SMS) or do nothing, and why. Decisions never send; sending still needs your approval above.
      </p>
      {decisions === undefined && (
        <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
          Loading decisions…
        </p>
      )}
      {decisions !== undefined && decisions.length === 0 && (
        <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
          No sweep decisions yet — run a sweep.
        </p>
      )}
      {decisions !== undefined && decisions.length > 0 && (
        <div className="mt-2 overflow-x-auto">
          <table className="tnum w-full text-sm">
            <thead>
              <tr className="mono-label text-left" style={{ color: "var(--color-muted)" }}>
                <th>Decision</th>
                <th>Invoice</th>
                <th>Step</th>
                <th>Reason</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {decisions.map((d: any) => (
                <tr key={d._id} className="border-t">
                  <td>
                    <span
                      style={{
                        color:
                          d.action === "queue"
                            ? d.channel === "sms"
                              ? "var(--color-warning)"
                              : "var(--color-ok)"
                            : "var(--color-muted)",
                        fontWeight: 600,
                      }}
                    >
                      {d.action === "queue" ? `Queue ${channelLabel(d.channel)}` : "Do nothing"}
                    </span>
                  </td>
                  <td>{d.invoiceId}</td>
                  <td>{d.stepKey ?? "—"}</td>
                  <td className="max-w-[320px]">
                    {d.reason}
                    {d.detail ? <span style={{ color: "var(--color-muted)" }}> — {d.detail}</span> : ""}
                  </td>
                  <td style={{ color: "var(--color-muted)" }}>{fmtUtc(d.createdAt)}</td>
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
        <div className="mt-2 overflow-x-auto">
          <table className="tnum w-full text-sm">
            <thead>
              <tr className="mono-label text-left" style={{ color: "var(--color-muted)" }}>
                <th>Client</th>
                <th>Invoice</th>
                <th>Step</th>
                <th>Channel</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Sent</th>
                <th>Error</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={r._id} className="border-t">
                  <td>{r.clientName}</td>
                  <td>{r.invoiceId}</td>
                  <td>{r.stepKey}</td>
                  <td><Pill tone="muted">{channelLabel(r.channel)}</Pill></td>
                  <td><StatusPill status={r.status} /></td>
                  <td>{typeof r.attempts === "number" ? r.attempts : "—"}</td>
                  <td>{typeof r.sentAt === "number" ? fmtUtc(r.sentAt) : "—"}</td>
                  <td className="max-w-[280px]">
                    {r.lastError ? (
                      <span title={r.lastError} className="block truncate">
                        {r.lastError}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <div className="flex flex-wrap items-center gap-2 py-1">
                      {r.status === "failed" && (
                        <button
                          type="button"
                          onClick={() => handleRetry(r)}
                          disabled={isBusy(r._id)}
                          className="underline disabled:opacity-50"
                        >
                          {isBusy(r._id) ? "Working…" : "Retry"}
                        </button>
                      )}
                      {/connect OneSignal/i.test(r.lastError ?? "") && (
                        <Link className="underline" href="/connect">
                          Open /connect
                        </Link>
                      )}
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
    </div>
  );
}
