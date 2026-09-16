import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { loadOwnerConnectSettings } from "@/infrastructure/owner-settings";
import {
  listOneSignalConnections,
  isUsableConnectedAccountStatus,
  resolveComposioKey,
  resolveEntityId,
  pickWorkingOneSignalAccount,
} from "@/infrastructure/composio";

// GET /api/connect/provider-status — owner-scoped OneSignal status.
// Reports presence only (booleans / non-secret ids); keys never leave the server.
// `connected` comes from a live Composio probe of the owner's ONESIGNAL_REST_API
// connected account, so the badges reflect reality, not a stored flag.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const settings = await loadOwnerConnectSettings(userId);
  const envConfigured = Boolean(
    process.env.ONESIGNAL_APP_ID?.trim() && process.env.ONESIGNAL_API_KEY?.trim(),
  );

  let composioConfigured = false;
  try {
    resolveComposioKey(settings.composioKey);
    composioConfigured = true;
  } catch {
    composioConfigured = false;
  }

  let connected = false;
  let accountId: string | null = null;
  let accountStatus: string | null = null;
  let pendingAccounts = 0;
  let activeAccounts = 0;
  let probeError: string | null = null;

  if (composioConfigured) {
    const apiKey = settings.composioKey ?? process.env.COMPOSIO_API_KEY ?? "";
    const entityId = resolveEntityId(settings.composioUser);
    try {
      const accounts = await listOneSignalConnections(apiKey, entityId);
      // A pending (INITIATED) connection is not "connected" yet — it has no
      // OneSignal key stored, so it must not turn the badges green.
      const active = accounts.filter((a) => isUsableConnectedAccountStatus(a.status));
      pendingAccounts = accounts.length - active.length;
      activeAccounts = active.length;
      // "Connected" means a connection that can actually talk to OneSignal
      // (the owner's App ID), not merely a completed auth flow.
      const working = settings.onesignalAppId
        ? await pickWorkingOneSignalAccount({ apiKey, entityId, appId: settings.onesignalAppId })
        : null;
      connected = Boolean(working);
      accountId = working?.accountId ?? null;
      accountStatus = working ? "ACTIVE" : active.length > 0 ? "ACTIVE_BUT_REJECTED" : null;
    } catch (e: unknown) {
      probeError = e instanceof Error && e.message ? e.message.slice(0, 300) : "composio probe failed";
    }
  }

  const appIdConfigured = Boolean(settings.onesignalAppId) || Boolean(process.env.ONESIGNAL_APP_ID?.trim());
  const ready = connected && appIdConfigured;

  return NextResponse.json({
    composioConfigured,
    composioUser: settings.composioUser ?? "default",
    appIdConfigured,
    onesignalAppId: settings.onesignalAppId ?? "",
    connected,
    accountId,
    accountStatus,
    pendingAccounts,
    activeAccounts,
    envConfigured,
    probeError,
    toolkit: "ONESIGNAL_REST_API",
    channels: { email: ready, sms: ready, push: ready },
  });
}
