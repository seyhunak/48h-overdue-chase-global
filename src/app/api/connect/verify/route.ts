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

// POST /api/connect/verify — confirm the owner's OneSignal connected account.
// Called after the Composio authorize popup returns; lists the owner's
// ONESIGNAL_REST_API accounts and stamps verifiedAt when at least one exists.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { apiKey?: string; composioUser?: string } = {};
  try {
    body = await req.json();
  } catch {
    // Body is optional — verify-against-stored-settings is the common path.
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
    const accounts = await listOneSignalConnections(key, entityId);
    const usable = accounts.filter((a) => isUsableConnectedAccountStatus(a.status));
    // "Connected" must mean the credential actually works against OneSignal.
    // An ACTIVE account whose stored key was the App ID (not a REST API key)
    // answers every call with 401 — that is not connected.
    const appId = settings.onesignalAppId ?? "";
    const working = appId
      ? await pickWorkingOneSignalAccount({ apiKey: key, entityId, appId })
      : null;
    const connected = Boolean(working);
    if (connected) {
      try {
        const { ConvexHttpClient } = await import("convex/browser");
        const { api } = await import("../../../../../convex/_generated/api");
        const client = new ConvexHttpClient(
          (process.env.NEXT_PUBLIC_CONVEX_URL ?? "").replace(/\/+$/, ""),
        );
        await client.mutation((api as any).reminders.setComposioVerified, {
          ownerClerkId: userId,
          verifiedAt: Date.now(),
        });
      } catch {
        // Best effort: verification succeeded even if the stamp write fails.
      }
    }
    return NextResponse.json({
      connected,
      accounts: usable,
      pendingAccounts: accounts.length - usable.length,
      activeAccounts: usable.length,
      accountId: working?.accountId ?? usable[0]?.id ?? null,
      probed: Boolean(working?.probed),
      entityId,
      toolkit: "ONESIGNAL_REST_API",
    });
  } catch (e: unknown) {
    const message =
      e instanceof Error && e.message ? e.message.slice(0, 1000) : "composio verify failed";
    const raw = (e as { status?: unknown })?.status;
    const status = typeof raw === "number" && raw >= 400 && raw < 600 ? raw : 502;
    return NextResponse.json({ connected: false, accounts: [], entityId, error: message }, { status });
  }
}