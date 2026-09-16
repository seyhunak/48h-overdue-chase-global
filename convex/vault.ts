import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listByOwner = query({
  args: { ownerClerkId: v.string() },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("vault")
      .withIndex("by_owner", (q: any) => q.eq("ownerClerkId", args.ownerClerkId))
      .order("desc")
      .collect();
  },
});

export const add = mutation({
  args: {
    ownerClerkId: v.string(),
    kind: v.string(),
    title: v.string(),
    payload: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    return await ctx.db.insert("vault", { ...args, createdAt: Date.now() });
  },
});
