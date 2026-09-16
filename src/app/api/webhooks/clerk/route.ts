import { NextResponse } from "next/server";
import { Webhook } from "svix";

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.replace(/\/+$/, "");
  if (!secret || !convexUrl) return NextResponse.json({ error: "Webhooks not configured" }, { status: 503 });
  const payload = await req.json();
  const headers = {
    "svix-id": req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  };
  try {
    new Webhook(secret).verify(JSON.stringify(payload), headers as any);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }
  if (payload.type === "user.created" || payload.type === "user.updated") {
    const u = payload.data;
    const email: string = u.email_addresses?.[0]?.email_address ?? "";
    const { ConvexHttpClient } = await import("convex/browser");
    const { api } = await import("../../../../../convex/_generated/api");
    const client = new ConvexHttpClient(convexUrl);
    await client.mutation((api as any).users.upsertFromClerk, { clerkId: u.id, email });
    await client.mutation((api as any).credits.getOrCreate, { clerkId: u.id });
  }
  return NextResponse.json({ received: true });
}
