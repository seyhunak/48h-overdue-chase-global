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

1. **Import invoices** — CSV upload or one-click Zoho Invoice import → validation in seconds
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
| Agent workflow | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) — 25 engineering skills + hallmark (spec-driven dev, replaces speckit) |

---

## Agent Skills (how AI agents work in this repo)

> SpecKit / `.specify` is **retired**. The single workflow is
> [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills),
> installed project-local via the `skills` CLI. See `AGENTS.md` for the full
> agent operating guide (intent → skill map, lifecycle, ClearDue invariants).

```bash
npx skills add addyosmani/agent-skills --all -y   # 25 skills → .agents/skills/
./scripts/sync-agent-skills.sh                    # re-link every agent dir
npx skills list                                   # verify (26: 25 pack + hallmark)
npx skills update -y && ./scripts/sync-agent-skills.sh   # refresh pack
```

- **Source of truth:** `.agents/skills/<name>/SKILL.md` (+ `skills-lock.json`).
  Never edit a skill in place — update via the CLI.
- **Every agent reads the same pack** via symlinks → `.agents/skills/`
  (26 skills: 25 pack + hallmark — full map in `AGENTS.md` §1):
  Claude Code (`.claude/skills/` + `.claude/commands/` for `/spec /plan /build
  /test /constraints /review /code-simplify /webperf /ship`), OpenCode
  (`.opencode/skills/` + `.opencode/commands/` + `AGENTS.md` intent table),
  Kilo Code (`.kilo-code/skills/` + `.kilocode-rules`), Cline
  (`.cline/skills/` + `.clinerules`), Roo Code (`.roo-code/skills/` +
  `.roo-code-rules`), Cursor (`.cursor/skills/` + `.cursor/rules/`),
  Copilot (`.github/skills/` as `/<skill-name>` + `copilot-instructions.md` +
  `.github/prompts/`).
- **Lifecycle:** full feature sequence `interview-me → idea-refine →
  spec-driven-development → planning-and-task-breakdown →
  context-engineering → incremental-implementation →
  test-driven-development → debugging-and-error-recovery →
  code-review-and-quality → git-workflow-and-versioning →
  shipping-and-launch` (bugfix shortcut: `debugging-and-error-recovery →
  test-driven-development → code-review-and-quality`) — skill first, even on
  1% match.
- **ClearDue invariants** (enforced inside every skill): human approval gate
  (sweep queues `pending_approval`, nothing sends without Approve + Send),
  1 credit/invoice, secrets never committed, `npx tsc --noEmit` + `npm run
  build` green.

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
git clone https://github.com/seyhunak/ClearDue.git
cd ClearDue

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
| `COMPOSIO_API_KEY` | [app.composio.dev](https://app.composio.dev) → API keys | (optional) server-wide Composio key |
| `ONESIGNAL_APP_ID` | OneSignal Dashboard → Settings → Keys & IDs | App ID (env fallback) |
| `ONESIGNAL_API_KEY` | OneSignal Dashboard → Settings → Keys & IDs → REST API Key | REST API Key (env fallback) |
| `ONESIGNAL_SMS_FROM` | OneSignal → Messaging → SMS | (optional) SMS sender number |
| `ONESIGNAL_EMAIL_TO` | (optional) | Fallback test recipient |
| `DEBUG_MODE` | `true` / `false` / unset | Verbose server logs. Default ON in dev, OFF in prod. See `src/infrastructure/flags.ts` |

> OneSignal is connected **per owner in `/connect` through Composio** (key + connected account live in that owner's Composio project). The `ONESIGNAL_*` vars above are the optional server-wide fallback and are not required when Composio is connected.

### 4. Run Locally

```bash
npm run dev
# → http://localhost:3000
```

### 5. OneSignal via Composio (`/connect`)

Notifications (email / SMS / push) send through the owner's own Composio →
OneSignal connection — no OneSignal key is stored in this app.

1. Sign in and open `/connect`.
2. Paste your **Composio API key** ([app.composio.dev](https://app.composio.dev) → API keys) and your
   **OneSignal App ID** ([app.onesignal.com](https://app.onesignal.com) → Settings → Keys & IDs), press **Save**.
3. Press **Connect OneSignal** — Composio hosts the sign-in where you supply your OneSignal REST API key
   (the `os_v…` key, **not** the App ID).
4. Press **Verify**; the badges turn green. Send a test below.
5. Keep exactly **1 working connection** — broken duplicates are listed with a **Remove** button
   (the probe marks the working one; only non-working ones are removable).

Missing an auth config? `/connect` creates the `onesignal_rest_api` one automatically.
Prefer server-wide keys? Set `ONESIGNAL_APP_ID` + `ONESIGNAL_API_KEY` and the send path falls
back to them when no working Composio connection exists.

---

## Features

### Workbench (`/app`)
- CSV upload or Zoho Invoice import with live validation (no sample data)
- Per-invoice 4-step follow-up preview
- **Approve + Send** (human gate) → OneSignal dispatch
- Vault + export tables, sweep decisions and sent history as tables (Channel/Status pills)
- Credit balance (1 credit/invoice, free 3 on signup)

### Reminder Dispatch (Section 5)
- Scheduler toggle (paused by default)
- **Intelligent sweep** — for each tracked invoice the engine decides from invoice data (amount, due date, phone/email), past actions (sent/failed channels, attempts) and the calendar whether to queue an **email**, queue an **SMS escalation** (high-value invoices ≥ $2,500 where email was already sent), or **do nothing** (paid, unsubscribed, 5-touch cap, touched today, duplicate, repeated send failures, or gentle steps falling on weekends)
- **Every decision is logged** — queue *and* do-nothing outcomes appear in the "Recent sweep decisions" feed with a human-readable reason
- **Run due sweep now** → queues decided steps as `pending_approval` (the sweep never sends)
- Pending queue with per-row **Email / SMS / Push selector** (persisted before approve, SMS uses the phone number), **Approve + Send** / **Skip**
- Channel shown per row and honored at send time (`recipientPhone` for SMS, `recipientEmail` otherwise)
- Success message shows recipient count + OneSignal notification ID; 0-recipient accepts warn explicitly
- Sent history table (Channel/Status pills) with **Retry** for failed rows (re-queues for approval, attempts preserved)
- Failed `not-connected` errors link to `/connect`

### Data (`/data`)
- Boundary map: live ladder gates per tracked invoice
- Step history per invoice with status chips
- Operator controls: Mark paid / Reopen / Unsubscribe / Resubscribe

### Connect (`/connect`)
- Composio → OneSignal connect flow (paste key + App ID → Connect → Verify)
- Status badges: Composio key, App ID, OneSignal connection, Email/SMS/Push readiness
- Connection list with **Remove** for broken duplicates (keep exactly 1 working)
- **Test send** per channel (vault-audited, no credit charge)

### Admin (`/admin`, `ADMIN_EMAIL` role)
- Revenue cards: total revenue (paid credits × $0.99) · credits used · outstanding · customers
- Spending by customer table (used, spend, balance pill, joined)
- Users table (role pills) and submissions table — all paginated 10/page

### Site pages
- `/product` (features, channels, ladder, pricing), `/about`, `/legal` hub, `/terms`, `/privacy`
- `/contact` embeds the Youform support form (`otblhnip`) — no hardcoded email addresses on site

---

## Architecture

```
src/
├── domain/           # Pure logic (invoices, chase sequence, CSV parsing)
├── application/      # Use cases (chaseInvoices)
├── infrastructure/   # Composio, OneSignal, Clerk, Convex, Stripe adapters
├── presentation/     # React components (Tally theme)
│   ├── connect-page.tsx       # Composio → OneSignal connect + test sends
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
| `settings` | Scheduler, send window, per-owner Composio key + OneSignal App ID |
| `submissions` | Tracked invoices (source for sweep) |
| `credits` | Balance, lifetimeAdded/Used |
| `vault` | Audit log (sent, test_send, PDF/CSV exports) |

**Channel union (email | sms | push | whatsapp | voice):** legacy `whatsapp/voice` kept for live data compat; new writes use `email|sms|push` only.

---

## Dispatch Flow

```
 Cron (09:05 UTC) → sweepOwner() → pending_approval rows
        ↓
 User: Approve + Send (per row, Email/SMS/Push selector persisted first)
        ↓
 POST /api/reminders/send → Composio OneSignal (top-level API shape) → env fallback
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

 # Unit tests (Vitest: src/domain + convex/sweepDecide, 30 tests)
 npm test

 # Convex push (dev/preview deployment)
 npx convex dev --once

 # Convex deploy (prod)
 npx convex deploy --yes
 ```

---

 ## Deploy

 ### VPS — $5/mo (1 vCPU / 1 GB), Docker + nginx

 No deploy has been run from this repo state — all hosting config is committed
 and idle until provisioned.

 ```bash
 # 1. One-time bootstrap on a FRESH Ubuntu 24.04 box (as root):
 sudo ./scripts/vps-setup.sh   # 2 GB swap + Docker + UFW (22/80/443) + nginx + certbot

 # 2. On the VPS: copy repo to /opt/cleardue, create .env.production (see .env.example),
 #    then start:
 docker compose --env-file .env.production up -d --build

 # 3. Install deploy/nginx-cleardue.conf (set YOUR_DOMAIN), then TLS:
 certbot --nginx -d YOUR_DOMAIN
 ```

 Notes: `next.config.ts` uses `output: "standalone"` for the slim runtime image;
 Node heap is capped at 768 MB and the container at 850 MB for the 1 GB box.
 `DEBUG_MODE` defaults OFF in production (see `src/infrastructure/flags.ts`).

 ### Convex deployments

 - Preview (what local dev points at): `npx convex dev --once`
 - Prod: `npx convex deploy --yes`

 **Human approval gate:** Production deploys require explicit approval in chat.

---

## File Structure (Key)

```
.
├── convex/
│   ├── schema.ts           # Tables, indexes, validators
│   ├── reminders.ts        # Mutations/queries + cron sweep (queue-only)
│   ├── sweepDecide.ts      # Intelligent sweep decision engine (pure, unit-testable)
│   └── crons.ts            # Daily 09:05 UTC sweep
├── src/
│   ├── domain/
│   │   └── invoices.ts     # Invoice type, validation, chase sequence
│   ├── application/
│   │   └── chaseInvoices.ts
 │   ├── infrastructure/
 │   │   ├── composio.ts     # Composio → OneSignal (top-level API shape) + account removal
 │   │   ├── notify.ts       # Dispatch: Composio first, env fallback on not-connected
 │   │   ├── onesignal.ts    # Direct OneSignal REST client (env fallback, recipients)
 │   │   ├── flags.ts        # Feature switches (DEBUG_MODE)
 │   │   ├── owner-settings.ts # Per-owner connect settings reader
 │   │   └── env.ts          # Runtime env access (no build-time throws)
│   ├── presentation/
│   │   ├── connect-page.tsx       # Composio → OneSignal connect + test
│   │   ├── reminders-section.tsx  # Dispatch queue UI
│   │   ├── workbench-page.tsx     # CSV → validate → preview
│   │   ├── data-page.tsx          # Boundary map + history
│   │   └── ...
│   ├── app/
│   │   ├── api/
│   │   │   ├── reminders/send/    # OneSignal dispatch
 │   │   │   ├── connect/
 │   │   │   │   ├── provider-status/    # live probe + per-account list
 │   │   │   │   ├── onesignal-account/  # DELETE broken duplicate connections
 │   │   │   │   ├── auth-url/      # One-click Composio authorize
 │   │   │   │   ├── verify/
 │   │   │   │   └── test-send/
 │   │   │   ├── checkout/          # Stripe credit pack
 │   │   │   └── webhooks/
 │   │   ├── connect/               # Composio → OneSignal connect page
 │   │   ├── data/                  # Boundary map
 │   │   ├── app/                   # Workbench
 │   │   ├── admin/                 # Admin panel (revenue, spending, users, submissions)
 │   │   ├── product/ legal/        # Product + legal hub pages
 │   │   ├── contact/               # Youform-embedded support form
 │   │   └── ...                    # Legal pages, landing
 │   └── middleware.ts         # Clerk protection for /app, /admin, /data
 ├── scripts/
 │   ├── seed-env.sh           # Prompts for keys → .env.local
 │   ├── vps-setup.sh          # Fresh-Ubuntu bootstrap (swap, Docker, UFW, nginx)
 │   └── sync-agent-skills.sh  # Re-link all agent skills dirs → .agents/skills
 ├── .agents/skills/           # Canonical skill pack (25 agent-skills + hallmark)
 ├── .claude/skills/ .opencode/skills/ .kilo-code/skills/ .cline/skills/
 │   .cursor/skills/ .github/skills/ .roo-code/skills/  # symlinks → .agents/skills
 ├── AGENTS.md                 # Agent operating guide (intent → skill map)
 ├── .claude/commands/         # /spec /plan /build /test /constraints /review /code-simplify /webperf /ship
 ├── .opencode/commands/       # spec/plan/build/test/review/ship (skill invokers)
 ├── .cursor/rules/ .clinerules .kilocode-rules .roo-code-rules
 │   .github/copilot-instructions.md .github/prompts/  # per-agent routers
 ├── deploy/
 │   └── nginx-cleardue.conf   # Reverse-proxy site config
 ├── Dockerfile                # Standalone prod image (1 GB VPS tuned)
 ├── docker-compose.yml        # Prod compose (127.0.0.1:3000, mem limits)
 ├── .env.example              # Env template (incl. DEBUG_MODE)
 ├── README.md
 └── package.json
 ```

---

## License

MIT — use freely, modify, distribute. No warranty.