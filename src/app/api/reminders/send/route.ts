import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { MissingOneSignalConfigError } from "@/infrastructure/onesignal";
import { MissingOneSignalAppIdError, ChannelNotConnectedError, OneSignalAuthError } from "@/infrastructure/composio";
import { loadOwnerConnectSettings } from "@/infrastructure/owner-settings";
import { dispatchNotification } from "@/infrastructure/notify";
import { debugLog } from "@/infrastructure/flags";

const VALID_CHANNELS = ["email", "sms", "push"] as const;
type Channel = (typeof VALID_CHANNELS)[number];

// POST /api/reminders/send — OneSignal multichannel (email|sms|push).
// Body: { reminderId: string; to?: string; channel?: "email" | "sms" | "push" }.
// Dispatch goes through the owner's Composio → OneSignal connection when one is
// saved in /connect, else the env-configured direct OneSignal keys.
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

  // Validate the requested channel for a clear 400. The requested channel
  // (per-row override in the UI) is effective; the queued channel is the
  // default when none is passed.
  const requestedChannel = (body.channel ?? "email").trim().toLowerCase();
  if (!VALID_CHANNELS.includes(requestedChannel as Channel)) {
    return NextResponse.json(
      { error: `Email, SMS or Push only`, channel: requestedChannel },
      { status: 400 },
    );
  }

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

  const queuedChannel = reminder.channel?.toLowerCase() ?? "email";
  if (!VALID_CHANNELS.includes(queuedChannel as Channel)) {
    return NextResponse.json(
      { error: `Email, SMS or Push only`, channel: queuedChannel },
      { status: 400 },
    );
  }
  // The UI persists the per-row override via setChannel before approving, so
  // queued and requested agree in the normal flow. Honor the requested channel
  // so Email/SMS/Push can be retried without re-queueing.
  const channel: Channel = requestedChannel as Channel;

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

  // Recipient priority: explicit `to` param > per-invoice recipient stored on
  // the queued reminder (recipientPhone for SMS, recipientEmail otherwise) >
  // ONESIGNAL_EMAIL_TO fallback (email/push only).
  const isSms = channel === "sms";
  const queuedRecipient =
    (isSms
      ? typeof reminder.recipientPhone === "string" && reminder.recipientPhone.trim()
      : typeof reminder.recipientEmail === "string" && reminder.recipientEmail.trim()) || "";
  const to = body.to?.trim() || queuedRecipient || (isSms ? "" : process.env.ONESIGNAL_EMAIL_TO?.trim());
  if (!to) {
    return NextResponse.json(
      {
        error: isSms
          ? "SMS recipient not configured (pass `to` with an E.164 phone number, or queue the invoice with a phone column value)"
          : "Recipient not configured (pass `to`, queue the invoice with an email, or set ONESIGNAL_EMAIL_TO)",
        channel,
      },
      { status: 503 },
    );
  }

  const settings = await loadOwnerConnectSettings(userId);

  try {
    const sent = await dispatchNotification({
      settings,
      channel,
      to,
      subject: reminder.subject,
      body: reminder.body,
    });
    // Trace: raw dispatch result in the server log so Composio → OneSignal
    // delivery can be audited per notification ID. Gated by DEBUG_MODE
    // (on by default in dev, off in prod unless explicitly enabled).
    debugLog(
      `[reminders/send] ${channel} → ${to} via=${sent.via} onesignalId=${sent.id} recipients=${sent.recipients ?? "unknown"} reminder=${body.reminderId}`,
    );
    // Mark sent + vault log {timestamp, payloadHash, channel} inside the mutation.
    // NO credit charge at send time (credits are charged at follow-up).
    const updated = await client.mutation((api as any).reminders.markSent, {
      ownerClerkId: userId,
      reminderId: body.reminderId,
      channel,
    });
    return NextResponse.json({
      sent: true,
      channel,
      via: sent.via,
      onesignalId: sent.id,
      recipients: sent.recipients,
      reminder: updated,
    });
  } catch (e: unknown) {
    if (e instanceof MissingOneSignalConfigError || e instanceof MissingOneSignalAppIdError) {
      return fail(e.message, 503);
    }
    if (e instanceof ChannelNotConnectedError || e instanceof OneSignalAuthError) {
      return fail(e.message, 502);
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
    return fail(message, 502);
  }
}