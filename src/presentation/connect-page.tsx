"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getConvexUrl, getClerkPublishableKey } from "@/infrastructure/env";
import { api } from "../../convex/_generated/api";

type Channel = "email" | "sms" | "push";

const CHANNEL_LABEL: Record<Channel, string> = { email: "Email", sms: "SMS", push: "Push" };

// Shape of GET /api/connect/provider-status (presence only — never keys).
type ProviderStatus = {
  composioConfigured: boolean;
  appIdConfigured: boolean;
  connected: boolean;
  accountId: string | null;
  accountStatus: string | null;
  pendingAccounts: number;
  activeAccounts?: number;
  envConfigured: boolean;
  probeError: string | null;
  channels: Record<Channel, boolean>;
};

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`mono-label rounded-full border px-3 py-1 ${ok ? "bg-green-100" : "bg-red-100"}`}
      style={{ borderColor: "var(--color-rule-2)" }}
    >
      {label}
    </span>
  );
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
        hasAppId: boolean;
        onesignalAppId: string;
      }
    | undefined;

  const doSaveComposio = useMutation((api as any).reminders.saveComposioSettings);
  const doSaveAppId = useMutation((api as any).reminders.saveOneSignalAppId);
  const doClear = useMutation((api as any).reminders.clearComposioConnection);

  const [provider, setProvider] = useState<ProviderStatus | null>(null);
  const [composioUser, setComposioUser] = useState("default");
  const [composioKey, setComposioKey] = useState("");
  const [appId, setAppId] = useState("");
  const [touchedUser, setTouchedUser] = useState(false);
  const [touchedAppId, setTouchedAppId] = useState(false);
  const [busy, setBusy] = useState<"save" | "authorize" | "verify" | "disconnect" | null>(null);
  const [connectMsg, setConnectMsg] = useState<string | null>(null);

  const refreshStatus = useCallback(() => {
    fetch("/api/connect/provider-status")
      .then((r) => r.json())
      .then((data) => setProvider(data as ProviderStatus))
      .catch(() => setProvider(null));
  }, []);

  useEffect(() => {
    if (!ready) return;
    refreshStatus();
  }, [ready, refreshStatus]);

  useEffect(() => {
    if (!touchedUser && status?.composioUser) setComposioUser(status.composioUser);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isLoaded, user]);

  useEffect(() => {
    if (!touchedAppId && status?.onesignalAppId) setAppId(status.onesignalAppId);
  }, [status, touchedAppId]);
  async function handleSave() {
    if (!user) return;
    setConnectMsg(null);
    const keyAvailable =
      Boolean(composioKey.trim()) || Boolean(status?.hasKey) || Boolean(provider?.composioConfigured);
    if (!keyAvailable) {
      setConnectMsg("Paste your Composio API key first.");
      return;
    }
    setBusy("save");
    try {
      if (composioKey.trim()) {
        await doSaveComposio({
          ownerClerkId: user.id,
          composioUser: composioUser.trim() || "default",
          composioKey: composioKey.trim(),
        });
      }
      if (appId.trim()) {
        await doSaveAppId({ ownerClerkId: user.id, onesignalAppId: appId.trim() });
      }
      setComposioKey("");
      setConnectMsg("Saved.");
      refreshStatus();
    } catch (e: any) {
      setConnectMsg(e?.message ?? "save failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleAuthorize() {
    if (!user) return;
    if (!status?.hasKey && !composioKey.trim()) {
      setConnectMsg("Save your Composio API key first.");
      return;
    }
    setBusy("authorize");
    setConnectMsg("Opening Composio…");
    try {
      const res = await fetch("/api/connect/auth-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ composioUser: composioUser.trim() || "default" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `authorize failed (${res.status})`);
      const url =
        (typeof data?.redirect_url === "string" && data.redirect_url.trim()) ||
        (typeof data?.redirectUrl === "string" && data.redirectUrl.trim()) ||
        "";
      if (!url) throw new Error("authorize failed (missing redirect_url)");
      window.open(url, "_blank", "noopener,noreferrer");
      setConnectMsg("Finish OneSignal sign-in, then press Verify.");
    } catch (e: any) {
      setConnectMsg(e?.message ?? "authorize failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleVerify() {
    if (!user) return;
    setBusy("verify");
    setConnectMsg("Verifying…");
    try {
      const res = await fetch("/api/connect/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `verify failed (${res.status})`);
      setConnectMsg(
        data.connected ? "OneSignal connected." : "No OneSignal connection yet — press Connect OneSignal.",
      );
      refreshStatus();
    } catch (e: any) {
      setConnectMsg(e?.message ?? "verify failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleDisconnect() {
    if (!user) return;
    setBusy("disconnect");
    try {
      await doClear({ ownerClerkId: user.id });
      setComposioKey("");
      setAppId("");
      setConnectMsg("Disconnected.");
      refreshStatus();
    } catch (e: any) {
      setConnectMsg(e?.message ?? "disconnect failed");
    } finally {
      setBusy(null);
    }
  }

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
      <p className="mono-label" style={{ color: "var(--color-muted)" }}>Connect · notifications</p>
      <h1 className="font-display mt-2 text-3xl font-semibold" style={{ color: "var(--color-ink)" }}>
        Connect OneSignal
      </h1>
      <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
        Email, SMS and push send through{" "}
        <span className="font-semibold" style={{ color: "var(--color-ink)" }}>Composio → OneSignal</span>. Human approval
        only — nothing auto-sends, and your OneSignal key stays in your own Composio account.
      </p>

      <div className="mt-4 rounded-[10px] border p-4" style={{ borderColor: "var(--color-rule-2)" }}>
        <h2 className="font-semibold" style={{ color: "var(--color-ink)" }}>Provider status</h2>
        {!provider ? (
          <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>Checking…</p>
        ) : (
          <div className="mt-2 space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge
                ok={provider.composioConfigured}
                label={`Composio key: ${provider.composioConfigured ? "saved" : "missing"}`}
              />
              <Badge ok={provider.appIdConfigured} label={`App ID: ${provider.appIdConfigured ? "set" : "missing"}`} />
              <Badge ok={provider.connected} label={`OneSignal: ${provider.connected ? "connected" : "not connected"}`} />
            </div>
            <div className="flex flex-wrap gap-2">
              {(["email", "sms", "push"] as Channel[]).map((ch) => (
                <Badge
                  key={ch}
                  ok={provider.channels[ch]}
                  label={`${CHANNEL_LABEL[ch]}: ${provider.channels[ch] ? "ready" : "not ready"}`}
                />
              ))}
            </div>
            {provider.accountId && (
              <p className="tnum text-xs" style={{ color: "var(--color-muted)" }}>
                OneSignal account {provider.accountId}
                {provider.accountStatus ? ` · ${provider.accountStatus}` : ""}
              </p>
            )}
            {(provider.accountStatus === "ACTIVE_BUT_REJECTED" || Boolean(provider.activeAccounts)) &&
              provider.activeAccounts !== undefined && (
                <p className="text-xs" style={{ color: provider.accountStatus === "ACTIVE_BUT_REJECTED" ? "red" : "var(--color-muted)" }}>
                  {provider.activeAccounts} OneSignal connection(s) found in Composio
                  {provider.accountStatus === "ACTIVE_BUT_REJECTED"
                    ? " — none of them was accepted by OneSignal. Reconnect with your OneSignal REST API key (Settings → Keys & IDs → REST API Key), not the App ID. Old, broken connections can be removed in the Composio dashboard."
                    : " — send uses the first one OneSignal accepts."}
                </p>
              )}
            {provider.probeError && (
              <p className="text-xs" style={{ color: "red" }}>{provider.probeError}</p>
            )}
            {provider.pendingAccounts > 0 && !provider.connected && (
              <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                {provider.pendingAccounts} pending connection(s) — finish the OneSignal sign-in, then press Verify.
              </p>
            )}
            {!provider.connected && !provider.probeError && (
              <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                Composio API key + OneSignal App ID → Save → Connect OneSignal → Verify.
              </p>
            )}
            {!provider.connected && provider.envConfigured && (
              <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                Server env keys are set, so sends still work without a Composio connection.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-[10px] border p-4" style={{ borderColor: "var(--color-rule-2)" }}>
        <h2 className="font-semibold" style={{ color: "var(--color-ink)" }}>Connect</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="block text-sm" style={{ color: "var(--color-muted)" }}>
            Composio API key
            <input
              type="password"
              className="mt-1 w-full rounded-md border p-2 font-mono text-sm"
              style={{ borderColor: "var(--color-rule-2)", color: "var(--color-ink)" }}
              value={composioKey}
              onChange={(e) => setComposioKey(e.target.value)}
              placeholder={status?.hasKey ? "Saved — paste a new key to rotate" : "Paste from app.composio.dev"}
              autoComplete="off"
            />
          </label>
          <label className="block text-sm" style={{ color: "var(--color-muted)" }}>
            Composio username
            <input
              type="text"
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
          <label className="block text-sm" style={{ color: "var(--color-muted)" }}>
            OneSignal App ID
            <input
              type="text"
              className="mt-1 w-full rounded-md border p-2 font-mono text-sm"
              style={{ borderColor: "var(--color-rule-2)", color: "var(--color-ink)" }}
              value={appId}
              onChange={(e) => {
                setTouchedAppId(true);
                setAppId(e.target.value);
              }}
              placeholder="app.onesignal.com → Settings → Keys & IDs"
              autoComplete="off"
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={busy !== null}
            className="hallmark-btn px-4 py-2 text-sm font-semibold disabled:opacity-50"
            style={{ borderColor: "var(--color-rule-2)" }}
          >
            {busy === "save" ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={handleAuthorize}
            disabled={busy !== null}
            className="hallmark-btn hallmark-btn-primary px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {busy === "authorize" ? "Opening…" : "Connect OneSignal"}
          </button>
          <button
            type="button"
            onClick={handleVerify}
            disabled={busy !== null}
            className="hallmark-btn px-4 py-2 text-sm disabled:opacity-50"
            style={{ borderColor: "var(--color-rule-2)" }}
          >
            {busy === "verify" ? "Verifying…" : "Verify"}
          </button>
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={busy !== null}
            className="hallmark-btn px-4 py-2 text-sm disabled:opacity-50"
            style={{ borderColor: "var(--color-rule-2)" }}
          >
            {busy === "disconnect" ? "Disconnecting…" : "Disconnect"}
          </button>
        </div>
        {connectMsg && (
          <p className="mt-2 text-sm" style={{ color: "var(--color-ink)" }}>{connectMsg}</p>
        )}
        <p className="mt-3 text-xs" style={{ color: "var(--color-muted)" }}>
          Keys: app.composio.dev → API keys · app.onesignal.com → Settings → Keys & IDs.
        </p>
      </div>

      <p className="mt-4 text-xs" style={{ color: "var(--color-muted)" }}>
        Your Composio key and OneSignal connection are yours alone — per-owner, never shared. Keys stay server-side and
        sends only ever happen after a human approval.
      </p>
    </div>
  );
}