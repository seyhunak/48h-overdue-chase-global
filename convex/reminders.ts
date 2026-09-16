import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Reminder / nudge dispatch policy (enforced in code, single source of truth):
// - max 1 touch / invoice / day (checked via invoiceState.lastTouchAt, UTC day)
// - max 5 touches / invoice lifetime (checked via invoiceState.touches)
// - send window 09:00–18:00 UTC (scheduledFor is snapped into the window;
//   per-owner overrides live in settings.sendWindowStart/End)
// - skip paid / unsubscribed invoices
// - dedupe on invoiceId + stepKey (idempotent queue)
// - cron NEVER sends: sweep paths create ONLY pending_approval rows.
//   Sending happens exclusively via the human-approved POST /api/reminders/send
//   route, which requires status === "approved" + caller ownership.

const STEP_KEYS = ["pre-due", "due", "+7", "+14", "+30"] as const;
const MAX_TOUCHES_PER_INVOICE = 5;
const DEFAULT_WINDOW_START = 9;
const DEFAULT_WINDOW_END = 18;

async function sha256Hex(input: string): Promise<string> {
  try {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    // Fallback only if WebCrypto is unavailable in the isolate (never expected).
    let h = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return `fnv1a-${h.toString(16).padStart(8, "0")}`;
  }
}

function sameUtcDay(aMs: number, bMs: number): boolean {
  const a = new Date(aMs);
  const b = new Date(bMs);
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function snapIntoWindow(nowMs: number, startH: number, endH: number): number {
  const d = new Date(nowMs);
  const hour = d.getUTCHours();
  if (hour < startH) {
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), startH, 0, 0, 0);
  }
  if (hour >= endH) {
    const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) + 86400000);
    return Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate(), startH, 0, 0, 0);
  }
  return nowMs;
}

async function getSettingsRow(ctx: any, ownerClerkId: string) {
  return await ctx.db
    .query("settings")
    .withIndex("by_owner", (q: any) => q.eq("ownerClerkId", ownerClerkId))
    .unique();
}

async function getStateRow(ctx: any, ownerClerkId: string, invoiceId: string) {
  const rows = await ctx.db
    .query("invoiceState")
    .withIndex("by_owner", (q: any) => q.eq("ownerClerkId", ownerClerkId))
    .collect();
  return rows.find((r: any) => r.invoiceId === invoiceId) ?? null;
}

async function findReminderForStep(ctx: any, ownerClerkId: string, invoiceId: string, stepKey: string) {
  const rows = await ctx.db
    .query("reminders")
    .withIndex("by_owner", (q: any) => q.eq("ownerClerkId", ownerClerkId))
    .collect();
  return rows.find((r: any) => r.invoiceId === invoiceId && r.stepKey === stepKey) ?? null;
}

// Ladder boundary -> which step is due for an invoice right now.
// diffDays = floor((now - dueMidnightUtc) / day). Catch-up semantics:
// once a threshold is crossed the step stays due until queued (dedupe
// prevents repeats), so missed cron days self-heal on the next sweep.
function stepForDiff(diffDays: number): string | null {
  if (diffDays === -1) return "pre-due";
  if (diffDays === 0) return "due";
  if (diffDays >= 30) return "+30";
  if (diffDays >= 14) return "+14";
  if (diffDays >= 7) return "+7";
  return null;
}

function buildStepCopy(stepKey: string, clientName: string, invoiceId: string, amount: number, currency: string, dueDate: string) {
  const amt = `${currency} ${amount.toFixed(2)}`;
  switch (stepKey) {
    case "pre-due":
      return {
        subject: `Upcoming: invoice ${invoiceId} (${amt}) due ${dueDate}`,
        body: `Hi ${clientName},\n\nQuick heads-up that invoice ${invoiceId} for ${amt} is due ${dueDate}. Let us know if you need anything to clear it on time.\n\nThanks!`,
      };
    case "due":
      return {
        subject: `Due today: invoice ${invoiceId} — ${amt}`,
        body: `Hi ${clientName},\n\nInvoice ${invoiceId} for ${amt} is due today. Payment link/details are on the invoice. Reply if already paid.\n\nThanks!`,
      };
    case "+7":
      return {
        subject: `Overdue 7 days: invoice ${invoiceId} — ${amt}`,
        body: `Hi ${clientName},\n\nInvoice ${invoiceId} (${amt}, due ${dueDate}) is now 7 days overdue. Please confirm payment date this week.\n\nThanks!`,
      };
    case "+14":
      return {
        subject: `Overdue 14 days: invoice ${invoiceId} needs action`,
        body: `Hi ${clientName},\n\nInvoice ${invoiceId} (${amt}) is 14 days overdue. Please pay within 3 business days or propose a date. Late fees may apply per terms.\n\nThanks!`,
      };
    default:
      return {
        subject: `Final notice: invoice ${invoiceId} — 30 days overdue`,
        body: `Hi ${clientName},\n\nInvoice ${invoiceId} (${amt}, due ${dueDate}) is 30 days overdue. This is a final notice before escalation/collections. Pay immediately or contact us today.\n\nThanks!`,
      };
  }
}

// Tracked-invoice source: submissions (workbench chase writes). Dedupe by
// invoiceId, newest row wins for amount/dueDate/clientName/email.
async function getTrackedInvoices(ctx: any, ownerClerkId: string) {
  const subs = await ctx.db
    .query("submissions")
    .withIndex("by_owner", (q: any) => q.eq("ownerClerkId", ownerClerkId))
    .order("desc")
    .collect();
  const byId = new Map<string, any>();
  for (const s of subs) {
    if (typeof s.invoiceId !== "string" || !s.invoiceId) continue;
    if (!byId.has(s.invoiceId)) byId.set(s.invoiceId, s);
  }
  return [...byId.values()];
}

type SweepResult = { queued: number; skipped: Array<{ invoiceId: string; reason: string }> };

// Shared sweep for ONE owner. Creates ONLY pending_approval rows — never sends.
// Source: submissions (tracked invoices). The legacy `invoices` table is left
// untouched in schema but no longer read here.
async function sweepOwner(ctx: any, ownerClerkId: string, nowMs: number): Promise<SweepResult> {
  const settings = await getSettingsRow(ctx, ownerClerkId);
  const startH = settings?.sendWindowStart ?? DEFAULT_WINDOW_START;
  const endH = settings?.sendWindowEnd ?? DEFAULT_WINDOW_END;
  const tracked = await getTrackedInvoices(ctx, ownerClerkId);
  const result: SweepResult = { queued: 0, skipped: [] };
  for (const sub of tracked) {
    const invoiceId: string = sub.invoiceId;
    const clientName: string = sub.clientName ?? "";
    const amount: number = typeof sub.amount === "number" ? sub.amount : 0;
    const currency: string =
      typeof sub.currency === "string" && sub.currency ? sub.currency : "USD";
    const dueDateStr: string = typeof sub.dueDate === "string" ? sub.dueDate : "";
    const emailRaw =
      typeof sub.recipientEmail === "string"
        ? sub.recipientEmail
        : typeof sub.email === "string"
          ? sub.email
          : "";
    const due = new Date(dueDateStr);
    if (!dueDateStr || Number.isNaN(due.getTime())) {
      result.skipped.push({ invoiceId, reason: "invalid dueDate" });
      continue;
    }
    const dueMidnight = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
    const nowMidnight = Date.UTC(
      new Date(nowMs).getUTCFullYear(),
      new Date(nowMs).getUTCMonth(),
      new Date(nowMs).getUTCDate(),
    );
    const stepKey = stepForDiff(Math.floor((nowMidnight - dueMidnight) / 86400000));
    if (!stepKey) {
      result.skipped.push({ invoiceId, reason: "no ladder step due" });
      continue;
    }
    const state = await getStateRow(ctx, ownerClerkId, invoiceId);
    if (state?.paid) {
      result.skipped.push({ invoiceId, reason: "paid" });
      continue;
    }
    if (state?.unsubscribed) {
      result.skipped.push({ invoiceId, reason: "unsubscribed" });
      continue;
    }
    if ((state?.touches ?? 0) >= MAX_TOUCHES_PER_INVOICE) {
      result.skipped.push({ invoiceId, reason: "max touches reached" });
      continue;
    }
    if (state?.lastTouchAt && sameUtcDay(state.lastTouchAt, nowMs)) {
      result.skipped.push({ invoiceId, reason: "already touched today" });
      continue;
    }
    const existing = await findReminderForStep(ctx, ownerClerkId, invoiceId, stepKey);
    if (existing) {
      result.skipped.push({ invoiceId, reason: `duplicate step ${stepKey}` });
      continue;
    }
    const copy = buildStepCopy(stepKey, clientName, invoiceId, amount, currency, dueDateStr);
    const payloadHash = await sha256Hex(copy.subject + copy.body);
    const recipientEmail = typeof emailRaw === "string" ? emailRaw.trim() : "";
    await ctx.db.insert("reminders", {
      ownerClerkId,
      invoiceId,
      clientName,
      amount,
      currency,
      dueDate: dueDateStr,
      recipientEmail,
      channel: "email",
      stepKey,
      subject: copy.subject,
      body: copy.body,
      payloadHash,
      scheduledFor: snapIntoWindow(nowMs, startH, endH),
      status: "pending_approval",
      attempts: 0,
      createdAt: nowMs,
    });
    if (state) {
      await ctx.db.patch(state._id, { currentStep: stepKey, updatedAt: nowMs });
    } else {
      await ctx.db.insert("invoiceState", {
        ownerClerkId,
        invoiceId,
        currentStep: stepKey,
        touches: 0,
        paid: false,
        unsubscribed: false,
        updatedAt: nowMs,
      });
    }
    result.queued += 1;
  }
  return result;
}

export const getPending = query({
  args: { ownerClerkId: v.string() },
  handler: async (ctx: any, args: any) => {
    const rows = await ctx.db
      .query("reminders")
      .withIndex("by_owner", (q: any) => q.eq("ownerClerkId", args.ownerClerkId))
      .order("desc")
      .collect();
    return rows.filter((r: any) => r.status === "pending_approval");
  },
});

export const getHistory = query({
  args: { ownerClerkId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx: any, args: any) => {
    const rows = await ctx.db
      .query("reminders")
      .withIndex("by_owner", (q: any) => q.eq("ownerClerkId", args.ownerClerkId))
      .order("desc")
      .collect();
    const filtered = rows.filter((r: any) => r.status !== "pending_approval");
    return typeof args.limit === "number" ? filtered.slice(0, args.limit) : filtered;
  },
});

export const getStates = query({
  args: { ownerClerkId: v.string() },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("invoiceState")
      .withIndex("by_owner", (q: any) => q.eq("ownerClerkId", args.ownerClerkId))
      .collect();
  },
});

// Boundary map: pure read over tracked invoices (submissions, newest wins).
// Left-joins invoiceState by invoiceId + reminders by invoiceId, computes
// diffDays / dueStep live, and skipReasons[] in the SAME gate order as
// sweepOwner. No writes.
export const getBoundaryMap = query({
  args: { ownerClerkId: v.string() },
  handler: async (ctx: any, args: any) => {
    const nowMs = Date.now();
    const nowD = new Date(nowMs);
    const nowMidnight = Date.UTC(nowD.getUTCFullYear(), nowD.getUTCMonth(), nowD.getUTCDate());
    const tracked = await getTrackedInvoices(ctx, args.ownerClerkId);
    const stateRows = await ctx.db
      .query("invoiceState")
      .withIndex("by_owner", (q: any) => q.eq("ownerClerkId", args.ownerClerkId))
      .collect();
    const stateById = new Map<string, any>();
    for (const s of stateRows) stateById.set(s.invoiceId, s);
    const reminderRows = await ctx.db
      .query("reminders")
      .withIndex("by_owner", (q: any) => q.eq("ownerClerkId", args.ownerClerkId))
      .collect();
    const remindersById = new Map<string, any[]>();
    for (const r of reminderRows) {
      const list = remindersById.get(r.invoiceId) ?? [];
      list.push(r);
      remindersById.set(r.invoiceId, list);
    }
    const out: any[] = [];
    for (const sub of tracked) {
      const invoiceId: string = sub.invoiceId;
      const clientName: string = sub.clientName ?? "";
      const amount: number = typeof sub.amount === "number" ? sub.amount : 0;
      const currency: string =
        typeof sub.currency === "string" && sub.currency ? sub.currency : "USD";
      const dueDateStr: string = typeof sub.dueDate === "string" ? sub.dueDate : "";
      const email =
        typeof sub.recipientEmail === "string" && sub.recipientEmail
          ? sub.recipientEmail
          : typeof sub.email === "string"
            ? sub.email
            : "";
      const due = new Date(dueDateStr);
      const valid = Boolean(dueDateStr) && !Number.isNaN(due.getTime());
      const diffDays = valid
        ? Math.floor(
            (nowMidnight - Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate())) /
              86400000,
          )
        : null;
      const dueStep = diffDays === null ? null : stepForDiff(diffDays);
      const state = stateById.get(invoiceId) ?? null;
      const touches: number = state?.touches ?? 0;
      const paid: boolean = Boolean(state?.paid);
      const unsubscribed: boolean = Boolean(state?.unsubscribed);
      const lastTouchAt: number | null =
        typeof state?.lastTouchAt === "number" ? state.lastTouchAt : null;
      const rows = (remindersById.get(invoiceId) ?? [])
        .slice()
        .sort((a: any, b: any) => (a.scheduledFor ?? 0) - (b.scheduledFor ?? 0));
      const steps = rows.map((r: any) => ({
        stepKey: r.stepKey,
        status: r.status,
        scheduledFor: r.scheduledFor,
        sentAt: typeof r.sentAt === "number" ? r.sentAt : null,
        attempts: typeof r.attempts === "number" ? r.attempts : 0,
        lastError: typeof r.lastError === "string" ? r.lastError : null,
      }));
      // SAME gate order as sweepOwner.
      const skipReasons: string[] = [];
      if (!valid) {
        skipReasons.push("invalid dueDate");
      } else if (!dueStep) {
        skipReasons.push("no ladder step due");
      }
      if (paid) skipReasons.push("paid");
      if (unsubscribed) skipReasons.push("unsubscribed");
      if (touches >= MAX_TOUCHES_PER_INVOICE) skipReasons.push("max touches reached");
      if (typeof state?.lastTouchAt === "number" && sameUtcDay(state.lastTouchAt, nowMs)) {
        skipReasons.push("already touched today");
      }
      if (dueStep) {
        const dup = rows.some((r: any) => r.stepKey === dueStep);
        if (dup) skipReasons.push(`duplicate step ${dueStep}`);
      }
      out.push({
        invoiceId,
        clientName,
        amount,
        currency,
        dueDate: dueDateStr,
        email,
        diffDays,
        dueStep,
        touches,
        paid,
        unsubscribed,
        lastTouchAt,
        steps,
        skipReasons,
        createdAt: typeof sub.createdAt === "number" ? sub.createdAt : 0,
      });
    }
    // Newest first.
    out.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    return out;
  },
});

export const getSettings = query({
  args: { ownerClerkId: v.string() },
  handler: async (ctx: any, args: any) => {
    const row = await getSettingsRow(ctx, args.ownerClerkId);
    if (row) return row;
    // Defaults for owners who never saved settings (scheduler OFF by default).
    return {
      ownerClerkId: args.ownerClerkId,
      schedulerEnabled: false,
      sendWindowStart: DEFAULT_WINDOW_START,
      sendWindowEnd: DEFAULT_WINDOW_END,
      updatedAt: 0,
    };
  },
});

export const setScheduler = mutation({
  args: {
    ownerClerkId: v.string(),
    enabled: v.boolean(),
    sendWindowStart: v.optional(v.number()),
    sendWindowEnd: v.optional(v.number()),
  },
  handler: async (ctx: any, args: any) => {
    const start = args.sendWindowStart ?? DEFAULT_WINDOW_START;
    const end = args.sendWindowEnd ?? DEFAULT_WINDOW_END;
    if (start < 0 || start > 23 || end < 0 || end > 24 || start >= end) {
      throw new Error("invalid send window (0–23, start < end, UTC hours)");
    }
    const now = Date.now();
    const existing = await getSettingsRow(ctx, args.ownerClerkId);
    if (existing) {
      await ctx.db.patch(existing._id, {
        schedulerEnabled: args.enabled,
        sendWindowStart: start,
        sendWindowEnd: end,
        updatedAt: now,
      });
      return await ctx.db.get(existing._id);
    }
    const id = await ctx.db.insert("settings", {
      ownerClerkId: args.ownerClerkId,
      schedulerEnabled: args.enabled,
      sendWindowStart: start,
      sendWindowEnd: end,
      updatedAt: now,
    });
    return await ctx.db.get(id);
  },
});

export const queueForInvoice = mutation({
  args: {
    ownerClerkId: v.string(),
    invoiceId: v.string(),
    clientName: v.string(),
    amount: v.number(),
    currency: v.string(),
    dueDate: v.string(),
    recipientEmail: v.optional(v.string()),
    channel: v.optional(
      v.union(v.literal("email"), v.literal("whatsapp"), v.literal("sms"), v.literal("voice")),
    ),
    stepKey: v.union(
      v.literal("pre-due"),
      v.literal("due"),
      v.literal("+7"),
      v.literal("+14"),
      v.literal("+30"),
    ),
    subject: v.string(),
    body: v.string(),
    scheduledFor: v.optional(v.number()),
  },
  handler: async (ctx: any, args: any) => {
    if (!STEP_KEYS.includes(args.stepKey)) throw new Error("invalid stepKey");
    // Idempotent on invoiceId + stepKey.
    const existing = await findReminderForStep(ctx, args.ownerClerkId, args.invoiceId, args.stepKey);
    if (existing) return { id: existing._id, deduped: true as const };
    const state = await getStateRow(ctx, args.ownerClerkId, args.invoiceId);
    if (state?.paid) throw new Error("invoice is paid");
    if (state?.unsubscribed) throw new Error("invoice is unsubscribed");
    if ((state?.touches ?? 0) >= MAX_TOUCHES_PER_INVOICE) throw new Error("max touches reached");
    const now = Date.now();
    if (state?.lastTouchAt && sameUtcDay(state.lastTouchAt, now)) {
      throw new Error("already touched today");
    }
    const settings = await getSettingsRow(ctx, args.ownerClerkId);
    const recipientEmail = (args.recipientEmail ?? "").trim();
    if (recipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      throw new Error(`invalid recipientEmail: ${recipientEmail}`);
    }
    const payloadHash = await sha256Hex(args.subject + args.body);
    const id = await ctx.db.insert("reminders", {
      ownerClerkId: args.ownerClerkId,
      invoiceId: args.invoiceId,
      clientName: args.clientName,
      amount: args.amount,
      currency: args.currency,
      dueDate: args.dueDate,
      recipientEmail,
      channel: args.channel ?? "email",
      stepKey: args.stepKey,
      subject: args.subject,
      body: args.body,
      payloadHash,
      scheduledFor: snapIntoWindow(
        args.scheduledFor ?? now,
        settings?.sendWindowStart ?? DEFAULT_WINDOW_START,
        settings?.sendWindowEnd ?? DEFAULT_WINDOW_END,
      ),
      status: "pending_approval",
      attempts: 0,
      createdAt: now,
    });
    return { id, deduped: false as const };
  },
});

export const approve = mutation({
  args: { ownerClerkId: v.string(), reminderId: v.id("reminders") },
  handler: async (ctx: any, args: any) => {
    const row = await ctx.db.get(args.reminderId);
    if (!row || row.ownerClerkId !== args.ownerClerkId) throw new Error("reminder not found");
    if (row.status !== "pending_approval") throw new Error(`cannot approve from status ${row.status}`);
    const state = await getStateRow(ctx, args.ownerClerkId, row.invoiceId);
    if (state?.paid) throw new Error("invoice is paid");
    if (state?.unsubscribed) throw new Error("invoice is unsubscribed");
    if ((state?.touches ?? 0) >= MAX_TOUCHES_PER_INVOICE) throw new Error("max touches reached");
    if (state?.lastTouchAt && sameUtcDay(state.lastTouchAt, Date.now())) {
      throw new Error("already touched today");
    }
    await ctx.db.patch(row._id, { status: "approved" });
    return await ctx.db.get(row._id);
  },
});

export const skip = mutation({
  args: { ownerClerkId: v.string(), reminderId: v.id("reminders") },
  handler: async (ctx: any, args: any) => {
    const row = await ctx.db.get(args.reminderId);
    if (!row || row.ownerClerkId !== args.ownerClerkId) throw new Error("reminder not found");
    if (row.status !== "pending_approval") throw new Error(`cannot skip from status ${row.status}`);
    await ctx.db.patch(row._id, { status: "skipped" });
    return await ctx.db.get(row._id);
  },
});

export const cancel = mutation({
  args: { ownerClerkId: v.string(), reminderId: v.id("reminders") },
  handler: async (ctx: any, args: any) => {
    const row = await ctx.db.get(args.reminderId);
    if (!row || row.ownerClerkId !== args.ownerClerkId) throw new Error("reminder not found");
    if (row.status !== "pending_approval" && row.status !== "approved") {
      throw new Error(`cannot cancel from status ${row.status}`);
    }
    await ctx.db.patch(row._id, { status: "cancelled" });
    return await ctx.db.get(row._id);
  },
});

export const markPaid = mutation({
  args: { ownerClerkId: v.string(), invoiceId: v.string(), paid: v.boolean() },
  handler: async (ctx: any, args: any) => {
    const now = Date.now();
    const state = await getStateRow(ctx, args.ownerClerkId, args.invoiceId);
    if (state) {
      await ctx.db.patch(state._id, { paid: args.paid, updatedAt: now });
    } else {
      await ctx.db.insert("invoiceState", {
        ownerClerkId: args.ownerClerkId,
        invoiceId: args.invoiceId,
        touches: 0,
        paid: args.paid,
        unsubscribed: false,
        updatedAt: now,
      });
    }
    // Paid invoices stop the ladder: cancel anything still awaiting approval/send.
    if (args.paid) {
      const rows = await ctx.db
        .query("reminders")
        .withIndex("by_owner", (q: any) => q.eq("ownerClerkId", args.ownerClerkId))
        .collect();
      for (const r of rows.filter(
        (r: any) =>
          r.invoiceId === args.invoiceId && (r.status === "pending_approval" || r.status === "approved"),
      )) {
        await ctx.db.patch(r._id, { status: "cancelled" });
      }
    }
    return { invoiceId: args.invoiceId, paid: args.paid };
  },
});

export const setUnsubscribed = mutation({
  args: { ownerClerkId: v.string(), invoiceId: v.string(), unsubscribed: v.boolean() },
  handler: async (ctx: any, args: any) => {
    const now = Date.now();
    const state = await getStateRow(ctx, args.ownerClerkId, args.invoiceId);
    if (state) {
      await ctx.db.patch(state._id, { unsubscribed: args.unsubscribed, updatedAt: now });
    } else {
      await ctx.db.insert("invoiceState", {
        ownerClerkId: args.ownerClerkId,
        invoiceId: args.invoiceId,
        touches: 0,
        paid: false,
        unsubscribed: args.unsubscribed,
        updatedAt: now,
      });
    }
    return { invoiceId: args.invoiceId, unsubscribed: args.unsubscribed };
  },
});

export const setChannel = mutation({
  args: {
    ownerClerkId: v.string(),
    reminderId: v.id("reminders"),
    channel: v.union(v.literal("email"), v.literal("whatsapp"), v.literal("sms"), v.literal("voice")),
  },
  handler: async (ctx: any, args: any) => {
    const row = await ctx.db.get(args.reminderId);
    if (!row || row.ownerClerkId !== args.ownerClerkId) throw new Error("reminder not found");
    if (row.status !== "pending_approval") throw new Error(`cannot change channel from status ${row.status}`);
    await ctx.db.patch(row._id, { channel: args.channel });
    return await ctx.db.get(row._id);
  },
});

export const reopen = mutation({
  args: { ownerClerkId: v.string(), invoiceId: v.string() },
  handler: async (ctx: any, args: any) => {
    const now = Date.now();
    const state = await getStateRow(ctx, args.ownerClerkId, args.invoiceId);
    if (state) {
      // Reopen: paid=false, keep touches/history/lastTouchAt.
      await ctx.db.patch(state._id, { paid: false, updatedAt: now });
    } else {
      await ctx.db.insert("invoiceState", {
        ownerClerkId: args.ownerClerkId,
        invoiceId: args.invoiceId,
        touches: 0,
        paid: false,
        unsubscribed: false,
        updatedAt: now,
      });
    }
    return { invoiceId: args.invoiceId, paid: false };
  },
});

export const resubscribe = mutation({
  args: { ownerClerkId: v.string(), invoiceId: v.string() },
  handler: async (ctx: any, args: any) => {
    const now = Date.now();
    const state = await getStateRow(ctx, args.ownerClerkId, args.invoiceId);
    if (state) {
      await ctx.db.patch(state._id, { unsubscribed: false, updatedAt: now });
    } else {
      await ctx.db.insert("invoiceState", {
        ownerClerkId: args.ownerClerkId,
        invoiceId: args.invoiceId,
        touches: 0,
        paid: false,
        unsubscribed: false,
        updatedAt: now,
      });
    }
    return { invoiceId: args.invoiceId, unsubscribed: false };
  },
});

export const saveComposioSettings = mutation({
  args: { ownerClerkId: v.string(), composioUser: v.string(), composioKey: v.string() },
  handler: async (ctx: any, args: any) => {
    const user = (args.composioUser ?? "").trim() || "default";
    const key = (args.composioKey ?? "").trim();
    if (!key) throw new Error("composioKey required");
    if (user.length > 120) throw new Error("composioUser too long");
    const now = Date.now();
    const existing = await getSettingsRow(ctx, args.ownerClerkId);
    if (existing) {
      await ctx.db.patch(existing._id, { composioUser: user, composioKey: key, updatedAt: now });
      return await ctx.db.get(existing._id);
    }
    const id = await ctx.db.insert("settings", {
      ownerClerkId: args.ownerClerkId,
      schedulerEnabled: false,
      sendWindowStart: DEFAULT_WINDOW_START,
      sendWindowEnd: DEFAULT_WINDOW_END,
      composioUser: user,
      composioKey: key,
      updatedAt: now,
    });
    return await ctx.db.get(id);
  },
});

export const setComposioVerified = mutation({
  args: { ownerClerkId: v.string(), verifiedAt: v.number() },
  handler: async (ctx: any, args: any) => {
    const now = Date.now();
    const existing = await getSettingsRow(ctx, args.ownerClerkId);
    if (existing) {
      await ctx.db.patch(existing._id, { composioVerifiedAt: args.verifiedAt, updatedAt: now });
      return await ctx.db.get(existing._id);
    }
    const id = await ctx.db.insert("settings", {
      ownerClerkId: args.ownerClerkId,
      schedulerEnabled: false,
      sendWindowStart: DEFAULT_WINDOW_START,
      sendWindowEnd: DEFAULT_WINDOW_END,
      composioVerifiedAt: args.verifiedAt,
      updatedAt: now,
    });
    return await ctx.db.get(id);
  },
});

export const getComposioStatus = query({
  args: { ownerClerkId: v.string() },
  handler: async (ctx: any, args: any) => {
    const row = await getSettingsRow(ctx, args.ownerClerkId);
    const pref = (row as any)?.preferredAccount ?? {};
    return {
      ownerClerkId: args.ownerClerkId,
      hasKey: Boolean(row?.composioKey),
      composioUser: typeof row?.composioUser === "string" && row.composioUser ? row.composioUser : "default",
      composioVerifiedAt: typeof row?.composioVerifiedAt === "number" ? row.composioVerifiedAt : null,
      preferredAccount: {
        whatsapp: typeof pref?.whatsapp === "string" ? pref.whatsapp : null,
        sms: typeof pref?.sms === "string" ? pref.sms : null,
        voice: typeof pref?.voice === "string" ? pref.voice : null,
      },
    };
  },
});

export const setPreferredAccounts = mutation({
  args: {
    ownerClerkId: v.string(),
    whatsapp: v.optional(v.string()),
    sms: v.optional(v.string()),
    voice: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any) => {
    const clean = (val: unknown) => {
      if (typeof val !== "string") return undefined;
      const t = val.trim().slice(0, 200);
      return t ? t : undefined;
    };
    const preferred: Record<string, string> = {};
    const w = clean(args.whatsapp);
    const s = clean(args.sms);
    const vo = clean(args.voice);
    if (w) preferred.whatsapp = w;
    if (s) preferred.sms = s;
    if (vo) preferred.voice = vo;
    const now = Date.now();
    const existing = await getSettingsRow(ctx, args.ownerClerkId);
    if (existing) {
      await ctx.db.patch(existing._id, {
        preferredAccount: Object.keys(preferred).length > 0 ? preferred : undefined,
        updatedAt: now,
      });
      return await ctx.db.get(existing._id);
    }
    const id = await ctx.db.insert("settings", {
      ownerClerkId: args.ownerClerkId,
      schedulerEnabled: false,
      sendWindowStart: DEFAULT_WINDOW_START,
      sendWindowEnd: DEFAULT_WINDOW_END,
      preferredAccount: Object.keys(preferred).length > 0 ? preferred : undefined,
      updatedAt: now,
    });
    return await ctx.db.get(id);
  },
});

export const clearComposioConnection = mutation({
  args: { ownerClerkId: v.string() },
  handler: async (ctx: any, args: any) => {
    const now = Date.now();
    const existing = await getSettingsRow(ctx, args.ownerClerkId);
    if (existing) {
      await ctx.db.patch(existing._id, {
        composioKey: undefined,
        composioUser: undefined,
        composioVerifiedAt: undefined,
        preferredAccount: undefined,
        updatedAt: now,
      });
      return await ctx.db.get(existing._id);
    }
    const id = await ctx.db.insert("settings", {
      ownerClerkId: args.ownerClerkId,
      schedulerEnabled: false,
      sendWindowStart: DEFAULT_WINDOW_START,
      sendWindowEnd: DEFAULT_WINDOW_END,
      updatedAt: now,
    });
    return await ctx.db.get(id);
  },
});

// Manual per-owner sweep (wired to the workbench "Run due sweep now" button).
// This is an explicit human trigger, so it runs regardless of the scheduler
// toggle; the cron path below is what honors schedulerEnabled.
export const runDueSweepForOwner = mutation({
  args: { ownerClerkId: v.string() },
  handler: async (ctx: any, args: any) => {
    return await sweepOwner(ctx, args.ownerClerkId, Date.now());
  },
});

// Cron entrypoint: sweeps ONLY owners who opted in (schedulerEnabled).
// Creates pending_approval rows — NEVER sends.
export const sweepAllOwners = internalMutation({
  args: {},
  handler: async (ctx: any) => {
    const allSettings = await ctx.db.query("settings").collect();
    const enabled = allSettings.filter((s: any) => s.schedulerEnabled);
    const totals = { owners: 0, queued: 0 };
    for (const s of enabled) {
      const r = await sweepOwner(ctx, s.ownerClerkId, Date.now());
      totals.owners += 1;
      totals.queued += r.queued;
    }
    return totals;
  },
});

// --- Send-route helpers (server-only API route, never called from the client) ---

export const getByIdForOwner = query({
  args: { ownerClerkId: v.string(), reminderId: v.id("reminders") },
  handler: async (ctx: any, args: any) => {
    const row = await ctx.db.get(args.reminderId);
    if (!row || row.ownerClerkId !== args.ownerClerkId) return null;
    return row;
  },
});

export const markSent = mutation({
  args: {
    ownerClerkId: v.string(),
    reminderId: v.id("reminders"),
    channel: v.optional(
      v.union(v.literal("email"), v.literal("whatsapp"), v.literal("sms"), v.literal("voice")),
    ),
  },
  handler: async (ctx: any, args: any) => {
    const row = await ctx.db.get(args.reminderId);
    if (!row || row.ownerClerkId !== args.ownerClerkId) throw new Error("reminder not found");
    if (row.status !== "approved") throw new Error(`cannot send from status ${row.status}`);
    const now = Date.now();
    await ctx.db.patch(row._id, {
      status: "sent",
      sentAt: now,
      attempts: (row.attempts ?? 0) + 1,
      lastError: undefined,
    });
    const state = await getStateRow(ctx, args.ownerClerkId, row.invoiceId);
    if (state) {
      await ctx.db.patch(state._id, {
        touches: (state.touches ?? 0) + 1,
        lastTouchAt: now,
        currentStep: row.stepKey,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("invoiceState", {
        ownerClerkId: args.ownerClerkId,
        invoiceId: row.invoiceId,
        currentStep: row.stepKey,
        touches: 1,
        paid: false,
        unsubscribed: false,
        lastTouchAt: now,
        updatedAt: now,
      });
    }
    // Vault audit log — NO credit charge at send time (charged at follow-up).
    // Applies identically to EVERY channel.
    const channel = args.channel ?? (row as any).channel ?? "email";
    await ctx.db.insert("vault", {
      ownerClerkId: args.ownerClerkId,
      kind: "reminder_sent",
      title: `${row.clientName} · ${row.invoiceId} · ${row.stepKey} · ${channel}`,
      payload: JSON.stringify({ timestamp: now, payloadHash: row.payloadHash, channel }),
      createdAt: now,
    });
    return await ctx.db.get(row._id);
  },
});

export const markFailed = mutation({
  args: { ownerClerkId: v.string(), reminderId: v.id("reminders"), error: v.string() },
  handler: async (ctx: any, args: any) => {
    const row = await ctx.db.get(args.reminderId);
    if (!row || row.ownerClerkId !== args.ownerClerkId) throw new Error("reminder not found");
    await ctx.db.patch(row._id, {
      status: "failed",
      attempts: (row.attempts ?? 0) + 1,
      lastError: args.error.slice(0, 500),
    });
    return await ctx.db.get(row._id);
  },
});
