import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { MissingEmailConfigError } from "@/infrastructure/resend";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.replace(/\/+$/, "");
  if (!convexUrl) return NextResponse.json({ error: "Backend not configured" }, { status: 503 });

  let body: { reminderId?: string; to?: string };
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
  if (reminder.status !== "approved") {
    return NextResponse.json(
      { error: `reminder is ${reminder.status}, not approved`, status: reminder.status },
      { status: 409 },
    );
  }

  // Recipient priority: explicit `to` param > per-invoice recipientEmail
  // stored on the queued reminder > RESEND_TO fallback. Keyless builds stay
  // green: nothing here is evaluated at build time.
  const to =
    body.to?.trim() ||
    (typeof reminder.recipientEmail === "string" && reminder.recipientEmail.trim()) ||
    process.env.RESEND_TO;
  if (!to) {
    return NextResponse.json(
      { error: "Email recipient not configured (pass `to`, queue the invoice with an email, or set RESEND_TO)" },
      { status: 503 },
    );
  }

  try {
    const { sendReminderEmail } = await import("@/infrastructure/resend");
    const sent = await sendReminderEmail({ to, subject: reminder.subject, text: reminder.body });
    // Mark sent + vault log {timestamp, payloadHash} inside the mutation.
    // NO credit charge at send time (credits are charged at chase).
    const updated = await client.mutation((api as any).reminders.markSent, {
      ownerClerkId: userId,
      reminderId: body.reminderId,
    });
    return NextResponse.json({ sent: true, resendId: sent.id, reminder: updated });
  } catch (e: any) {
    if (e instanceof MissingEmailConfigError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    const message = e?.message ?? "send failed";
    try {
      await client.mutation((api as any).reminders.markFailed, {
        ownerClerkId: userId,
        reminderId: body.reminderId,
        error: message,
      });
    } catch {
      // Best effort: the send already failed; don't mask the original error.
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
