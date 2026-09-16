import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { MissingOneSignalConfigError, ChannelNotConfiguredError, PlayerNotRegisteredError } from "@/infrastructure/onesignal";

const VALID_CHANNELS = ["email", "sms", "push"] as const;
type Channel = (typeof VALID_CHANNELS)[number];

// POST /api/reminders/send — OneSignal multichannel (email|sms|push).
// Body: { reminderId: string; to?: string; channel?: "email" | "sms" | "push" }.
// Default channel is "email". Invalid channel returns 400.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.replace(/\/+$/, "");
  if (!convexUrl) return NextResponse.json({ error: "Backend not configured" }, { status: 503 });

  let body: { reminderId?: string; to?: string; channel?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.reminderId) return NextResponse.json({ error: "reminderId required" }, { status: 400 });

  // Validate channel
  const requestedChannel = (body.channel ?? "email").trim().toLowerCase();
  if (!VALID_CHANNELS.includes(requestedChannel as any)) {
    return NextResponse.json(
      { error: `email, sms or push only`, channel: requestedChannel },
      { status: 400 },
    );
  }
  const channel = requestedChannel as "email" | "sms" | "push";

  const { ConvexHttpClient } = await import("convex/browser");
  const { api } = await import("../../../../../convex/_generated/api");
  const client = new ConvexHttpClient(
    (process.env.NEXT_PUBLIC_CONVEX_URL ?? "").replace(/\/+$/, ""),
  );

  // Caller-owned load: only the owner's own reminder is visible here.
  const reminder = await client.query((api as any).reminders.getByIdForOwner, {
    ownerClerkId: userId,
    reminderId: body.reminderId,
  });
  if (!reminder) return NextResponse.json({ error: "reminder not found" }, { status: 404 });
  // Human-approval gate: cron only ever creates pending_approval rows.
  if (reminder.status !== "approved") {
    return NextResponse.json(
      { error: `reminder is ${reminder.status}, not approved`, status: reminder.status },
      { status: 409 },
    );
  }

  const channel = reminder.channel?.toLowerCase() ?? "email";
  if (!["email", "sms", "push"].includes(channel)) {
    return NextResponse.json(
      { error: `email, sms or push only`, channel },
      { status: 400 },
    );
  }

  async function fail(message: string, status = 502) {
    try {
      await client.mutation((api as any).reminders.markFailed, {
        ownerClerkId: userId,
        reminderId: body.reminderId,
        error: message,
      });
    } catch {
      // Best effort: the send already failed; don't mask the original error.
    }
    return NextResponse.json({ error: message, channel }, { status });
  }

  // Recipient priority: explicit `to` param > per-invoice recipientEmail
  // stored on the queued reminder > ONESIGNAL_EMAIL_TO fallback.
  const to =
    body.to?.trim() ||
    (typeof reminder.recipientEmail === "string" && reminder.recipientEmail.trim()) ||
    process.env.ONESIGNAL_EMAIL_TO?.trim();
  if (!to) {
    return NextResponse.json(
      { error: "Recipient not configured (pass `to`, queue the invoice with an email, or set ONESIGNAL_EMAIL_TO)", channel },
      { status: 503 },
    );
  }

  try {
    const { dispatchViaOneSignal } = await import("@/infrastructure/onesignal");
    const sent = await dispatchViaOneSignal({
      channel: channel as "email" | "sms" | "push",
      to,
      subject: reminder.subject,
      body: reminder.body,
    });
    // Mark sent + vault log {timestamp, payloadHash, channel} inside the mutation.
    // NO credit charge at send time (credits are charged at follow-up).
    const updated = await client.mutation((api as any).reminders.markSent, {
      ownerClerkId: userId,
      reminderId: body.reminderId,
      channel,
    });
    return NextResponse.json({ sent: true, channel, onesignalId: sent.id, reminder: updated });
  } catch (e: unknown) {
    if (e instanceof MissingOneSignalConfigError) {
      return NextResponse.json({ error: e.message, channel }, { status: 503 });
    }
    if (e instanceof ChannelNotConfiguredError) {
      return NextResponse.json({ error: e.message, channel }, { status: 502 });
    }
    if (e instanceof PlayerNotRegisteredError) {
      return NextResponse.json({ error: e.message, channel }, { status: 502 });
    }
    let message = "send failed";
    try {
      if (e instanceof Error) {
        const m = typeof e.message === "string" ? e.message.trim() : "";
        message = (m || message).slice(0, 1000);
      } else if (typeof e === "string") {
        message = (e.trim() || message).slice(0, 1000);
      } else if (e !== null && e !== undefined) {
        try {
          const maybeMsg = (e as { message?: unknown })?.message;
          if (typeof maybeMsg === "string" && maybeMsg.trim()) message = maybeMsg.trim().slice(0, 1000);
          else {
            const s = String(e);
            message = (s && s !== "[object Object]" ? s : message).slice(0, 1000);
          }
        } catch {
          // keep default
        }
      }
    } catch {
      // keep default
    }
    return NextResponse.json({ error: message, channel }, { status: 502 });
  }
}