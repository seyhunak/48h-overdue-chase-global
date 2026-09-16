# OverdueChase — 48h fix-pack

**Problem:** Founders at 5–50 person service firms waste 5–15h/week chasing overdue invoices.
**Buyer:** Founder / COO.
**Offer:** $99 = 100 credits ($0.99/credit, free 3 on signup), 1 credit per invoice chased.

## Stack

Next.js 15 App Router + Tailwind + shadcn-style UI, Clean Architecture
(`src/domain`, `src/application`, `src/infrastructure`, `src/presentation`; dependency rule inward).
Clerk auth (admin seeded via `ADMIN_EMAIL`). Convex backend
(`tenants`, `users`, `invoices`, `submissions`, `credits`, `vault`;
functions `credits:getBalance/getOrCreate/consume/addCredits`).
Stripe credit billing (100 credits $99, top-menu Buy Credits → Checkout → `/app?credits=added`).

## Setup

```bash
bash scripts/seed-env.sh
# prompts for NEXT_PUBLIC_CONVEX_URL, CONVEX_DEPLOYMENT,
# NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, CLERK_WEBHOOK_SECRET,
# STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET,
# STRIPE_PRICE_CREDITS, NEXT_PUBLIC_SITE_URL, ADMIN_EMAIL
# writes .env.local, runs convex codegen + build check
npm run dev
```

Seed usage: run the script once with keys pasted in; on later runs it reuses
existing env values as defaults (just press Enter). Verifies free-3 signup
credits via `credits:getOrCreate`.

## Flow

Register/login (Clerk) → 3 free credits → upload overdue CSV in `/app` →
validation table → 4-step chase preview (pre-due/due/+7/+14/+30) → chase
(1 credit/invoice) → vault + PDF/CSV export → Buy 100 ($99) when empty.
`/admin` (role=admin) shows submissions + credits log.
