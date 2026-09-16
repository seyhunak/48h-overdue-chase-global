import { NextResponse } from "next/server";
import { PACK_CREDITS } from "@/domain/invoices";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.replace(/\/+$/, "");
  if (!secret || !convexUrl) return NextResponse.json({ error: "Billing not configured" }, { status: 503 });

  const { Stripe } = await import("stripe");
  const stripe = new Stripe(secret);
  const raw = await req.text();
  let event: any;
  try {
    if (!webhookSecret || webhookSecret === "..." || webhookSecret === "placeholder") {
      event = JSON.parse(raw);
    } else {
      const sig = req.headers.get("stripe-signature") ?? "";
      event = stripe.webhooks.constructEvent(raw, sig, webhookSecret);
    }
  } catch (e: any) {
    return NextResponse.json({ error: `webhook error: ${e.message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
    const clerkId: string | undefined = session.metadata?.clerkId ?? session.client_reference_id;
    const credits = Number(session.metadata?.credits ?? PACK_CREDITS);
    if (clerkId && Number.isFinite(credits) && credits > 0) {
      const { ConvexHttpClient } = await import("convex/browser");
      const { api } = await import("../../../../../convex/_generated/api");
      const client = new ConvexHttpClient(convexUrl);
      await client.mutation((api as any).credits.addCredits, { clerkId, amount: credits });
    }
  }
  return NextResponse.json({ received: true });
}
