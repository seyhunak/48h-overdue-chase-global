// Intelligent sweep decision engine (pure, no Convex imports — unit-testable).
//
// Given one invoice's data (amount, due date, contact info), its past actions
// (touches, sent reminders per channel, failures) and calendar facts, decide
// what the sweep should do NEXT for it:
//   - queue an EMAIL follow-up (default ladder step)
//   - queue an SMS escalation (high-value invoices, only after email was used)
//   - do NOTHING (with a human-readable reason)
//
// The decision ONLY ever creates a pending_approval row for a human to review
// in /app ("Approve + Send" / "Skip"). Nothing here sends anything.

export type DecidedChannel = "email" | "sms" | "none";

export type SweepDecision = {
  action: "queue" | "none";
  channel: DecidedChannel;
  reason: string;
  detail?: string;
};

export type SweepDecisionInput = {
  stepKey: string | null;
  amount: number;
  currency: string;
  email?: string | null;
  phone?: string | null;
  paid?: boolean;
  unsubscribed?: boolean;
  touches: number;
  lastTouchAt?: number | null;
  /** An email reminder already exists for this exact step (per-channel dedupe). */
  emailQueued: boolean;
  /** An SMS reminder already exists for this exact step (per-channel dedupe). */
  smsQueued: boolean;
  /** Past reminders for this invoice (any order). */
  pastReminders: Array<{
    stepKey: string;
    status: string;
    channel?: string | null;
    attempts?: number | null;
    lastError?: string | null;
    sentAt?: number | null;
    createdAt?: number | null;
  }>;
  nowMs: number;
};

/** Invoices at/above this amount (USD-equivalent) qualify for SMS escalation. */
export const ESCALATE_SMS_AMOUNT_USD = 2500;
/** Stop proposing a channel after this many failed attempts on the same step. */
export const MAX_ATTEMPTS_BEFORE_PAUSE = 3;
/** Steps where an SMS escalation may replace the email ladder step. */
const SMS_ESCALATION_STEPS = new Set(["+7", "+14", "+30"]);

/** Loose E.164-ish check: optional +, 7–15 digits. */
export function phoneLike(value: string): boolean {
  return /^\+?[1-9]\d{6,14}$/.test(value.trim());
}

export function isWeekendUtc(ms: number): boolean {
  const day = new Date(ms).getUTCDay();
  return day === 0 || day === 6;
}

function weekendName(ms: number): string {
  return new Date(ms).getUTCDay() === 0 ? "Sunday" : "Saturday";
}

function amountInUsd(amount: number, currency: string): number {
  const cur = (currency || "USD").trim().toUpperCase();
  // Rough display-currency guard for the escalation threshold. Only the
  // common non-USD cases are normalized; anything else is treated as USD.
  const rate = cur === "EUR" || cur === "GBP" ? 1.1 : 1;
  return amount * rate;
}

function latestForStep(
  reminders: SweepDecisionInput["pastReminders"],
  step: string,
): SweepDecisionInput["pastReminders"][number] | null {
  let best: SweepDecisionInput["pastReminders"][number] | null = null;
  for (const r of reminders) {
    if (r.stepKey !== step) continue;
    const t = Math.max(r.sentAt ?? 0, r.createdAt ?? 0);
    const bt = Math.max(best?.sentAt ?? 0, best?.createdAt ?? 0);
    if (!best || t > bt) best = r;
  }
  return best;
}

function latestFailed(reminders: SweepDecisionInput["pastReminders"]) {
  return reminders.find((r) => r.status === "failed") ?? null;
}

export function decideSweepAction(input: SweepDecisionInput): SweepDecision {
  if (!input.stepKey) {
    return { action: "none", channel: "none", reason: "no ladder step due" };
  }
  const step = input.stepKey;
  if (input.paid) {
    return { action: "none", channel: "none", reason: "paid — no follow-up" };
  }
  if (input.unsubscribed) {
    return { action: "none", channel: "none", reason: "unsubscribed — contact opted out" };
  }
  if (input.touches >= 5) {
    return {
      action: "none",
      channel: "none",
      reason: `max touches reached (${input.touches}/5) — ladder complete`,
    };
  }
  if (typeof input.lastTouchAt === "number") {
    const a = new Date(input.lastTouchAt);
    const b = new Date(input.nowMs);
    const sameUtcDay =
      a.getUTCFullYear() === b.getUTCFullYear() &&
      a.getUTCMonth() === b.getUTCMonth() &&
      a.getUTCDate() === b.getUTCDate();
    if (sameUtcDay) {
      return { action: "none", channel: "none", reason: "already touched today — next step resumes tomorrow" };
    }
  }
  // ---- SMS escalation check FIRST (before email dedupe) -----------------------
  // SMS only ever fires after an email was already sent for this step, so an
  // email-queued gate evaluated first would make escalation unreachable.
  const emailUsable = Boolean(input.email && input.email.trim());
  const phoneUsable = Boolean(input.phone && phoneLike(input.phone));
  const priorStepRow = latestForStep(input.pastReminders, step);
  const emailAlreadyUsedForStep =
    priorStepRow?.status === "sent" && (priorStepRow.channel ?? "email") === "email";
  const highValue = amountInUsd(input.amount, input.currency) >= ESCALATE_SMS_AMOUNT_USD;

  if (highValue && SMS_ESCALATION_STEPS.has(step) && emailAlreadyUsedForStep && phoneUsable) {
    if (input.smsQueued) {
      return {
        action: "none",
        channel: "none",
        reason: "duplicate step " + step + " — SMS already queued for approval",
      };
    }
    return {
      action: "queue",
      channel: "sms",
      reason: `SMS escalation — high-value invoice (≥ $${ESCALATE_SMS_AMOUNT_USD}), email already sent for ${step}`,
      detail: "Text is shorter and more urgent; approve only if a phone number is expected to work.",
    };
  }

  // ---- Email dedupe (per-channel idempotency) ----------------------------------
  if (input.emailQueued) {
    return {
      action: "none",
      channel: "none",
      reason: "duplicate step " + step + " — email already queued for approval",
    };
  }

  // ---- Channel health: stop proposing a channel that keeps failing -------------
  const failed = latestFailed(input.pastReminders);
  if (failed) {
    const attempts = typeof failed.attempts === "number" ? failed.attempts : 0;
    const failedAt = Math.max(failed.sentAt ?? 0, failed.createdAt ?? 0);
    const lastError = typeof failed.lastError === "string" ? failed.lastError : "";
    const authRejected = /401|unauthorized|invalid[\s_-]*(api[\s_-]*)?key|access denied/i.test(lastError);
    if (authRejected) {
      return {
        action: "none",
        channel: "none",
        reason: "paused — OneSignal rejected the stored key (401)",
        detail: "Reconnect with a OneSignal REST API key in /connect, then run the sweep again.",
      };
    }
    if (attempts >= MAX_ATTEMPTS_BEFORE_PAUSE) {
      return {
        action: "none",
        channel: "none",
        reason: `paused — ${attempts} failed send attempts`,
        detail: "Manual attention needed; fix the delivery issue before re-queuing.",
      };
    }
  }

  // ---- Weekend soft-defer: never OPEN a relationship touch on a weekend --------
  // Gentle steps (pre-due / due) wait for a weekday. Escalations (+7/+14/+30)
  // are time-critical and proceed.
  if ((step === "pre-due" || step === "due") && isWeekendUtc(input.nowMs)) {
    return {
      action: "none",
      channel: "none",
      reason: `deferred — ${step} falls on ${weekendName(input.nowMs)}`,
      detail: "Polite reminders wait for a weekday; run the sweep on Monday.",
    };
  }

  // ---- Default: email ladder step ---------------------------------------------
  if (emailUsable) {
    return {
      action: "queue",
      channel: "email",
      reason: `standard ${step} follow-up by email`,
    };
  }
  return {
    action: "none",
    channel: "none",
    reason: "no recipient email on invoice — add one in the CSV and re-chase",
  };
}
