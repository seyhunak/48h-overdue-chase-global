"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useState } from "react";
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
  const doSave = useMutation((api as any).reminders.saveComposioSettings);

  const defaultUser = user?.username ?? "default";
  const [composioUser, setComposioUser] = useState("default");
  const [apiKey, setApiKey] = useState("");
  const [touchedUser, setTouchedUser] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [busy, setBusy] = useState<"save" | "verify" | null>(null);

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
      const list: string[] = Array.isArray(data?.accounts) ? data.accounts : [];
      setAccounts(list);
      setVerifyMsg(
        data?.connected
          ? `Connected — ${list.length} account(s): ${list.join(", ") || "none listed"}.`
          : "Not connected — no linked accounts found. Connect a channel in the Composio dashboard, then Verify again.",
      );
    } catch (e: any) {
      setVerifyMsg(e?.message ?? "verify failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10" style={{ background: "var(--color-paper)" }}>
      <p className="mono-label" style={{ color: "var(--color-muted)" }}>Connect · multichannel</p>
      <h1 className="font-display mt-2 text-3xl font-semibold" style={{ color: "var(--color-ink)" }}>
        Connect follow-up channels
      </h1>
      <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
        Email sends via Resend. WhatsApp, SMS, and voice send via your connected Composio accounts — always with human approval, never auto-send.
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
              Open <span className="font-semibold" style={{ color: "var(--color-ink)" }}>app.composio.dev</span> and sign in.
            </li>
            <li>
              Go to <span className="font-semibold" style={{ color: "var(--color-ink)" }}>API keys</span> and copy your key.
            </li>
            <li>
              Paste the key below with your username and press <span className="font-semibold" style={{ color: "var(--color-ink)" }}>Save</span>, then{" "}
              <span className="font-semibold" style={{ color: "var(--color-ink)" }}>Verify</span>.
            </li>
            <li>
              In the Composio dashboard, connect channel accounts: <span className="font-semibold" style={{ color: "var(--color-ink)" }}>Gmail</span>,{" "}
              <span className="font-semibold" style={{ color: "var(--color-ink)" }}>WhatsApp</span>,{" "}
              <span className="font-semibold" style={{ color: "var(--color-ink)" }}>Twilio / SMS</span>, and a{" "}
              <span className="font-semibold" style={{ color: "var(--color-ink)" }}>voice provider</span>.
            </li>
            <li>
              Press <span className="font-semibold" style={{ color: "var(--color-ink)" }}>Verify</span> again — connected accounts appear below and unlock per-row channels in the workbench.
            </li>
          </ol>
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
                <li key={a} className="rounded-md border p-2" style={{ borderColor: "var(--color-rule-2)" }}>
                  {a}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs" style={{ color: "var(--color-muted)" }}>
            Keys stay server-only and are never echoed back. Email (Gmail send) stays on Resend; WhatsApp / SMS / voice dispatch through Composio after approval.
          </p>
        </div>
      </div>
    </div>
  );
}
