# Spec: Per-Owner SMS Escalation Controls (toggle + threshold)

## Objective
Give each owner control over SMS escalation in the intelligent sweep.
Today `convex/sweepDecide.ts` hardcodes `ESCALATE_SMS_AMOUNT_USD = 2500` with
no opt-out (HANDOFF.md notes "no per-owner pause SMS escalation toggle yet").
Owners without SMS enabled still get SMS queued for approval (noise); owners
with different risk tolerance cannot tune the threshold.

User stories:
- As an owner without SMS, I turn SMS escalation OFF so the sweep only queues
  email (SMS gate never fires, reason recorded).
- As an owner, I raise/lower the threshold (e.g. $5000 / $500) to control
  which invoices escalate.
- As an approver, I see every suppression in the /app decisions feed.

Success = sweep respects per-owner settings; defaults preserve current
behavior; approval gate + credit model unchanged.

## Tech Stack
Next.js 15 App Router + TypeScript, Convex serverless, Clerk auth,
Tailwind + Hallmark Tally theme. No new dependencies.

## Commands
Build: `npm run build`
Types: `npx tsc --noEmit`
Tests: `npm test` (vitest — `convex/sweepDecide.test.ts`, `src/domain/invoices.test.ts`)
Dev: `npm run dev`
Convex codegen after schema change: `npx convex codegen`

## Project Structure
- `convex/schema.ts` -> `settings`: add `smsEnabled?`, `smsThresholdUsd?`
- `convex/sweepDecide.ts` -> pure engine accepts per-owner SMS config
- `convex/sweepDecide.test.ts` -> new cases (toggle OFF, custom threshold)
- `convex/reminders.ts` -> `sweepOwner()` passes config; new
  `saveSmsSettings` mutation; settings query exposes fields; `getBoundaryMap`
  mirrors suppression reasons
- `src/presentation/connect-page.tsx` -> toggle + threshold input
- `src/presentation/workbench-page.tsx` -> no structural change (reasons flow
  via existing `decisions` feed)

<!--PART2-->

## Code Style
Keep `domain/` pure; keep `sweepDecide.ts` pure (no Convex imports).
Intended engine change:

```ts
export type SmsConfig = {
  enabled?: boolean;      // default true (current behavior)
  thresholdUsd?: number;  // default ESCALATE_SMS_AMOUNT_USD (2500)
};

export function decideSweepAction(
  input: SweepDecisionInput & { sms?: SmsConfig }
): SweepDecision { /* SMS gate checks enabled + threshold first */ }
```

Validation (mirror existing): threshold finite, clamped [0, 1000000];
invalid values fall back to 2500, never throw inside sweep. Toggle strict
boolean; `undefined` (pre-migration rows) = enabled.

## Testing Strategy
Framework: vitest. Pure engine unit-tested; Convex wiring via manual sweep.
- Unit: toggle OFF on SMS-eligible invoice -> queue/email (not SMS) with
  detail "SMS escalation disabled"; threshold 500 escalates $600; threshold
  5000 does NOT escalate $3000; NaN/negative -> fallback 2500; disabled +
  no email -> existing "no recipient email" reason.
- Manual: toggle OFF -> sweep high-value fixture -> decisions feed shows
  queue/email; second sweep -> queued: 0 (idempotency preserved).
- Gates: `npx tsc --noEmit` + `npm run build` green. No credit change
  (settings edits are free; 1 credit/invoice unchanged).

## Boundaries
- Always: approval gate (sweep creates ONLY pending_approval; NOTHING sends
  without Approve + Send); validate threshold server-side + client-side;
  record suppressions in `decisions`; run tsc + build before done.
- Ask first: additive `settings` schema change; new mutation/query names;
  UI placement (proposed: /connect SMS card).
- Never: bypass sends; spend/refund credits for settings; expose keys
  client-side; remove ESCALATE_SMS_AMOUNT_USD default semantics;
  commit `.env.local`.

## Success Criteria
1. `settings` gains optional `smsEnabled`, `smsThresholdUsd`; old rows
   behave as enabled/2500.
2. Engine: disabled -> email not SMS (detail mentions disabled);
   threshold 5000 -> $3000 invoice queues email.
3. `sweepOwner` passes owner settings through; per-channel dedupe holds.
4. UI toggle + threshold input; invalid input rejected inline, never written.
5. Decisions feed shows suppressions; zero SMS rows queued while OFF.
6. `npm test`, `tsc`, `build` all green.

## Convex tables touched
- `settings` (schema + read): add `smsEnabled?`, `smsThresholdUsd?`.
- `decisions` (reason/detail strings only): new suppression reasons.
- `reminders` (no schema change): fewer sms rows when OFF/threshold high.

## Gate-order impact
Gate 6 becomes: 6a. SMS disabled -> skip SMS gate (fall to email dedupe).
6b. SMS enabled + amount >= owner threshold (USD-equiv, EUR/GBP x1.1) +
step in {+7,+14,+30} + email sent + valid E.164 -> queue SMS unless queued.
All other gates unchanged.

## Decisions (approved 2026-09-18)
1. UI: new "SMS escalation" card in `/connect` (toggle + threshold input).
2. Defaults: new owners enabled/2500; pre-migration rows (undefined) = enabled/2500.
3. Range: 0–1000000 integers; 0 = escalate everything eligible.
4. Suppressions surface in the sweep decisions feed only (no getBoundaryMap change).

