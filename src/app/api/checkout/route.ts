import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { PACK_CREDITS, PACK_PRICE_USD } from "@/domain/invoices";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const price = process.env.STRIPE_PRICE_CREDITS;
  if (!secret) return NextResponse.json({ error: "Billing not configured" }, { status: 503 });
  const { Stripe } = await import("stripe");
  const stripe = new Stripe(secret);
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const origin = new URL(req.url).origin;
  const isPriceId = Boolean(price?.startsWith("price_"));
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    ...(isPriceId && price
      ? { line_items: [{ price, quantity: 1 }] }
      : {
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "usd",
                unit_amount: PACK_PRICE_USD * 100,
                product_data: { name: `${PACK_CREDITS} credits @ $10/credit` },
              },
            },
          ],
        }),
    success_url: `${origin}/app?credits=added`,
    cancel_url: `${origin}/app`,
    metadata: { clerkId: userId, credits: String(PACK_CREDITS) },
  });
  return NextResponse.redirect(session.url!, 303);
}
