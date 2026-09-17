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
  onesignalAccounts?: Array<{ id: string; status: string; working: boolean }>;
  zoho?: {
    connected: boolean;
    pendingAccounts: number;
    activeAccounts: number;
    accountId: string | null;
    orgIdConfigured: boolean;
    accountPinned: boolean;
    error: string | null;
  };
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
        zohoOrgId?: string;
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
  const [busy, setBusy] = useState<"save" | "authorize" | "verify" | "disconnect" | "remove" | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [connectMsg, setConnectMsg] = useState<string | null>(null);
  const [zohoOrgId, setZohoOrgId] = useState("");
  const [touchedZohoOrg, setTouchedZohoOrg] = useState(false);
  const [zohoMsg, setZohoMsg] = useState<string | null>(null);

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

  useEffect(() => {
    if (!touchedZohoOrg && status?.zohoOrgId) setZohoOrgId(status.zohoOrgId);
  }, [status, touchedZohoOrg]);
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

  async function handleRemoveOneSignal(accountId: string) {
    if (!user || removingId) return;
    setRemovingId(accountId);
    setConnectMsg(null);
    try {
      const res = await fetch("/api/connect/onesignal-account", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `remove failed (${res.status})`);
      setConnectMsg(
        `Removed connection — ${data.remaining ?? "?"} remaining. Keep exactly 1 working account, then Verify.`,
      );
      refreshStatus();
    } catch (e: any) {
      setConnectMsg(e?.message ?? "remove failed");
    } finally {
      setRemovingId(null);
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

  const doSaveZohoOrg = useMutation((api as any).reminders.saveZohoOrgId);

  async function handleZohoSaveOrg() {
    if (!user) return;
    setZohoMsg(null);
    if (!zohoOrgId.trim()) {
      setZohoMsg("Paste your Zoho organization ID first (optional for single-org accounts).");
      return;
    }
    setBusy("save");
    try {
      // Re-pin the currently-working connected account alongside the org id so
      // imports always use the same authorized connection even if Composio
      // lists several. `npx convex codegen` + `npx convex deploy` have been run
      // so the live deployment accepts the optional 3rd arg (verified via
      // function-spec: [ownerClerkId, zohoAccountId, zohoOrgId]).
      let pinnedAccountId: string | undefined;
      try {
        const st = await fetch("/api/connect/provider-status").then((r) => r.json()).catch(() => null);
        const live = (st as any)?.zoho;
        if (typeof live?.accountId === "string" && live.accountId.trim()) {
          pinnedAccountId = live.accountId.trim();
        }
      } catch {
        // Best effort — org id alone is enough; imports fall back to the first
        // ACTIVE account when nothing is pinned.
      }
      await doSaveZohoOrg({
        ownerClerkId: user.id,
        zohoOrgId: zohoOrgId.trim(),
        ...(pinnedAccountId ? { zohoAccountId: pinnedAccountId } : {}),
      });
      setZohoMsg(
        pinnedAccountId
          ? "Zoho org ID + connected account saved — imports now always use that connection."
          : "Zoho org ID saved.",
      );
      refreshStatus();
    } catch (e: any) {
      const msg = e?.message ?? "save failed";
      setZohoMsg(
        /could not find public function|validation error|extra field/i.test(msg)
          ? "Backend mismatch: the Convex deployment serving this page predates the Zoho update. Run `npx convex deploy`, confirm `saveZohoOrgId` accepts 3 args (`npx convex function-spec`), redeploy the web app, then try again."
          : msg,
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleZohoAuthorize() {
    if (!user) return;
    if (!status?.hasKey && !composioKey.trim()) {
      setZohoMsg("Save your Composio API key above first — Zoho uses the same key.");
      return;
    }
    setBusy("authorize");
    setZohoMsg("Opening Composio…");
    try {
      const res = await fetch("/api/connect/zoho-auth-url", {
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
      setZohoMsg("Finish the Zoho sign-in, then press Check Zoho connection.");
    } catch (e: any) {
      setZohoMsg(e?.message ?? "authorize failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleZohoVerify() {
    if (!user) return;
    setBusy("verify");
    setZohoMsg("Checking…");
    try {
      const res = await fetch("/api/connect/zoho-auth-url");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `check failed (${res.status})`);
      setZohoMsg(
        data.connected
          ? "Zoho connected — imports use your verified account. Switch to the workbench and press \"Import from Zoho Invoice\"."
          : data.pendingAccounts > 0
            ? `${data.pendingAccounts} pending connection(s) — finish the Zoho sign-in, then check again.`
            : "No Zoho connection yet — press Connect Zoho.",
      );
      refreshStatus();
    } catch (e: any) {
      setZohoMsg(e?.message ?? "check failed");
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
          <div className="mt-2 space-y-1.5">
            <div className="flex flex-wrap gap-1.5">
              <Badge ok={provider.composioConfigured} label={`Composio: ${provider.composioConfigured ? "key saved" : "key missing"}`} />
              <Badge ok={provider.connected} label={`OneSignal: ${provider.connected ? "connected" : provider.pendingAccounts > 0 ? "pending" : "not connected"}`} />
              <Badge ok={provider.zoho?.connected ?? false} label={`Zoho: ${provider.zoho?.connected ? "connected" : provider.zoho && provider.zoho.pendingAccounts > 0 ? "pending" : "not connected"}`} />
              {(["email", "sms", "push"] as Channel[]).map((ch) => (
                <Badge key={ch} ok={provider.channels[ch]} label={`${CHANNEL_LABEL[ch]}: ${provider.channels[ch] ? "ready" : "—"}`} />
              ))}
            </div>
            {(provider.accountId || (provider.zoho?.connected && provider.zoho.orgIdConfigured)) && (
              <p className="tnum text-xs" style={{ color: "var(--color-muted)" }}>
                {provider.accountId ? `OneSignal account ${provider.accountId}${provider.accountStatus ? ` · ${provider.accountStatus}` : ""}` : ""}
                {provider.accountId && provider.zoho?.connected && provider.zoho.orgIdConfigured ? " · " : ""}
                {provider.zoho?.connected && provider.zoho.orgIdConfigured ? "Zoho org ID set" : ""}
              </p>
            )}
            {provider.accountStatus === "ACTIVE_BUT_REJECTED" && (
              <p className="text-xs" style={{ color: "red" }}>
                {provider.activeAccounts} OneSignal connection(s) found — none accepted by OneSignal. Reconnect with your OneSignal REST API key (not the App ID). Remove old broken connections in the Composio dashboard.
              </p>
            )}
            {provider.onesignalAccounts !== undefined && provider.onesignalAccounts.length > 0 && (
              <div className="mt-1 space-y-1">
                <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                  Keep exactly 1 working OneSignal connection — remove the rest:
                </p>
                {provider.onesignalAccounts.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="tnum font-mono" title={a.id}>
                      {a.id.slice(0, 12)}…
                    </span>
                    <span
                      className="mono-label rounded-full border px-2 py-0.5"
                      style={{ borderColor: "var(--color-rule-2)" }}
                    >
                      {a.working ? "working" : a.status}
                    </span>
                    {!a.working && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOneSignal(a.id)}
                        disabled={removingId !== null}
                        className="underline disabled:opacity-50"
                      >
                        {removingId === a.id ? "Removing…" : "Remove"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {(provider.probeError || provider.zoho?.error) && (
              <p className="text-xs" style={{ color: "red" }}>
                {provider.probeError ?? provider.zoho?.error}
              </p>
            )}
            {(!provider.connected || !(provider.zoho?.connected ?? false)) && (
              <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                {!provider.connected && !(provider.zoho?.connected ?? false)
                  ? "Composio API key → Save, then Connect OneSignal / Connect Zoho below and Verify."
                  : !provider.connected
                    ? "OneSignal not connected — Save the Composio key, then Connect OneSignal + Verify below."
                    : "Zoho not connected — Connect Zoho below, then use \"Import from Zoho Invoice\" in the workbench."}
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
      <div className="mt-4 rounded-[10px] border p-4" style={{ borderColor: "var(--color-rule-2)" }}>
        <h2 className="font-semibold" style={{ color: "var(--color-ink)" }}>Zoho Invoice (invoice import source)</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
          Optional — lets the workbench pull your unpaid invoices from Zoho instead of pasting a CSV. Read-only: imports
          land in the review table; nothing is sent without approval. Uses the same Composio key above.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="block text-sm" style={{ color: "var(--color-muted)" }}>
            Zoho organization ID
            <input
              type="text"
              className="mt-1 w-full rounded-md border p-2 font-mono text-sm"
              style={{ borderColor: "var(--color-rule-2)", color: "var(--color-ink)" }}
              value={zohoOrgId}
              onChange={(e) => {
                setTouchedZohoOrg(true);
                setZohoOrgId(e.target.value);
              }}
              placeholder="Zoho Invoice → org settings → Organization ID"
              autoComplete="off"
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleZohoSaveOrg}
            disabled={busy !== null}
            className="hallmark-btn px-4 py-2 text-sm disabled:opacity-50"
            style={{ borderColor: "var(--color-rule-2)" }}
          >
            {busy === "save" ? "Saving…" : "Save org ID"}
          </button>
          <button
            type="button"
            onClick={handleZohoAuthorize}
            disabled={busy !== null}
            className="hallmark-btn hallmark-btn-primary px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {busy === "authorize" ? "Opening…" : "Connect Zoho"}
          </button>
          <button
            type="button"
            onClick={handleZohoVerify}
            disabled={busy !== null}
            className="hallmark-btn px-4 py-2 text-sm disabled:opacity-50"
            style={{ borderColor: "var(--color-rule-2)" }}
          >
            {busy === "verify" ? "Checking…" : "Check Zoho connection"}
          </button>
        </div>
        {zohoMsg && (
          <p className="mt-2 text-sm" style={{ color: "var(--color-ink)" }}>{zohoMsg}</p>
        )}
        <p className="mt-3 text-xs" style={{ color: "var(--color-muted)" }}>
          Zoho OAuth tokens stay in your Composio connected account — this app never sees them. First time? Add the
          Zoho Invoice toolkit once at app.composio.dev if Connect says it is missing.
        </p>
      </div>

    </div>
  );
}