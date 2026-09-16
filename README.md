# ClearDue — Overdue Invoice Follow-Up for Service Firms

[![Deploy Status](https://img.shields.io/badge/deploy-preview%20only-blue)]()
[![Build](https://img.shields.io/badge/build-passing-brightgreen)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()
[![Stage](https://img.shields.io/badge/stage-active%20development-yellow)]()
[![Stack](https://img.shields.io/badge/stack-Next.js%2015%20%7C%20Convex%20%7C%20OneSignal%20%7C%20Clerk%20%7C%20Stripe-61DAFB?logo=next.js)]()

---

## Problem

Founders at 5–50 person service firms spend **5–15 hours/week** manually following up on overdue invoices while **$10–20k cash sits locked 30+ days** on average.

- 59% of SMBs have invoices 30+ days overdue (QuickBooks 2026)
- 71% paid within 2 weeks with automation vs 47% manual (ChaserHQ)
- Manual follow-up costs ~$15–24k/year in hidden labor

## Solution

ClearDue is a **48-hour fix-pack** Web SaaS that turns manual follow-up into an approved, audited workflow:

1. **Upload CSV** (or paste) of overdue invoices → validation in seconds
2. **Preview 4-step sequence** per invoice (pre-due → due → +7 → +14 → +30)
3. **Human approval gate** — nothing sends without your click
4. **OneSignal delivery** (email / SMS / push) with audit trail
5. **Vault log** + PDF/CSV export for your accountant

**Price:** $99 = 100 credits ($0.99/credit, free 3 on signup), 1 credit per invoice followed up.

---

## Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 App Router + TypeScript |
| Auth | Clerk (org-ready, admin role seeded) |
| Backend | Convex (real-time, serverless) |
| Notifications | OneSignal (email / SMS / push) |
| Billing | Stripe (credit-based, $99/100 credits) |
| Styling | Tailwind + Hallmark (Tally theme) |
| Architecture | Clean Architecture (domain/application/infrastructure/presentation) |

---

## Quick Start

### 1. Prerequisites

- Node.js 18+
- Clerk account (for auth)
- Convex account (for backend)
- Stripe account (for billing)
- OneSignal account (for notifications)

### 2. Install & Configure

```bash
# Clone
git clone https://github.com/seyhunak/48h-overdue-chase-global.git
cd 48h-overdue-chase-global

# Install
npm install

# Run seed script (prompts for all keys)
bash scripts/seed-env.sh
```

### 3. Required Environment Variables

| Variable | Source | Description |
|----------|--------|-------------|
| `NEXT_PUBLIC_CONVEX_URL` | Convex Dashboard → Settings | e.g. `https://xxx.convex.cloud` |
| `CONVEX_DEPLOYMENT` | Convex Dashboard → Settings | e.g. `dev:project-name` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard → API Keys | `pk_test_...` |
| `CLERK_SECRET_KEY` | Clerk Dashboard → API Keys | `sk_test_...` |
| `CLERK_WEBHOOK_SECRET` | Clerk Dashboard → Webhooks | `whsec_...` |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → API Keys | `sk_test_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard → API Keys | `pk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks | `whsec_...` (via `stripe listen`) |
| `STRIPE_PRICE_CREDITS` | Stripe Dashboard → Products | `price_...` or omit for auto `$99` |
| `NEXT_PUBLIC_SITE_URL` | Local: `http://localhost:3000` | Production URL for webhooks |
| `ADMIN_EMAIL` | Your email | Seeds admin user on first run |
| `ONESIGNAL_APP_ID` | OneSignal Dashboard → Settings → Keys & IDs | App ID |
| `ONESIGNAL_API_KEY` | OneSignal Dashboard → Settings → Keys & IDs → REST API Key | REST API Key |
| `ONESIGNAL_EMAIL_FROM` | OneSignal → Settings → Email | Verified sender email |
| `ONESIGNAL_SMS_FROM` | OneSignal → Messaging → SMS | (optional) SMS sender number |
| `ONESIGNAL_EMAIL_TO` | (optional) | Fallback test recipient |

### 4. Run Locally

```bash
npm run dev
# → http://localhost:3000
```

### 5. OneSignal Setup

1. Create app at [app.onesignal.com](https://app.onesignal.com)
2. **Keys & IDs** → copy App ID + REST API Key
3. **Settings → Email** → add & verify sender → copy as `ONESIGNAL_EMAIL_FROM`
4. (Optional) **Messaging → SMS** → add sender number → copy as `ONESIGNAL_SMS_FROM`
5. Add all keys to `.env.local`, restart server

---

## Features

### Workbench (`/app`)
- CSV upload / paste with live validation
- Per-invoice 4-step follow-up preview
- **Approve + Send** (human gate) → OneSignal dispatch
- Vault log with PDF/CSV export
- Credit balance (1 credit/invoice, free 3 on signup)

### Reminder Dispatch (Section 5)
- Scheduler toggle (paused by default)
- **Run due sweep now** → queues due steps as `pending_approval`
- Pending queue with **Approve + Send** / **Skip** per row
- Channel selector per row: **email / sms / push**
- Sent history with status, attempts, errors

### Data (`/data`)
- Boundary map: live ladder gates per tracked invoice
- Step history per invoice with status chips
- Operator controls: Mark paid / Reopen / Unsubscribe / Resubscribe

### Connect (`/connect`)
- OneSignal provider setup guide
- Channel status badges (email / SMS / push)
- **Test send** per channel (vault-audited, no credit charge)

### Admin (`/admin`)
- Submissions table (all owners)
- Credits log

---

## Architecture

```
src/
├── domain/           # Pure logic (invoices, chase sequence, CSV parsing)
├── application/      # Use cases (chaseInvoices)
├── infrastructure/   # OneSignal, Clerk, Convex, Stripe adapters
├── presentation/     # React components (Tally theme)
│   ├── connect-page.tsx       # OneSignal setup + test sends
│   ├── reminders-section.tsx  # Dispatch queue + approval
│   ├── workbench-page.tsx     # CSV → preview → approve
│   ├── data-page.tsx          # Boundary map + history
│   └── ...
├── app/              # Next.js App Router pages + API routes
└── convex/           # Convex schema, mutations, queries, cron
```

**Clean Architecture rule:** dependencies point inward; presentation only consumes tokens from `src/presentation/tokens.css`.

---

## Convex Schema (Key Tables)

| Table | Purpose |
|-------|---------|
| `reminders` | Queued steps (status: pending_approved/sent/skipped/failed) |
| `invoiceState` | Per-invoice touches, paid, unsubscribed, lastTouchAt |
| `settings` | Scheduler, send window, (dormant) Composio fields |
| `submissions` | Tracked invoices (source for sweep) |
| `credits` | Balance, lifetimeAdded/Used |
| `vault` | Audit log (sent, test_send, PDF/CSV exports) |

**Channel union (email | sms | push | whatsapp | voice):** legacy `whatsapp/voice` kept for live data compat; new writes use `email|sms|push` only.

---

## Dispatch Flow

```
Cron (09:05 UTC) → sweepOwner() → pending_approval rows
       ↓
User: Approve + Send (per row, channel selector)
       ↓
POST /api/reminders/send → OneSignal (email/sms/push)
       ↓
markSent → vault log (timestamp + payloadHash + channel)
       ↓
invoiceState.touches + 1, lastTouchAt updated
```

**Policy (enforced in sweep):**
- Max 1 touch/invoice/day (UTC)
- Max 5 touches/invoice lifetime
- Send window 09:00–18:00 UTC
- Skip paid / unsubscribed / already touched today / duplicate step

---

## Billing

- **Credit model:** 1 credit per invoice followed up
- **Pack:** 100 credits = $99 ($0.99/credit)
- **Free tier:** 3 credits on signup
- **Stripe Checkout** → webhook → Convex `addCredits` → live balance update
- **No auto-renewal** — buy packs as needed

---

## Development

```bash
# Typecheck
npx tsc --noEmit

# Build
npm run build

# Lint
npm run lint

# Convex push (dev)
npx convex dev --once --typecheck disable

# Convex deploy (preview)
npx convex deploy --preview-name 48h-app
```

---

## Deploy

### Preview (Convex + Vercel)

```bash
# Convex preview deploy
npx convex deploy --preview-name 48h-app

# Vercel preview deploy (connect repo)
vercel
```

### Production (requires `deploy:approve`)

```bash
# Convex prod
npx convex deploy --yes

# Vercel prod
vercel --prod
```

**Human approval gate:** Production deploys require explicit `deploy:approve` confirmation in chat.

---

## File Structure (Key)

```
.
├── convex/
│   ├── schema.ts           # Tables, indexes, validators
│   ├── reminders.ts        # Mutations/queries + cron sweep
│   └── crons.ts            # Daily 09:05 UTC sweep
├── src/
│   ├── domain/
│   │   └── invoices.ts     # Invoice type, validation, chase sequence
│   ├── application/
│   │   └── chaseInvoices.ts
│   ├── infrastructure/
│   │   ├── onesignal.ts    # OneSignal REST client (server-only)
│   │   └── env.ts          # Runtime env access (no build-time throws)
│   ├── presentation/
│   │   ├── connect-page.tsx       # OneSignal setup + test
│   │   ├── reminders-section.tsx  # Dispatch queue UI
│   │   ├── workbench-page.tsx     # CSV → validate → preview
│   │   ├── data-page.tsx          # Boundary map + history
│   │   └── ...
│   ├── app/
│   │   ├── api/
│   │   │   ├── reminders/send/    # OneSignal dispatch
│   │   │   ├── connect/
│   │   │   │   ├── provider-status/
│   │   │   │   └── test-send/
│   │   │   ├── checkout/          # Stripe credit pack
│   │   │   └── webhooks/
│   │   ├── connect/               # OneSignal setup page
│   │   ├── data/                  # Boundary map
│   │   ├── app/                   # Workbench
│   │   ├── admin/                 # Admin panel
│   │   └── ...                    # Legal pages, landing
│   └── middleware.ts         # Clerk protection for /app, /admin, /data
├── scripts/
│   └── seed-env.sh           # Prompts for keys → .env.local
├── README.md
└── package.json
```

---

## License

MIT — use freely, modify, distribute. No warranty.