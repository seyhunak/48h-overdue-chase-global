import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tenants: defineTable({
    name: v.string(),
    clerkOrgId: v.optional(v.string()),
    createdAt: v.number(),
  }),
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("user")),
    tenantId: v.optional(v.id("tenants")),
    createdAt: v.number(),
  }).index("by_clerkId", ["clerkId"]),
  invoices: defineTable({
    tenantId: v.optional(v.id("tenants")),
    ownerClerkId: v.string(),
    clientName: v.string(),
    invoiceId: v.string(),
    amount: v.number(),
    currency: v.string(),
    dueDate: v.string(),
    recipientEmail: v.optional(v.string()),
    daysOverdue: v.number(),
    status: v.string(),
    createdAt: v.number(),
  }).index("by_owner", ["ownerClerkId"]),
  submissions: defineTable({
    tenantId: v.optional(v.id("tenants")),
    ownerClerkId: v.string(),
    invoiceRefId: v.optional(v.id("invoices")),
    clientName: v.string(),
    invoiceId: v.string(),
    amount: v.number(),
    status: v.string(),
    creditsUsed: v.number(),
    createdAt: v.number(),
    dueDate: v.optional(v.string()),
    currency: v.optional(v.string()),
    recipientEmail: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
  }).index("by_owner", ["ownerClerkId"]),
  credits: defineTable({
    ownerClerkId: v.string(),
    balance: v.number(),
    lifetimeAdded: v.number(),
    lifetimeUsed: v.number(),
    updatedAt: v.number(),
  }).index("by_owner", ["ownerClerkId"]),
  vault: defineTable({
    tenantId: v.optional(v.id("tenants")),
    ownerClerkId: v.string(),
    kind: v.string(),
    title: v.string(),
    payload: v.string(),
    createdAt: v.number(),
  }).index("by_owner", ["ownerClerkId"]),
  reminders: defineTable({
    ownerClerkId: v.string(),
    invoiceId: v.string(),
    clientName: v.string(),
    amount: v.number(),
    currency: v.string(),
    dueDate: v.string(),
    recipientEmail: v.optional(v.string()),
    recipientPhone: v.optional(v.string()),
    // OneSignal channels (email|sms|push). Legacy union members (whatsapp/voice)
    // kept for live-data compat — new writes use email|sms|push only.
    channel: v.optional(
      v.union(v.literal("email"), v.literal("sms"), v.literal("push"), v.literal("whatsapp"), v.literal("voice")),
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
    payloadHash: v.string(),
    scheduledFor: v.number(),
    status: v.union(
      v.literal("pending_approval"),
      v.literal("approved"),
      v.literal("sent"),
      v.literal("skipped"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
    attempts: v.number(),
    lastError: v.optional(v.string()),
    sentAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_owner", ["ownerClerkId"])
    .index("by_status", ["status"]),
  invoiceState: defineTable({
    ownerClerkId: v.string(),
    invoiceId: v.string(),
    currentStep: v.optional(v.string()),
    touches: v.number(),
    paid: v.boolean(),
    unsubscribed: v.boolean(),
    lastTouchAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_owner", ["ownerClerkId"]),
  // Audit trail of the intelligent sweep's per-invoice decisions, including
  // "do nothing" outcomes. Queue-only — a decision never sends by itself.
  decisions: defineTable({
    ownerClerkId: v.string(),
    invoiceId: v.string(),
    clientName: v.optional(v.string()),
    amount: v.optional(v.number()),
    currency: v.optional(v.string()),
    stepKey: v.optional(v.string()),
    action: v.union(v.literal("queue"), v.literal("none")),
    channel: v.union(
      v.literal("email"),
      v.literal("sms"),
      v.literal("none"),
    ),
    reason: v.string(),
    detail: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_owner", ["ownerClerkId"]),
  settings: defineTable({
    ownerClerkId: v.string(),
    schedulerEnabled: v.boolean(),
    sendWindowStart: v.number(),
    sendWindowEnd: v.number(),
    // Owner-owned notification credentials: Composio API key + username,
    // and the OneSignal App ID the connected Composio account sends with.
    composioKey: v.optional(v.string()),
    composioUser: v.optional(v.string()),
    composioVerifiedAt: v.optional(v.number()),
    onesignalAppId: v.optional(v.string()),
    // Zoho Invoice import (Composio-managed OAuth2): owner's Zoho org id and a
    // pinned connected account id. No Zoho credential is ever stored here.
    zohoOrgId: v.optional(v.string()),
    zohoAccountId: v.optional(v.string()),
    // Per-owner SMS escalation controls (SPEC-sms-controls.md): undefined =
    // enabled / $2500 default, so pre-migration rows need no backfill.
    smsEnabled: v.optional(v.boolean()),
    smsThresholdUsd: v.optional(v.number()),
    preferredAccount: v.optional(
      v.object({
        whatsapp: v.optional(v.string()),
        sms: v.optional(v.string()),
        voice: v.optional(v.string()),
      }),
    ),
    updatedAt: v.number(),
  }).index("by_owner", ["ownerClerkId"]),
});
