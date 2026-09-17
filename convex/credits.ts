import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const FREE_SIGNUP_CREDITS = 3;

async function getOrCreateRow(ctx: any, clerkId: string) {
  const existing = await ctx.db
    .query("credits")
    .withIndex("by_owner", (q: any) => q.eq("ownerClerkId", clerkId))
    .unique();
  if (existing) return existing;
  const now = Date.now();
  const id = await ctx.db.insert("credits", {
    ownerClerkId: clerkId,
    balance: FREE_SIGNUP_CREDITS,
    lifetimeAdded: FREE_SIGNUP_CREDITS,
    lifetimeUsed: 0,
    updatedAt: now,
  });
  return await ctx.db.get(id);
}

export const getOrCreate = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx: any, args: any) => {
    return await getOrCreateRow(ctx, args.clerkId);
  },
});

export const listAll = query({
  // Admin overview: every owner's balance + lifetime usage.
  args: {},
  handler: async (ctx: any) => {
    return await ctx.db.query("credits").collect();
  },
});

export const getBalance = query({
  args: { clerkId: v.string() },
  handler: async (ctx: any, args: any) => {
    const row = await ctx.db
      .query("credits")
      .withIndex("by_owner", (q: any) => q.eq("ownerClerkId", args.clerkId))
      .unique();
    if (!row) return { balance: 0, lifetimeAdded: 0, lifetimeUsed: 0 };
    return { balance: row.balance, lifetimeAdded: row.lifetimeAdded, lifetimeUsed: row.lifetimeUsed };
  },
});

export const consume = mutation({
  args: { clerkId: v.string(), amount: v.number() },
  handler: async (ctx: any, args: any) => {
    if (args.amount <= 0) throw new Error("amount must be positive");
    const row = await getOrCreateRow(ctx, args.clerkId);
    if (row.balance < args.amount) throw new Error("insufficient credits");
    await ctx.db.patch(row._id, {
      balance: row.balance - args.amount,
      lifetimeUsed: row.lifetimeUsed + args.amount,
      updatedAt: Date.now(),
    });
    return { balance: row.balance - args.amount };
  },
});

export const addCredits = mutation({
  args: { clerkId: v.string(), amount: v.number() },
  handler: async (ctx: any, args: any) => {
    if (args.amount <= 0) throw new Error("amount must be positive");
    const row = await getOrCreateRow(ctx, args.clerkId);
    await ctx.db.patch(row._id, {
      balance: row.balance + args.amount,
      lifetimeAdded: row.lifetimeAdded + args.amount,
      updatedAt: Date.now(),
    });
    return { balance: row.balance + args.amount };
  },
});
