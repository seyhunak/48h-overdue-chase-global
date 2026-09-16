import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { loadOwnerConnectSettings } from "@/infrastructure/owner-settings";
import { dispatchNotification } from "@/infrastructure/notify";
import { MissingOneSignalAppIdError, ChannelNotConnectedError, OneSignalAuthError } from "@/infrastructure/composio";
import { MissingOneSignalConfigError } from "@/infrastructure/onesignal";

const VALID_CHANNELS = ["email", "sms", "push"] as const;
type Channel = (typeof VALID_CHANNELS)[number];

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

  const settings = await loadOwnerConnectSettings(userId);

  try {
    const sent = await dispatchNotification({
      settings,
      channel: channel as Channel,
      to,
      subject,
      body: bodyText,
    });

    try {
      const { ConvexHttpClient } = await import("convex/browser");
      const { api } = await import("../../../../../convex/_generated/api");
      const client = new ConvexHttpClient(
        (process.env.NEXT_PUBLIC_CONVEX_URL ?? "").replace(/\/+$/, ""),
      );
      await client.mutation((api as any).vault.add, {
        ownerClerkId: userId,
        kind: "test_send",
        title: `Test send — ${channel}`,
        payload: JSON.stringify({
          channel,
          to,
          subject,
          body: bodyText,
          via: sent.via,
          onesignalId: sent.id,
          connectedAccountId: sent.connectedAccountId ?? null,
          test: true,
          timestamp: Date.now(),
        }),
      });
    } catch {
      // Best effort audit: the send result is what matters.
    }

    return NextResponse.json({
      sent: true,
      channel,
      via: sent.via,
      onesignalId: sent.id,
      test: true,
    });
  } catch (e: unknown) {
    const status =
      e instanceof MissingOneSignalConfigError || e instanceof MissingOneSignalAppIdError
        ? 503
        : e instanceof ChannelNotConnectedError || e instanceof OneSignalAuthError
          ? 502
          : 502;
    const message = e instanceof Error && e.message ? e.message.slice(0, 1000) : "send failed";
    return NextResponse.json({ error: message, channel }, { status });
  }
}