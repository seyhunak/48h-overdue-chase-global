import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { loadOwnerConnectSettings } from "@/infrastructure/owner-settings";
import {
  createZohoConnectLink,
  listZohoConnections,
  resolveComposioKey,
  resolveEntityId,
  ZOHO_TOOLKIT_NAME,
} from "@/infrastructure/composio";

// GET /api/connect/zoho-auth-url — owner-scoped Zoho connection status
// (presence only: booleans + non-secret account ids; keys never leave server).
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const settings = await loadOwnerConnectSettings(userId);
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
      const accounts = await listZohoConnections(apiKey, entityId);
      const active = accounts.filter((a) => a.status === "ACTIVE");
      pendingAccounts = accounts.length - active.length;
      activeAccounts = active.length;
      connected = active.length > 0;
      accountId = active[0]?.id ?? null;
      accountStatus = active[0]?.status ?? null;
    } catch (e: unknown) {
      probeError = e instanceof Error && e.message ? e.message.slice(0, 300) : "composio probe failed";
    }
  }
  return NextResponse.json({
    composioConfigured,
    connected,
    accountId,
    accountStatus,
    pendingAccounts,
    activeAccounts,
    probeError,
    toolkit: ZOHO_TOOLKIT_NAME,
  });
}

// POST /api/connect/zoho-auth-url — one-click Composio authorization for Zoho
// Invoice. Resolves the owner's key (stored settings → COMPOSIO_API_KEY env),
// finds the zoho_invoice auth config, and returns the hosted Composio connect
// URL as { redirect_url }. Zoho's OAuth2 tokens stay in the Composio account.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { apiKey?: string; composioUser?: string } = {};
  try {
    body = await req.json();
  } catch {
    // Body is optional — settings/env resolve the key.
  }
  const settings = await loadOwnerConnectSettings(userId);
  let key: string;
  try {
    key = resolveComposioKey(body?.apiKey?.trim() || settings.composioKey);
  } catch {
    return NextResponse.json(
      { error: "Composio API key not configured — save it in /connect first" },
      { status: 503 },
    );
  }
  const entityId = resolveEntityId(settings.composioUser, body?.composioUser);
  try {
    const { redirect_url, authConfigId } = await createZohoConnectLink(key, { entityId });
    return NextResponse.json({ redirect_url, toolkit: ZOHO_TOOLKIT_NAME, authConfigId });
  } catch (e: unknown) {
    const message = e instanceof Error && e.message ? e.message.slice(0, 1000) : "composio zoho authorize failed";
    const raw = (e as { status?: unknown })?.status;
    const status = typeof raw === "number" && raw >= 400 && raw < 600 ? raw : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
