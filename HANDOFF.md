# Handoff — ClearDue (48h-overdue-chase-global)

**Date:** 2026-09-16 · **Branch:** `main` · **Latest verified state:** `tsc` clean, `next build` passing, Convex preview deployed (`amicable-penguin-704`).

## What this is

Web SaaS that turns manual overdue-invoice follow-up into an approved, audited workflow:
CSV upload → credit-charged chase → intelligent daily sweep → **human approval per message** → OneSignal delivery (via the owner's own Composio connection) → vault audit log.

**Non-negotiable invariant:** the system NEVER sends anything without an explicit human "Approve + Send" click. The sweep only creates `pending_approval` rows.

## Architecture (key paths)

| Path | Role |
|---|---|
| `convex/sweepDecide.ts` | Pure decision engine: per invoice decides queue email / queue SMS / do nothing, from invoice data + past actions + calendar. Unit-testable (no Convex imports). |
| `convex/reminders.ts` | Sweep (`sweepOwner`, cron + manual), pending queue, approve/skip/send-history, decision audit log (`listDecisions`), settings. |
| `convex/schema.ts` | Tables: `submissions` (tracked invoices, has optional `phone`), `reminders` (`channel`, `recipientPhone`, `recipientEmail`), `decisions` (audit), `invoiceState`, `settings`, `credits`, `vault`. |
| `src/app/api/reminders/send/route.ts` | Only send path. Requires `approved` status; recipient priority: `to` param → reminder's `recipientPhone` (SMS) / `recipientEmail` → env fallback. |
| `src/infrastructure/composio.ts` | OneSignal dispatch via Composio. `pickWorkingOneSignalAccount()` probes every ACTIVE connection and uses one that actually works (a broken ACTIVE account no longer blocks sends). `OneSignalAuthError` for 401-class failures. |
| `src/presentation/reminders-section.tsx` | /app dispatch UI: scheduler toggle, sweep button, pending queue (Approve + Send / Skip), "Recent sweep decisions" feed, sent history. |

## Intelligent sweep — how it decides

Gate order (first match wins), all mirrored from historical safety rules:

1. Invalid dueDate → do nothing
2. No ladder step due (before pre-due window) → do nothing
3. Paid / unsubscribed → do nothing
4. 5 lifetime touches → ladder complete
5. Already touched today → resume tomorrow
6. **SMS escalation check first** (high-value ≥ $2,500, step in +7/+14/+30, email already sent for that step, valid E.164 phone): queue SMS unless one is already queued for the step
7. Email already queued for the step → duplicate, do nothing (dedupe is **per channel**: email and SMS can each queue once per step)
8. Latest failed reminder with 401-class error → paused (reconnect in /connect)
9. Latest failed reminder with ≥3 attempts → paused (manual attention)
10. pre-due/due step falling on a weekend → soft-defer to Monday (+7/+14/+30 escalate anyway)
11. Default: queue email (needs a recipient email on the invoice)

Every outcome (queue **and** do-nothing) is written to the `decisions` table and shown in the /app feed with the reason.

**SMS copy** lives in `buildSmsCopy()` (convex/reminders.ts): short, urgent, with "Reply STOP to opt out".

## Live-verified (against preview deployment)

- Seeded 3 test invoices → sweep queued 3 emails with correct decisions (`queue/email`, recipients + subjects correct)
- Second sweep → `queued: 0`, all three correctly reported `duplicate step … — email already queued`
- All 15 engine scenarios passed (`pre-due` queue, paid, unsubscribed, cap, daily cap, duplicate, weekend defer, escalation-on-weekend, no-email, 401 pause, attempts pause, SMS escalation, SMS dedupe, email-deduped-still-SMS, no-phone fallback, under-threshold)
- OneSignal send path verified earlier: broken ACTIVE connection auto-skipped, working connection `ca_-bTZbobEPHDt` used; expired connection returns a clear error message
- All test data purged from the preview deployment; temporary purge function removed

## Setup / operations

- `/connect` (owner): save Composio API key + OneSignal App ID → Connect (Composio-hosted auth) → Verify (live credential probe). **The REST API key is entered in Composio's hosted auth, never in this app.**
- `/app`: CSV (now with optional `phone` column; sample CSV includes it) → Follow up (1 credit/invoice) → sweep → approve.
- Cron: daily 09:05 UTC sweep, only for owners with scheduler enabled. Manual "Run due sweep now" always available.
- Reconnect guidance: if OneSignal returns 401, the stored key is wrong — reconnect with a **REST API key** (`os_v…` from Settings → Keys & IDs), not the App ID.

## Secrets policy

- `.env.local` holds `ONESIGNAL_API_KEY` (`os_v…`) + `ONESIGNAL_APP_ID` for server-wide **debug/fallback only**; it is gitignored (verified `git check-ignore`) and must never be committed or pushed.
- Owner-scoped Composio keys live in the Convex `settings` table (server-side only, never returned to the client).
- Known cleanup item: Composio connection `ca_prjWMFJu2lDd` holds an App ID instead of a REST key. Non-blocking (failover skips it); delete or re-auth it in the Composio dashboard.

## Known limitations / next steps

- `decisions` table grows unbounded (feed shows newest N; consider pruning later).
- SMS requires the OneSignal app to have SMS enabled + `ONESIGNAL_SMS_FROM` or OneSignal-side sender configured; recipient must be E.164 in the CSV `phone` column.
- The `/data` page's ladder gates don't yet surface the decision engine's weekend/attempt-pause reasoning (only in the /app decisions feed).
- Cron sweep honors `schedulerEnabled`; there is no per-owner "pause SMS escalation" toggle yet (threshold constant `ESCALATE_SMS_AMOUNT_USD = 2500` in `convex/sweepDecide.ts`).
