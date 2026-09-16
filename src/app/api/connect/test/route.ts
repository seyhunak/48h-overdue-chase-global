import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import type { Channel } from "@/infrastructure/composio";

const CHANNELS: Channel[] = ["email", "whatsapp", "sms", "voice"];

// POST /api/connect/test — per-channel self-serve test send.
// The explicit Test-button click IS the human approval (same policy as
// Approve+Send: nothing auto-sends, every dispatch is human-triggered and
// vault-audited with test:true). No credit charge on test sends.
// Email always sends via Resend (never Gmail-via-Composio).
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.replace(/\/+$/, "");
  if (!convexUrl) return NextResponse.json({ error: "Backend not configured" }, { status: 503 });

  let body: { channel?: string; to?: string };
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const channel = (body?.channel ?? "") as Channel;
  if (!(CHANNELS as string[]).includes(channel)) {
    return NextResponse.json({ error: "channel must be email, whatsapp, sms, or voice" }, { status: 400 });
  }
  const to = typeof body?.to === "string" ? body.to.trim() : "";
  if (!to) {
    return NextResponse.json(
      { error: `${channel} test recipient required (your own email address or phone number)`, channel },
      { status: 400 },
    );
  }

  const { ConvexHttpClient } = await import("convex/browser");
  const { api } = await import("../../../../../convex/_generated/api");
  const client = new ConvexHttpClient(convexUrl);

  async function auditVault(extra: Record<string, unknown>) {
    try {
      await client.mutation((api as any).vault.add, {
        ownerClerkId: userId,
        kind: "test_send",
        title: `test · ${channel} · ${to.slice(0, 80)}`,
        payload: JSON.stringify({ timestamp: Date.now(), channel, to, test: true, ...extra }),
      });
    } catch {
      // Best effort: the send result is what matters.
    }
  }

  if (channel === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return NextResponse.json({ error: "invalid test email address", channel }, { status: 400 });
    }
    try {
      const { sendReminderEmail } = await import("@/infrastructure/resend");
      const sent = await sendReminderEmail({
        to,
        subject: "ClearDue test — Resend is connected",
        text: "Hi — this is your ClearDue email test. Email sends via Resend (no Gmail connection needed). If you received this, your email channel is ready for approved follow-ups.",
      });
      await auditVault({ resendId: (sent as any)?.id ?? null });
      return NextResponse.json({ sent: true, channel, resendId: (sent as any)?.id ?? null, test: true });
    } catch (e: unknown) {
      const msg = e instanceof Error && e.message ? e.message.slice(0, 1000) : "email test send failed";
      const status = (e as { status?: unknown })?.status;
      const code = typeof status === "number" && status >= 100 && status < 600 ? status : 503;
      return NextResponse.json({ error: msg, channel }, { status: code });
    }
  }

  // whatsapp / sms / voice — owner's own Composio accounts only.
  try {
    const { dispatchViaComposio, resolveComposioKey, resolveEntityId } = await import(
      "@/infrastructure/composio"
    );
    let settings: any = null;
    try {
      settings = await client.query((api as any).reminders.getSettings, { ownerClerkId: userId });
    } catch {
      settings = null;
    }
    let apiKey: string;
    try {
      apiKey = resolveComposioKey(typeof settings?.composioKey === "string" ? settings.composioKey : null);
    } catch {
      return NextResponse.json(
        { error: `${channel} channel not connected — connect it in /connect`, channel },
        { status: 502 },
      );
    }
    const entityId = resolveEntityId(settings?.composioUser);
    const pref = (settings as any)?.preferredAccount ?? {};
    const pinned = typeof pref?.[channel] === "string" ? (pref[channel] as string) : null;
    const text =
      channel === "voice"
        ? "Hi — this is your ClearDue voice test. Your connected calling account is ready for approved follow-ups."
        : "Hi — this is your ClearDue test. Your connected account is ready for approved follow-ups.";
    let dispatched: any;
    try {
      dispatched = await dispatchViaComposio({
        apiKey,
        entityId,
        channel: channel as Exclude<Channel, "email">,
        preferredAccountId: pinned,
        input: { subject: "ClearDue test", body: text, to },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error && e.message ? e.message.slice(0, 1000) : "test send failed";
      const status = (e as { status?: unknown })?.status;
      const code = typeof status === "number" && status >= 100 && status < 600 ? status : 502;
      return NextResponse.json({ error: msg, channel }, { status: code });
    }
    await auditVault({ action: dispatched.actionName, app: dispatched.appName, accountId: dispatched.accountId ?? null });
    return NextResponse.json({
      sent: true,
      channel,
      action: dispatched.actionName,
      app: dispatched.appName,
      accountId: dispatched.accountId ?? null,
      test: true,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error && e.message ? e.message.slice(0, 1000) : "test send failed";
    return NextResponse.json({ error: msg, channel }, { status: 502 });
  }
}
