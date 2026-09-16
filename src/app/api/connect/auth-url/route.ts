import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { loadOwnerConnectSettings } from "@/infrastructure/owner-settings";
import {
  createOneSignalConnectLink,
  ensureOneSignalAuthConfig,
  resolveComposioKey,
  resolveEntityId,
  ONESIGNAL_TOOLKIT_NAME,
} from "@/infrastructure/composio";

// POST /api/connect/auth-url — one-click Composio authorization for OneSignal.
// Resolves the owner's key (stored settings → COMPOSIO_API_KEY env), finds (or
// creates) the ONESIGNAL_REST_API auth config, then returns the hosted
// Composio connect URL as { redirect_url }. The OneSignal REST API key the
// owner enters there stays in their Composio connected account.
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
    const config = await ensureOneSignalAuthConfig(key);
    const redirect_url = await createOneSignalConnectLink(key, {
      authConfigId: config.id,
      entityId,
    });
    return NextResponse.json({
      redirect_url,
      toolkit: ONESIGNAL_TOOLKIT_NAME,
      authConfigId: config.id,
    });
  } catch (e: unknown) {
    const message =
      e instanceof Error && e.message ? e.message.slice(0, 1000) : "composio authorize failed";
    const status =
      typeof (e as { status?: unknown })?.status === "number" &&
      ((e as { status?: number }).status as number) >= 400 &&
      ((e as { status?: number }).status as number) < 600
        ? ((e as { status?: number }).status as number)
        : 502;
    return NextResponse.json({ error: message }, { status });
  }
}