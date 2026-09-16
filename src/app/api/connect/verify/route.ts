import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  listConnectedAccountApps,
  resolveComposioKey,
  resolveEntityId,
} from "@/infrastructure/composio";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.replace(/\/+$/, "");
  if (!convexUrl) return NextResponse.json({ error: "Backend not configured" }, { status: 503 });

  let body: { apiKey?: string; composioUser?: string };
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { ConvexHttpClient } = await import("convex/browser");
  const { api } = await import("../../../../../convex/_generated/api");
  const client = new ConvexHttpClient(convexUrl);

  // Owner-scoped settings read; key may come from the request (verify
  // before save) or the stored per-owner settings, with env fallback.
  let settings: any = null;
  try {
    settings = await client.query((api as any).reminders.getSettings, {
      ownerClerkId: userId,
    });
  } catch {
    settings = null;
  }
  let key: string;
  try {
    key = resolveComposioKey(
      typeof body?.apiKey === "string" && body.apiKey.trim()
        ? body.apiKey.trim()
        : typeof settings?.composioKey === "string"
          ? settings.composioKey
          : null,
    );
  } catch {
    return NextResponse.json({ error: "Composio API key not configured — save it in /connect" }, { status: 503 });
  }
  const entityId = resolveEntityId(settings?.composioUser, body?.composioUser);

  try {
    const apps = await listConnectedAccountApps(key, entityId);
    const connected = apps.length > 0;
    if (connected) {
      try {
        await client.mutation((api as any).reminders.setComposioVerified, {
          ownerClerkId: userId,
          verifiedAt: Date.now(),
        });
      } catch {
        // Best effort: verification succeeded even if the stamp write fails.
      }
    }
    // Never echo the key back.
    return NextResponse.json({ connected, accounts: apps, entityId });
  } catch (e: any) {
    const message = e?.message ?? "composio verify failed";
    const status = typeof e?.status === "number" ? e.status : 502;
    return NextResponse.json({ connected: false, accounts: [], entityId, error: message }, { status });
  }
}
