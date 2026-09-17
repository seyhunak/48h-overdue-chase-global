# Handoff — ClearDue (48h-overdue-chase-global)

**Date:** 2026-09-17 · **Branch:** `main` · **Latest verified state:** `tsc` clean, `next build` passing. Prior state (2026-09-16): Convex preview deployed (`amicable-penguin-704`).

## NEW (2026-09-17): Zoho Invoice import via Composio — alternative to CSV upload

- `src/infrastructure/composio.ts` — Zoho toolkit (`zoho_invoice`, Composio-managed OAuth2): `listZohoConnections()`, `pickZohoAccount()`, `createZohoConnectLink()` (hosted auth, requires the toolkit's auth config to exist in the Composio project), `listToolkitTools()` (runtime tool discovery via GET /tools), `fetchZohoInvoices()` (read-only invoice pull, normalizes into domain `Invoice`; filters paid/void/draft).
- `POST /api/connect/zoho-auth-url` (connect link) + `GET` (Zoho status probe); `POST /api/invoices/zoho-import` (pull invoices → returns rows shaped like the CSV; writes a `zoho_import` vault audit entry).
- Workbench: "Import from Zoho Invoice" button fills the CSV textarea — validation, credits (1/invoice), chase preview, sweep, and the human approval gate are all **unchanged**; the invariant (nothing sends without explicit approval) is preserved.
- /connect: Zoho card — org ID field (`settings.zohoOrgId`, `saveZohoOrgId` mutation), "Connect Zoho", "Check Zoho connection".
- Limitations: Zoho fetch tool slug is discovered at runtime with known-name candidates (fetch-all-invoices style); org ID is optional (single-org). First-time owners may need to add the Zoho Invoice toolkit once at app.composio.dev. Not yet live-verified against a real Zoho account (OAuth connect + one import pending).
- FIX (2026-09-17 later): "no invoice fetch tool found" error at /app despite a connected account at /connect. Root cause: the tool-name heuristic was too narrow (missed `..._GET_INVOICES`-style slugs). Now: (1) `resolveZohoFetchTool` broadens the verb match and ranks candidates (`scoreZohoToolName` prefers list tools, penalizes writes/single-getters); (2) `listToolkitTools` tries both `toolkits=` and `toolkit_slug=` query variants across v3.1/v3 bases; (3) if NO matching tool is discovered, import falls back to Composio **proxy execute** (`POST /tools/execute/proxy`) hitting Zoho's real `books/v3/invoices` endpoint across region hosts (com/eu/in/com.au/jp) with the org_id query — token is injected server-side, so a missing/renamed predefined tool can never block an import. Result `tool` field reports `"proxy:/invoices"` when the fallback ran.
- FIX 2 (same day): (a) "GET and HEAD requests cannot have body" during Zoho import — the proxy fallback sent `body: {}` on a GET; now the proxy call carries no body and passes `organization_id` via `parameters` (`in: "query"`) + URL query string. Tool execution failures now ALSO fall through to the proxy (previously only a missing tool did). (b) /connect Provider status redesigned: one compact badge row — Composio, OneSignal, Zoho, Email/SMS/Push — driven by `GET /api/connect/provider-status` which now live-probes Zoho connected accounts too (`zoho: { connected, pendingAccounts, activeAccounts, orgIdConfigured, error }`), with a single contextual hint line instead of multiple stacked paragraphs.
- FIX 6 (same day): user reports "Validation error while processing request" + "shows 4 connections, should be only 1, don't ask which authorized connection".
- FIX 7 (same day): `ArgumentValidationError: ... extra field zohoAccountId ... Validator: v.object({ownerClerkId, zohoOrgId})` with object `{ownerClerkId, zohoAccountId: "ca_YikDpr1Su3hp", zohoOrgId: "938519233"}`. Root cause: local file had the 3-arg mutation but the deployment never received it — `npx convex dev --once` said "ready" yet function-spec still showed 2 args (stale bundle). Fix: `npx convex codegen` (re-bundled + uploaded; function-spec now confirms `[ownerClerkId, zohoAccountId, zohoOrgId]`) then `npx convex deploy --yes` to prod. Client restored to org+pin save (pin best-effort via provider-status zoho.accountId). ALREADY TRUE in DB: preview settings row has `zohoOrgId: "938519233"` — the org save itself succeeded; only the pin arg errored. Next: reload /connect, press save once more to pin `ca_YikDpr1Su3hp`, then retry import in /app.
- FIX 8 (same day, CLI-validated): "Validation error while processing request" on Import. CLI reproduction against live Composio (key from Convex settings) proved the exact contract: `POST v3.1/tools/execute/ZOHO_INVOICE_LIST_INVOICES` with `{connected_account_id, user_id: "default", arguments: {organization_id: "938519233", per_page, page}}` → 200 successful:true. Three app bugs fixed: (a) discovery read human `name` not `slug` ("Calculate BMI" etc.) and default page is 20 tools — now reads `slug` first + `limit=100`; (b) execution posted through the v3/v3.1 ladder with `{}` args — v3 answers "Invalid URL Passed" and empty args trigger Composio's validation error; now executes on v3.1 only with `{organization_id (required), per_page: 100, page: 1}` and throws a clear "save org ID first" when org is missing; (c) `ZOHO_LIST_INVOICES_TOOL` constant wins outright when discovered. CLI also revealed ground truth: org 938519233 holds exactly 2 invoices (INV-000001 $12, INV-000002 $13, both `status: draft`) — so the next import will truthfully report "pull worked, all DRAFT, Mark as Sent in Zoho then re-import" instead of a misleading error; the workbench now has that dedicated all-drafts message. Committed + pushed as 5278465.
- FIX 3 (same day): Composio proxy rejected the fallback with "Proxy execute requires either connected_account_id or custom_connection_data" — the payload used camelCase `connectedAccountId`. `proxyZohoInvoices` now sends `connected_account_id` (documented snake_case) first and retries with the legacy camelCase field; a field-name rejection short-circuits the region loop since it fails identically on every host.
- FIX 4 (same day): "Zoho returned no invoices" with 3 active Zoho connections. Causes: (a) proxy `data` sometimes arrives as a JSON-encoded string — now JSON.parsed before row extraction; (b) `normalizeZohoInvoice` whitelisted only unpaid/overdue/partially_paid/pending so Zoho's normal open statuses (sent/viewed/approved) were skipped — now only paid/void/draft/cancelled/credited are filtered and `balance` is preferred over `total`; (c) workbench `skippedCount` rename left a stale reference — fixed to `skipped.length`, and the empty-result message now shows top skip reasons (e.g. "skipped (status paid) ×5") instead of a generic org hint.
- FIX 5 (same day): `Could not find public function for 'reminders:saveZohoOrgId'` when saving org ID 938519233. Root cause is a deployment sync issue, not code: `saveZohoOrgId` + `zohoOrgId` schema field exist in `convex/reminders.ts`/`convex/schema.ts` (preview AND prod function-spec both list `reminders.js:saveZohoOrgId`) but `convex/_generated/` is gitignored, so the deployed Vercel frontend must be on a build older than the Convex push (`npx convex deploy` pushed to prod charming-bloodhound-87). Fix: `handleZohoSaveOrg` now detects the missing function pre-call and on error, surfaces a clear "redeploy Convex + web app" message, and refreshes provider status after save. ALSO: `npx convex deploy` was run (prod migrated: explicit settings.by_owner etc. indexes added). Next step: redeploy the web app (Vercel) so its bundled `api` codegen matches the deployed Convex functions, then save org ID 938519233 in /connect and retry import.

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
