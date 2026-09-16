import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { dispatchViaOneSignal, MissingOneSignalConfigError, ChannelNotConfiguredError, PlayerNotRegisteredError } from "@/infrastructure/onesignal";

const VALID_CHANNELS = ["email", "sms", "push"] as const;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { to?: string; channel?: string; subject?: string; body?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const channel = (body.channel ?? "email").trim().toLowerCase();
  if (!VALID_CHANNELS.includes(channel as any)) {
    return NextResponse.json(
      { error: `email, sms or push only` },
      { status: 400 },
    );
  }

  const to = body.to?.trim() || process.env.ONESIGNAL_EMAIL_TO?.trim();
  if (!to) {
    return NextResponse.json(
      { error: "Recipient not configured (pass `to` or set ONESIGNAL_EMAIL_TO)" },
      { status: 503 },
    );
  }

  const subject = body.subject?.trim() || "ClearDue test";
  const bodyText = body.body?.trim() || "Hi — this is your ClearDue test. OneSignal (email/sms/push) is connected. If you received this, your notification channel is ready for approved follow-ups.";

  try {
    const { dispatchViaOneSignal } = await import("@/infrastructure/onesignal");
    const sent = await dispatchViaOneSignal({
      channel,
      to,
      subject,
      body: bodyText,
    });

    const { ConvexHttpClient } = await import("convex/browser");
    const { api } = await import("../../../../../convex/_generated/api");
    const client = new ConvexHttpClient(
      (process.env.NEXT_PUBLIC_CONVEX_URL ?? "").replace(/\/+$/, ""),
    );

    await client.mutation((api as any).vault.add, {
      ownerClerkId: userId,
      kind: "test_send",
      title: `Test send — ${channel}`,
      payload: JSON.stringify({ channel, to, subject, body: bodyText, onesignalId: sent.id, test: true, timestamp: Date.now() }),
    });

    return NextResponse.json({ sent: true, channel, onesignalId: sent.id, test: true });
  } catch (e: unknown) {
    if (e instanceof MissingOneSignalConfigError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    if (e instanceof ChannelNotConfiguredError) {
      return NextResponse.json({ error: e.message }, { status: 502 });
    }
    if (e instanceof PlayerNotRegisteredError) {
      return NextResponse.json({ error: e.message }, { status: 502 });
    }
    let message = "send failed";
    try {
      if (e instanceof Error) message = e.message?.slice(0, 1000) ?? "send failed";
      else if (typeof e === "string") message = e.slice(0, 1000);
    } catch {}
    return NextResponse.json({ error: message }, { status: 502 });
  }
}