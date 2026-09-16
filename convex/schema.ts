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
});
