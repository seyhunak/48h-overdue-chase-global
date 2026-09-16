import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listByOwner = query({
  args: { ownerClerkId: v.string() },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("submissions")
      .withIndex("by_owner", (q: any) => q.eq("ownerClerkId", args.ownerClerkId))
      .order("desc")
      .collect();
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx: any) => {
    return await ctx.db.query("submissions").order("desc").collect();
  },
});

export const record = mutation({
  args: {
    ownerClerkId: v.string(),
    clientName: v.string(),
    invoiceId: v.string(),
    amount: v.number(),
    status: v.string(),
    creditsUsed: v.number(),
  },
  handler: async (ctx: any, args: any) => {
    return await ctx.db.insert("submissions", { ...args, createdAt: Date.now() });
  },
});
