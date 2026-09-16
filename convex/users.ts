import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Users: synced from Clerk webhook. Admin seeded via ADMIN_EMAIL match.
export const upsertFromClerk = mutation({
  args: { clerkId: v.string(), email: v.string() },
  handler: async (ctx: any, args: any) => {
    const adminEmail = process.env.ADMIN_EMAIL ?? "";
    const role = adminEmail && args.email.toLowerCase() === adminEmail.toLowerCase() ? "admin" : "user";
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q: any) => q.eq("clerkId", args.clerkId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { email: args.email, role });
      return existing._id;
    }
    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      role,
      createdAt: Date.now(),
    });
  },
});

export const getByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q: any) => q.eq("clerkId", args.clerkId))
      .unique();
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx: any) => {
    return await ctx.db.query("users").collect();
  },
});
