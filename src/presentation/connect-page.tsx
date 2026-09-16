"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { getConvexUrl, getClerkPublishableKey } from "@/infrastructure/env";
import { api } from "../../convex/_generated/api";

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
  ) as { hasKey: boolean; composioUser: string; composioVerifiedAt: number | null } | undefined;

  // OneSignal config is env-only (server-side). Client just checks if env vars are set.
  const [providerStatus, setProviderStatus] = useState<{
    configured: boolean;
    channels: { email: boolean; sms: boolean; push: boolean };
    hasAppId: boolean;
    hasApiKey: boolean;
    hasEmailFrom: boolean;
    hasSmsFrom: boolean;
  } | null>(null);

  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [testBusy, setTestBusy] = useState<"email" | "sms" | "push" | null>(null);
  const [testTo, setTestTo] = useState("");
  const [testChannel, setTestChannel] = useState<"email" | "sms" | "push">("email");
  const [testSubject, setTestSubject] = useState("ClearDue test");
  const [testBody, setTestBody] = useState("Hi — this is your ClearDue test. OneSignal (email/sms/push) is connected. If you received this, your notification channel is ready for approved follow-ups.");

  useEffect(() => {
    if (!ready) return;
    fetch("/api/connect/provider-status")
      .then((r) => r.json())
      .then(setProviderStatus)
      .catch(() => setProviderStatus({ configured: false, channels: { email: false, sms: false, push: false }, hasAppId: false, hasApiKey: false, hasEmailFrom: false, hasSmsFrom: false }));
  }, [ready]);

  if (!isLoaded) return <div className="mx-auto max-w-6xl px-4 py-12">Loading…</div>;
  if (!user)
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <p>Please <Link className="underline" href="/sign-in">sign in</Link> to configure OneSignal.</p>
      </div>
    );
  if (!convexUrl)
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="text-2xl font-bold">Connect unavailable</h1>
        <p className="mt-2" style={{ color: "var(--color-muted)" }}>Backend is not configured. Set NEXT_PUBLIC_CONVEX_URL via scripts/seed-env.sh.</p>
      </div>
    );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10" style={{ background: "var(--color-paper)" }}>
      <p className="mono-label" style={{ color: "var(--color-muted)" }}>Connect · notification provider</p>
      <h1 className="font-display mt-2 text-3xl font-semibold" style={{ color: "var(--color-ink)" }}>
        OneSignal setup
      </h1>
      <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
        Follow-up reminders send via OneSignal (email / SMS / push) — always with human approval, never auto-send.
      </p>

      <div className="mt-4 rounded-[10px] border p-4" style={{ borderColor: "var(--color-rule-2)" }}>
        <h2 className="font-semibold" style={{ color: "var(--color-ink)" }}>Provider status</h2>
        {!providerStatus ? (
          <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>Checking…</p>
        ) : providerStatus.configured ? (
          <div className="mt-2 space-y-2">
            <p className="tnum text-sm" style={{ color: "var(--color-ink)" }}>
              <span style={{ color: "var(--color-muted)" }}>OneSignal App ID: </span>
              {process.env.ONESIGNAL_APP_ID ? "configured" : "missing"}
            </p>
            <p className="tnum text-sm" style={{ color: "var(--color-ink)" }}>
              <span style={{ color: "var(--color-muted)" }}>REST API Key: </span>
              {process.env.ONESIGNAL_API_KEY ? "configured" : "missing"}
            </p>
            <p className="tnum text-sm" style={{ color: "var(--color-ink)" }}>
              <span style={{ color: "var(--color-muted)" }}>Email FROM: </span>
              {process.env.ONESIGNAL_EMAIL_FROM ? "configured" : "missing"}
            </p>
            <p className="tnum text-sm" style={{ color: "var(--color-ink)" }}>
              <span style={{ color: "var(--color-muted)" }}>SMS FROM: </span>
              {process.env.ONESIGNAL_SMS_FROM ? "configured" : "missing"}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className={`mono-label rounded-full border px-3 py-1 ${providerStatus.channels.email ? "bg-green-100" : "bg-red-100"}`} style={{ borderColor: "var(--color-rule-2)" }}>
                Email: {providerStatus.channels.email ? "ready" : "not configured"}
              </span>
              <span className={`mono-label rounded-full border px-3 py-1 ${providerStatus.channels.sms ? "bg-green-100" : "bg-red-100"}`} style={{ borderColor: "var(--color-rule-2)" }}>
                SMS: {providerStatus.channels.sms ? "ready" : "not configured"}
              </span>
              <span className={`mono-label rounded-full border px-3 py-1 ${providerStatus.channels.push ? "bg-green-100" : "bg-red-100"}`} style={{ borderColor: "var(--color-rule-2)" }}>
                Push: {providerStatus.channels.push ? "ready" : "not configured"}
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-2 space-y-2 text-sm" style={{ color: "var(--color-muted)" }}>
            <p>OneSignal is not configured.</p>
            <p>Set these server env vars and restart:</p>
            <ul className="list-disc pl-5 font-mono text-xs space-y-1">
              <li><code>ONESIGNAL_APP_ID</code> — from OneSignal dashboard → Settings → Keys & IDs</li>
              <li><code>ONESIGNAL_API_KEY</code> — from OneSignal dashboard → Settings → Keys & IDs → REST API Key</li>
              <li><code>ONESIGNAL_EMAIL_FROM</code> — verified sender email in OneSignal → Settings → Email</li>
              <li><code>ONESIGNAL_SMS_FROM</code> — (optional) SMS sender number in OneSignal → Messaging → SMS</li>
              <li><code>ONESIGNAL_EMAIL_TO</code> — (optional) fallback test recipient</li>
            </ul>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-[10px] border p-4" style={{ borderColor: "var(--color-rule-2)" }}>
        <h2 className="font-semibold" style={{ color: "var(--color-ink)" }}>How to connect</h2>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm" style={{ color: "var(--color-muted)" }}>
          <li>Open <span className="font-semibold" style={{ color: "var(--color-ink)" }}>app.onesignal.com</span> and sign in (or create an app).</li>
          <li>Go to <span className="font-semibold" style={{ color: "var(--color-ink)" }}>Settings → Keys & IDs</span> and copy <code>App ID</code> and <code>REST API Key</code>.</li>
          <li>For email: go to <span className="font-semibold" style={{ color: "var(--color-ink)" }}>Settings → Email</span>, add and verify a sender domain/email, then copy the verified sender as <code>ONESIGNAL_EMAIL_FROM</code>.</li>
          <li>For SMS (optional): go to <span className="font-semibold" style={{ color: "var(--color-ink)" }}>Messaging → SMS</span>, add a sender number, copy it as <code>ONESIGNAL_SMS_FROM</code>.</li>
          <li>Add the four keys above to your server env (<code>.env.local</code> or platform env), then restart the server.</li>
          <li>Reload this page — status badges should turn green. Send a test below.</li>
        </ol>
      </div>

      <div className="mt-4 rounded-[10px] border p-4" style={{ borderColor: "var(--color-rule-2)" }}>
        <h2 className="font-semibold" style={{ color: "var(--color-ink)" }}>Send test</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
          Test sends go through the same approved-only send path, vault-audited with <code>test:true</code>, no credit charge.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-md border p-3" style={{ borderColor: "var(--color-rule-2)" }}>
            <label className="block text-sm" style={{ color: "var(--color-muted)" }}>
              Channel
              <select
                className="mt-1 w-full rounded-md border p-2 text-sm"
                style={{ borderColor: "var(--color-rule-2)", color: "var(--color-ink)" }}
                value={testChannel}
                onChange={(e) => setTestChannel(e.target.value as any)}
              >
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="push">Push</option>
              </select>
            </label>
          </div>
          <div className="rounded-md border p-3" style={{ borderColor: "var(--color-rule-2)" }}>
            <label className="block text-sm" style={{ color: "var(--color-muted)" }}>
              To (email / phone / player id)
              <input
                type="text"
                className="mt-1 w-full rounded-md border p-2 text-sm"
                style={{ borderColor: "var(--color-rule-2)", color: "var(--color-ink)" }}
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder={channel === "email" ? "your@email.com" : channel === "sms" ? "+15551234567" : "player_id"}
              />
            </label>
          </div>
          <div className="rounded-md border p-3" style={{ borderColor: "var(--color-rule-2)" }}>
            <label className="block text-sm" style={{ color: "var(--color-muted)" }}>
              Subject (email/push)
              <input
                type="text"
                className="mt-1 w-full rounded-md border p-2 text-sm"
                style={{ borderColor: "var(--color-rule-2)", color: "var(--color-ink)" }}
                value={testSubject}
                onChange={(e) => setTestSubject(e.target.value)}
                placeholder="ClearDue test"
              />
            </label>
          </div>
        </div>
        <div className="mt-3">
          <label className="block text-sm" style={{ color: "var(--color-muted)" }}>
            Body
            <textarea
              className="mt-1 w-full rounded-md border p-2 text-sm font-mono"
              style={{ borderColor: "var(--color-rule-2)", color: "var(--color-ink)" }}
              value={testBody}
              onChange={(e) => setTestBody(e.target.value)}
              rows={4}
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["email", "sms", "push"] as const).map((ch) => (
            <button
              key={ch}
              type="button"
              onClick={() => handleTestSend(ch)}
              disabled={testBusy !== null}
              className={`hallmark-btn ${testChannel === ch ? "hallmark-btn-primary" : ""} px-4 py-2 text-sm font-semibold disabled:opacity-50`}
              style={{ borderColor: "var(--color-rule-2)" }}
            >
              {testBusy === ch ? "Sending…" : `Test ${ch}`}
            </button>
          ))}
        </div>
        {testMsg && (
          <p className="mt-2 text-sm" style={{ color: testMsg.startsWith("Sent") ? "green" : "red" }}>
            {testMsg}
          </p>
        )}
      </div>

      <p className="mt-4 text-xs" style={{ color: "var(--color-muted)" }}>
        Keys stay server-only (ONESIGNAL_APP_ID, ONESIGNAL_API_KEY, ONESIGNAL_EMAIL_FROM, ONESIGNAL_SMS_FROM, ONESIGNAL_EMAIL_TO).
        Email / SMS / Push send via OneSignal — always with human approval, never auto-send.
        Replies go to the operator.
      </p>
    </div>
  );
}

async function handleTestSend(channel: "email" | "sms" | "push") {
  setTestMsg("Sending…");
  setTestBusy(channel);
  try {
    const res = await fetch("/api/connect/test-send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        to: testTo || undefined,
        channel,
        subject: testSubject,
        body: testBody,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error ?? `test send failed (${res.status})`);
    setTestMsg(`Sent — OneSignal id ${data.onesignalId ?? "ok"}.`);
  } catch (e: any) {
    setTestMsg(e?.message ?? "test send failed");
  } finally {
    setTestBusy(null);
  }
}

export default Page;