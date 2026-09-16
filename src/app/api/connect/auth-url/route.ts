import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  createAuthLink,
  listAuthConfigs,
  resolveComposioKey,
  resolveEntityId,
} from "@/infrastructure/composio";

const TOOLKIT_TO_SLUG: Record<string, string> = {
  whatsapp: "whatsapp",
  sms: "twilio",
  voice: "twilio",
};

// POST /api/connect/auth-url — one-click Composio authorization.
// Body: { toolkit: "whatsapp" | "sms" | "voice", composioUser?: string }.
// Resolves the owner key (stored settings -> env fallback, 503 if missing)
// and entity (stored settings user, body override wins), maps the toolkit to
// its Composio slug, picks the default Composio-managed auth config (else the
// first), creates a connect link, and returns { redirect_url }.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.replace(/\/+$/, "");
  if (!convexUrl) return NextResponse.json({ error: "Backend not configured" }, { status: 503 });

  let body: { toolkit?: string; composioUser?: string };
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const toolkit = typeof body?.toolkit === "string" ? body.toolkit.trim().toLowerCase() : "";
  if (toolkit !== "whatsapp" && toolkit !== "sms" && toolkit !== "voice") {
    return NextResponse.json({ error: "toolkit must be whatsapp, sms, or voice" }, { status: 400 });
  }
  const slug = TOOLKIT_TO_SLUG[toolkit];

  const { ConvexHttpClient } = await import("convex/browser");
  const { api } = await import("../../../../../convex/_generated/api");
  const client = new ConvexHttpClient(convexUrl);

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
      typeof settings?.composioKey === "string" ? settings.composioKey : null,
    );
  } catch {
    return NextResponse.json({ error: "Composio API key not configured — save it in /connect" }, { status: 503 });
  }
  const entityId = resolveEntityId(settings?.composioUser, body?.composioUser);

  try {
    const configs = await listAuthConfigs(key, slug);
    if (!configs || configs.length === 0) {
      return NextResponse.json(
        { error: `create an auth config for ${toolkit} in app.composio.dev -> Auth Configs, then retry` },
        { status: 409 },
      );
    }
    const picked = configs.find((c) => c.isComposioManaged) ?? configs[0];
    const redirect_url = await createAuthLink(key, { authConfigId: picked.id, userId: entityId });
    return NextResponse.json({ redirect_url });
  } catch (e: unknown) {
    let message = "composio auth link failed";
    try {
      if (e instanceof Error) {
        const m = typeof e.message === "string" ? e.message.trim() : "";
        message = (m || message).slice(0, 1000);
      } else if (typeof e === "string") {
        const s = e.trim();
        message = (s || message).slice(0, 1000);
      } else if (e === null || e === undefined) {
        message = "composio auth link failed";
      } else {
        try {
          const maybeMsg = (e as { message?: unknown })?.message;
          if (typeof maybeMsg === "string" && maybeMsg.trim()) {
            message = maybeMsg.trim().slice(0, 1000);
          } else {
            const s = String(e);
            message = (s && s !== "[object Object]" ? s : `${message}: ${JSON.stringify(e)}`).slice(0, 1000);
          }
        } catch {
          message = "composio auth link failed";
        }
      }
    } catch {
      message = "composio auth link failed";
    }
    let status = 502;
    try {
      const s = (e as { status?: unknown })?.status;
      if (typeof s === "number" && Number.isFinite(s) && s >= 100 && s < 600) status = s;
    } catch {
      status = 502;
    }
    return NextResponse.json({ error: message }, { status });
  }
}
