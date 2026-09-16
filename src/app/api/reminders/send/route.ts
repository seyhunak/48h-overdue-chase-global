import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { MissingEmailConfigError } from "@/infrastructure/resend";
import type { Channel } from "@/infrastructure/composio";

const CHANNELS: Channel[] = ["email", "whatsapp", "sms", "voice"];

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.replace(/\/+$/, "");
  if (!convexUrl) return NextResponse.json({ error: "Backend not configured" }, { status: 503 });

  let body: { reminderId?: string; to?: string; channel?: Channel };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.reminderId) return NextResponse.json({ error: "reminderId required" }, { status: 400 });

  const { ConvexHttpClient } = await import("convex/browser");
  const { api } = await import("../../../../../convex/_generated/api");
  const client = new ConvexHttpClient(convexUrl);

  // Caller-owned load: only the owner's own reminder is visible here.
  const reminder = await client.query((api as any).reminders.getByIdForOwner, {
    ownerClerkId: userId,
    reminderId: body.reminderId,
  });
  if (!reminder) return NextResponse.json({ error: "reminder not found" }, { status: 404 });
  // Human-approval gate: cron only ever creates pending_approval rows.
  // Applies identically to EVERY channel — no auto-send anywhere.
  if (reminder.status !== "approved") {
    return NextResponse.json(
      { error: `reminder is ${reminder.status}, not approved`, status: reminder.status },
      { status: 409 },
    );
  }

  const channel: Channel =
    body.channel && (CHANNELS as string[]).includes(body.channel)
      ? body.channel
      : typeof reminder.channel === "string" && (CHANNELS as string[]).includes(reminder.channel)
        ? (reminder.channel as Channel)
        : "email";

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

  // Email -> existing Resend path unchanged.
  if (channel === "email") {
    // Recipient priority: explicit `to` param > per-invoice recipientEmail
    // stored on the queued reminder > RESEND_TO fallback. Keyless builds stay
    // green: nothing here is evaluated at build time.
    const to =
      body.to?.trim() ||
      (typeof reminder.recipientEmail === "string" && reminder.recipientEmail.trim()) ||
      process.env.RESEND_TO;
    if (!to) {
      return NextResponse.json(
        { error: "Email recipient not configured (pass `to`, queue the invoice with an email, or set RESEND_TO)", channel },
        { status: 503 },
      );
    }

    try {
      const { sendReminderEmail } = await import("@/infrastructure/resend");
      const sent = await sendReminderEmail({ to, subject: reminder.subject, text: reminder.body });
      // Mark sent + vault log {timestamp, payloadHash, channel} inside the mutation.
      // NO credit charge at send time (credits are charged at follow-up).
      const updated = await client.mutation((api as any).reminders.markSent, {
        ownerClerkId: userId,
        reminderId: body.reminderId,
        channel,
      });
      return NextResponse.json({ sent: true, channel, resendId: sent.id, reminder: updated });
    } catch (e: unknown) {
      if (e instanceof MissingEmailConfigError) {
        return NextResponse.json({ error: e.message, channel }, { status: 503 });
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
      return fail(message);
    }
  }

  // whatsapp/sms/voice -> Composio tool execute for the owner's connected account.
  const to =
    body.to?.trim() || (typeof reminder.recipientEmail === "string" && reminder.recipientEmail.trim()) || "";
  // SMS/WhatsApp need a phone target; voice needs a phone target too. Email
  // addresses are not dialable — require an explicit `to` phone number.
  if (!to) {
    return NextResponse.json(
      { error: `${channel} recipient not configured (pass \`to\` phone number)`, channel },
      { status: 503 },
    );
  }

  try {
    const { dispatchViaComposio, resolveComposioKey, resolveEntityId } = await import(
      "@/infrastructure/composio"
    );
    let settings: any = null;
    try {
      settings = await client.query((api as any).reminders.getSettings, {
        ownerClerkId: userId,
      });
    } catch {
      settings = null;
    }
    let apiKey: string;
    try {
      apiKey = resolveComposioKey(
        typeof settings?.composioKey === "string" ? settings.composioKey : null,
      );
    } catch {
      return NextResponse.json(
        { error: `${channel} channel not connected — connect it in /connect`, channel },
        { status: 503 },
      );
    }
    const entityId = resolveEntityId(settings?.composioUser);
    const pref = (settings as any)?.preferredAccount ?? {};
    const pinned = typeof pref?.[channel] === "string" ? (pref[channel] as string) : null;
    const dispatched = await dispatchViaComposio({
      apiKey,
      entityId,
      channel: channel as Exclude<Channel, "email">,
      preferredAccountId: pinned,
      input: { subject: reminder.subject, body: reminder.body, to, recipientEmail: reminder.recipientEmail },
    });
    const updated = await client.mutation((api as any).reminders.markSent, {
      ownerClerkId: userId,
      reminderId: body.reminderId,
      channel,
    });
    return NextResponse.json({
      sent: true,
      channel,
      action: dispatched.actionName,
      app: dispatched.appName,
      accountId: (dispatched as any).accountId ?? null,
      reminder: updated,
    });
  } catch (e: unknown) {
    let message = "send failed";
    let status = 502;
    try {
      if (e instanceof Error) {
        const m = typeof e.message === "string" ? e.message.trim() : "";
        if (m) message = m.slice(0, 1000);
      } else if (typeof e === "string") {
        if (e.trim()) message = e.trim().slice(0, 1000);
      } else if (e !== null && e !== undefined) {
        try {
          const maybeMsg = (e as { message?: unknown })?.message;
          if (typeof maybeMsg === "string" && maybeMsg.trim()) message = maybeMsg.trim().slice(0, 1000);
          else {
            const s = String(e);
            if (s && s !== "[object Object]") message = s.slice(0, 1000);
          }
        } catch {
          // keep defaults
        }
      }
    } catch {
      // keep defaults
    }
    try {
      const s = (e as { status?: unknown })?.status;
      if (typeof s === "number" && Number.isFinite(s) && s >= 100 && s < 600) status = s;
    } catch {
      // keep 502
    }
    return fail(message, status);
  }
}
