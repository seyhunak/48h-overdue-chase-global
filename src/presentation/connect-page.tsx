"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getConvexUrl, getClerkPublishableKey } from "@/infrastructure/env";
import { api } from "../../convex/_generated/api";

type ConnectedAccount = { id: string; app: string; status: string };
type TestChannel = "email" | "whatsapp" | "sms" | "voice";

const TEST_CHANNELS: TestChannel[] = ["email", "whatsapp", "sms", "voice"];

function normalizeAccounts(raw: unknown): ConnectedAccount[] {
  if (!Array.isArray(raw)) return [];
  const out: ConnectedAccount[] = [];
  for (const a of raw) {
    if (typeof a === "string" && a.trim()) {
      out.push({ id: a.trim(), app: a.trim(), status: "UNKNOWN" });
    } else if (a && typeof a === "object") {
      const rec = a as { id?: unknown; app?: unknown; status?: unknown };
      const id = typeof rec.id === "string" ? rec.id.trim() : "";
      const app = typeof rec.app === "string" ? rec.app.trim() : "";
      const status =
        typeof rec.status === "string" && rec.status.trim() ? rec.status.trim().toUpperCase() : "UNKNOWN";
      if (id && app) out.push({ id, app, status });
    }
  }
  return out;
}

export default function Page() {
  if (!getClerkPublishableKey())
    return <div className="mx-auto max-w-6xl px-4 py-12">Auth not configured. Set Clerk keys via scripts/seed-env.sh.</div>;
  return <ConnectInner />;
}

function ConnectInner() {
  const { isLoaded, user } = useUser();
  const convexUrl = getConvexUrl();
  const ready = Boolean(convexUrl && user);
  const status = useQuery(
    ready ? (api as any).reminders.getComposioStatus : ("skip" as any),
    ready ? { ownerClerkId: user!.id } : "skip",
  ) as
    | {
        hasKey: boolean;
        composioUser: string;
        composioVerifiedAt: number | null;
        preferredAccount?: { whatsapp: string | null; sms: string | null; voice: string | null };
      }
    | undefined;
  const doSave = useMutation((api as any).reminders.saveComposioSettings);
  const doSavePreferred = useMutation((api as any).reminders.setPreferredAccounts);
  const doDisconnect = useMutation((api as any).reminders.clearComposioConnection);

  const defaultUser = user?.username ?? "default";
  const defaultEmail = user?.primaryEmailAddress?.emailAddress ?? "";
  const [composioUser, setComposioUser] = useState("default");
  const [apiKey, setApiKey] = useState("");
  const [touchedUser, setTouchedUser] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [busy, setBusy] = useState<"save" | "verify" | "preferred" | "disconnect" | null>(null);
  const [preferred, setPreferred] = useState<{ whatsapp: string; sms: string; voice: string }>({
    whatsapp: "",
    sms: "",
    voice: "",
  });
  const [touchedPreferred, setTouchedPreferred] = useState(false);
  const [preferredMsg, setPreferredMsg] = useState<string | null>(null);
  const [testTo, setTestTo] = useState<Record<TestChannel, string>>({
    email: "",
    whatsapp: "",
    sms: "",
    voice: "",
  });
  const [touchedTestTo, setTouchedTestTo] = useState<Record<TestChannel, boolean>>({
    email: false,
    whatsapp: false,
    sms: false,
    voice: false,
  });
  const [testBusy, setTestBusy] = useState<TestChannel | null>(null);
  const [testResult, setTestResult] = useState<Record<TestChannel, string>>({
    email: "",
    whatsapp: "",
    sms: "",
    voice: "",
  });

  useEffect(() => {
    if (!touchedUser) {
      if (status && typeof status.composioUser === "string" && status.composioUser) {
        setComposioUser(status.composioUser);
      } else if (isLoaded && user) {
        setComposioUser(defaultUser);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isLoaded, user]);

  useEffect(() => {
    if (!touchedPreferred && status?.preferredAccount) {
      setPreferred({
        whatsapp: status.preferredAccount.whatsapp ?? "",
        sms: status.preferredAccount.sms ?? "",
        voice: status.preferredAccount.voice ?? "",
      });
    }
  }, [status, touchedPreferred]);

  useEffect(() => {
    if (isLoaded && user && !touchedTestTo.email && !testTo.email && defaultEmail) {
      setTestTo((m) => ({ ...m, email: defaultEmail }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, user]);

  if (!isLoaded) return <div className="mx-auto max-w-6xl px-4 py-12">Loading…</div>;
  if (!user)
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <p>
          Please <Link className="underline" href="/sign-in">sign in</Link> to connect channels.
        </p>
      </div>
    );
  if (!convexUrl)
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="text-2xl font-bold">Connect unavailable</h1>
        <p className="mt-2" style={{ color: "var(--color-muted)" }}>Backend is not configured. Set NEXT_PUBLIC_CONVEX_URL via scripts/seed-env.sh.</p>
      </div>
    );

  const connected = status?.composioVerifiedAt != null;

  async function handleSave() {
    setSaveMsg(null);
    if (!apiKey.trim()) {
      setSaveMsg("Paste your Composio API key first.");
      return;
    }
    setBusy("save");
    try {
      await doSave({ ownerClerkId: user!.id, composioUser: composioUser.trim() || "default", composioKey: apiKey.trim() });
      setSaveMsg("Saved — now press Verify.");
      setApiKey("");
    } catch (e: any) {
      setSaveMsg(e?.message ?? "save failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleVerify() {
    setVerifyMsg("Verifying…");
    setAccounts([]);
    setBusy("verify");
    try {
      const res = await fetch("/api/connect/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          composioUser: composioUser.trim() || "default",
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `verify failed (${res.status})`);
      const list = normalizeAccounts(data?.accounts);
      setAccounts(list);
      setVerifyMsg(
        data?.connected
          ? `Connected — ${list.length} account(s) found. Pin one per channel below, then send a test.`
          : "Not connected — no linked accounts found. Connect an account in your Composio project, then Verify again.",
      );
    } catch (e: any) {
      setVerifyMsg(e?.message ?? "verify failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleSavePreferred() {
    setPreferredMsg(null);
    setBusy("preferred");
    try {
      await doSavePreferred({
        ownerClerkId: user!.id,
        ...(preferred.whatsapp ? { whatsapp: preferred.whatsapp } : {}),
        ...(preferred.sms ? { sms: preferred.sms } : {}),
        ...(preferred.voice ? { voice: preferred.voice } : {}),
      });
      setTouchedPreferred(false);
      setPreferredMsg("Preferred accounts saved — sends prefer the pinned account, else auto-match.");
    } catch (e: any) {
      setPreferredMsg(e?.message ?? "save failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleDisconnect() {
    setSaveMsg(null);
    setVerifyMsg(null);
    setPreferredMsg(null);
    setBusy("disconnect");
    try {
      await doDisconnect({ ownerClerkId: user!.id });
      setAccounts([]);
      setPreferred({ whatsapp: "", sms: "", voice: "" });
      setTouchedPreferred(false);
      setApiKey("");
      setSaveMsg("Disconnected — key removed. WhatsApp / SMS / voice sends return 502 until you reconnect.");
    } catch (e: any) {
      setSaveMsg(e?.message ?? "disconnect failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleTest(channel: TestChannel) {
    const to = testTo[channel].trim();
    setTestResult((m) => ({ ...m, [channel]: "" }));
    if (!to) {
      setTestResult((m) => ({ ...m, [channel]: "Enter your own address or number first." }));
      return;
    }
    setTestBusy(channel);
    try {
      const res = await fetch("/api/connect/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channel, to }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `test failed (${res.status})`);
      const detail =
        channel === "email"
          ? `Sent — resend id ${data?.resendId ?? "ok"}.`
          : `Sent via ${data?.app ?? "connected account"}${data?.accountId ? ` (${data.accountId})` : ""}${data?.action ? ` · ${data.action}` : ""}.`;
      setTestResult((m) => ({ ...m, [channel]: detail }));
    } catch (e: any) {
      setTestResult((m) => ({ ...m, [channel]: e?.message ?? "test failed" }));
    } finally {
      setTestBusy(null);
    }
  }

  function channelOptions(): ConnectedAccount[] {
    return accounts;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10" style={{ background: "var(--color-paper)" }}>
      <p className="mono-label" style={{ color: "var(--color-muted)" }}>Connect · multichannel</p>
      <h1 className="font-display mt-2 text-3xl font-semibold" style={{ color: "var(--color-ink)" }}>
        Connect follow-up channels
      </h1>
      <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
        Email sends via Resend — <span className="font-semibold" style={{ color: "var(--color-ink)" }}>no Gmail connection needed</span>.
        WhatsApp, SMS, and voice send via <span className="font-semibold" style={{ color: "var(--color-ink)" }}>your own accounts in your Composio project</span> —
        always with human approval, never auto-send.
      </p>
      <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
        Keys and accounts are per-customer: nothing is shared between ClearDue accounts.
      </p>
      <p className="mt-3">
        <span
          className="mono-label rounded-full border px-3 py-1"
          style={{
            borderColor: "var(--color-rule-2)",
            background: connected ? "var(--color-chip-bg)" : "transparent",
            color: "var(--color-ink)",
          }}
        >
          {status === undefined ? "Checking…" : connected ? "Connected" : "Not connected"}
        </span>
        {status?.composioVerifiedAt ? (
          <span className="tnum ml-2 text-xs" style={{ color: "var(--color-muted)" }}>
            verified {new Date(status.composioVerifiedAt).toISOString().slice(0, 16).replace("T", " ")} UTC
          </span>
        ) : null}
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-[10px] border p-4" style={{ borderColor: "var(--color-rule-2)" }}>
          <h2 className="font-semibold" style={{ color: "var(--color-ink)" }}>How to connect</h2>
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm" style={{ color: "var(--color-muted)" }}>
            <li>
              <span className="font-semibold" style={{ color: "var(--color-ink)" }}>Email: nothing to connect.</span>{" "}
              It sends via Resend out of the box — no Gmail connection needed.
            </li>
            <li>
              Open <span className="font-semibold" style={{ color: "var(--color-ink)" }}>app.composio.dev</span>,
              go to <span className="font-semibold" style={{ color: "var(--color-ink)" }}>your project</span>, and copy your API key.
            </li>
            <li>
              Paste the key below with your username and press{" "}
              <span className="font-semibold" style={{ color: "var(--color-ink)" }}>Save</span>, then{" "}
              <span className="font-semibold" style={{ color: "var(--color-ink)" }}>Verify</span>.
            </li>
            <li>
              In <span className="font-semibold" style={{ color: "var(--color-ink)" }}>your Composio project</span> connect{" "}
              <span className="font-semibold" style={{ color: "var(--color-ink)" }}>your own WhatsApp Business account</span> and{" "}
              <span className="font-semibold" style={{ color: "var(--color-ink)" }}>your own Twilio account</span>{" "}
              (Twilio covers SMS + voice), then press{" "}
              <span className="font-semibold" style={{ color: "var(--color-ink)" }}>Verify</span> again.
            </li>
            <li>
              Pin one account per channel below, then use{" "}
              <span className="font-semibold" style={{ color: "var(--color-ink)" }}>Send test</span> to confirm each channel reaches you.
            </li>
          </ol>
          <p className="mt-3 text-xs" style={{ color: "var(--color-muted)" }}>
            Your key and your connected accounts belong to you alone — per-customer, never shared.
          </p>
        </div>

        <div className="rounded-[10px] border p-4" style={{ borderColor: "var(--color-rule-2)" }}>
          <h2 className="font-semibold" style={{ color: "var(--color-ink)" }}>Composio credentials</h2>
          <label className="mt-3 block text-sm" style={{ color: "var(--color-muted)" }}>
            Username
            <input
              className="mt-1 w-full rounded-md border p-2 text-sm"
              style={{ borderColor: "var(--color-rule-2)", color: "var(--color-ink)" }}
              value={composioUser}
              onChange={(e) => {
                setTouchedUser(true);
                setComposioUser(e.target.value);
              }}
              placeholder="default"
              autoComplete="username"
            />
          </label>
          <label className="mt-3 block text-sm" style={{ color: "var(--color-muted)" }}>
            API key
            <input
              type="password"
              className="mt-1 w-full rounded-md border p-2 font-mono text-sm"
              style={{ borderColor: "var(--color-rule-2)", color: "var(--color-ink)" }}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={status?.hasKey ? "Saved — paste a new key to rotate" : "Paste key from app.composio.dev"}
              autoComplete="off"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={busy !== null}
              className="hallmark-btn hallmark-btn-primary px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {busy === "save" ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={handleVerify}
              disabled={busy !== null}
              className="hallmark-btn rounded-md border px-4 py-2 text-sm disabled:opacity-50"
              style={{ borderColor: "var(--color-rule-2)" }}
            >
              {busy === "verify" ? "Verifying…" : "Verify"}
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={busy !== null}
              className="hallmark-btn rounded-md border px-4 py-2 text-sm disabled:opacity-50"
              style={{ borderColor: "var(--color-rule-2)" }}
              title="Remove key + disconnect"
            >
              {busy === "disconnect" ? "Removing…" : "Remove key + disconnect"}
            </button>
          </div>
          {saveMsg && (
            <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
              {saveMsg}
            </p>
          )}
          {verifyMsg && (
            <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
              {verifyMsg}
            </p>
          )}
          {accounts.length > 0 && (
            <ul className="tnum mt-2 space-y-1 text-sm" style={{ color: "var(--color-muted)" }}>
              {accounts.map((a) => (
                <li key={a.id} className="rounded-md border p-2" style={{ borderColor: "var(--color-rule-2)" }}>
                  {a.app} · {a.id} · {a.status}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs" style={{ color: "var(--color-muted)" }}>
            Keys stay server-only and are never echoed back. Email sends via Resend (no Gmail needed); WhatsApp / SMS / voice dispatch through your own Composio accounts after approval.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-[10px] border p-4" style={{ borderColor: "var(--color-rule-2)" }}>
        <h2 className="font-semibold" style={{ color: "var(--color-ink)" }}>Preferred account per channel</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
          Pin one connected account for WhatsApp, SMS, and voice. Sends prefer the pinned account, else auto-match, else 502 until reconnected.
          {accounts.length === 0 ? " Verify first to list your accounts." : ""}
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {(["whatsapp", "sms", "voice"] as const).map((ch) => (
            <label key={ch} className="block text-sm" style={{ color: "var(--color-muted)" }}>
              {ch}
              <select
                className="mt-1 w-full rounded-md border p-2 text-sm"
                style={{ borderColor: "var(--color-rule-2)", color: "var(--color-ink)" }}
                value={preferred[ch]}
                disabled={busy !== null}
                onChange={(e) => {
                  setTouchedPreferred(true);
                  setPreferred((m) => ({ ...m, [ch]: e.target.value }));
                }}
              >
                <option value="">Auto-match</option>
                {channelOptions().map((a) => (
                  <option key={`${ch}-${a.id}`} value={a.id}>
                    {a.app} · {a.id} · {a.status}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSavePreferred}
            disabled={busy !== null}
            className="hallmark-btn hallmark-btn-primary px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {busy === "preferred" ? "Saving…" : "Save preferred accounts"}
          </button>
          {status?.preferredAccount && (
            <span className="tnum text-xs" style={{ color: "var(--color-muted)" }}>
              saved: whatsapp {status.preferredAccount.whatsapp ?? "auto"} · sms {status.preferredAccount.sms ?? "auto"} · voice {status.preferredAccount.voice ?? "auto"}
            </span>
          )}
        </div>
        {preferredMsg && (
          <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
            {preferredMsg}
          </p>
        )}
      </div>

      <div className="mt-4 rounded-[10px] border p-4" style={{ borderColor: "var(--color-rule-2)" }}>
        <h2 className="font-semibold" style={{ color: "var(--color-ink)" }}>Send a test per channel</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
          Tests send immediately to your own address or number — the Test click is the human approval.
          Vault-audited with test:true, no credit charge. Email goes via Resend.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {TEST_CHANNELS.map((ch) => (
            <div key={ch} className="rounded-md border p-3" style={{ borderColor: "var(--color-rule-2)" }}>
              <p className="mono-label" style={{ color: "var(--color-muted)" }}>{ch}</p>
              <label className="mt-2 block text-sm" style={{ color: "var(--color-muted)" }}>
                {ch === "email" ? "Your email address" : "Your phone number"}
                <input
                  className="mt-1 w-full rounded-md border p-2 text-sm"
                  style={{ borderColor: "var(--color-rule-2)", color: "var(--color-ink)" }}
                  value={testTo[ch]}
                  onChange={(e) => {
                    setTouchedTestTo((m) => ({ ...m, [ch]: true }));
                    setTestTo((m) => ({ ...m, [ch]: e.target.value }));
                  }}
                  placeholder={ch === "email" ? "you@company.com" : "+15551234567"}
                  inputMode={ch === "email" ? "email" : "tel"}
                  autoComplete="off"
                />
              </label>
              <button
                type="button"
                onClick={() => handleTest(ch)}
                disabled={testBusy !== null}
                className="hallmark-btn hallmark-btn-primary mt-2 px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {testBusy === ch ? "Sending…" : `Send test ${ch}`}
              </button>
              {testResult[ch] && (
                <p className="tnum mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
                  {testResult[ch]}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
