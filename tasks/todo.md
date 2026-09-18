# Todo: Per-Owner SMS Escalation Controls

## Task 1: settings schema fields + codegen
**Description:** Add optional `smsEnabled` (boolean) and `smsThresholdUsd`
(number) to the `settings` table in `convex/schema.ts`; run codegen.
**Acceptance criteria:**
- [x] `settings` has `smsEnabled: v.optional(v.boolean())`,
  `smsThresholdUsd: v.optional(v.number())`
- [x] No existing fields/validators changed; no migration needed
**Verification:**
- [x] `npx convex codegen` succeeds with no type errors
- [x] `npx tsc --noEmit` passes
**Dependencies:** None
**Files likely touched:**
- `convex/schema.ts`
**Estimated scope:** Small (1 file)

## Task 2: engine SmsConfig + gate 6a/6b (TDD)
**Description:** Add `SmsConfig { enabled?, thresholdUsd? }` + normalizer to
`convex/sweepDecide.ts`; split gate 6 (disabled → skip SMS with suppression
detail; enabled → owner threshold). Failing tests first.
**Acceptance criteria:**
- [ ] `decideSweepAction(input & { sms? })`; `undefined` sms = enabled/2500
- [ ] Disabled on SMS-eligible invoice → queue/email with detail mentioning disabled
- [ ] threshold 500 escalates $600; threshold 5000 does NOT escalate $3000
- [ ] NaN/negative/>1M → fallback 2500; all old tests still pass
**Verification:**
- [ ] `npm test` — new + existing `sweepDecide` cases green
**Dependencies:** Task 1 (conceptual only; engine compiles standalone)
**Files likely touched:**
- `convex/sweepDecide.ts`
- `convex/sweepDecide.test.ts`
**Estimated scope:** Medium (2 files)

## Checkpoint: Foundation
- [ ] All tests pass (`npm test`)
- [ ] Codegen clean, types green
- [ ] Review with human before wiring

## Task 3: sweepOwner passes owner SMS config
**Description:** In `sweepOwner` (`convex/reminders.ts`), read
`smsEnabled`/`smsThresholdUsd` from settings once per sweep and pass
`{ sms: { enabled, thresholdUsd } }` into every `decideSweepAction` call.
**Acceptance criteria:**
- [ ] Settings read once (no per-invoice query); `undefined` passes through
  (engine defaults apply)
- [ ] Suppression reasons land in `decisions` rows unchanged in shape
- [ ] Per-channel dedupe (email/SMS once per step) still holds
**Verification:**
- [ ] `npx tsc --noEmit` passes
- [ ] Manual: fixture sweep with toggle OFF → decisions show email + detail
**Dependencies:** Task 2
**Files likely touched:**
- `convex/reminders.ts`
**Estimated scope:** Small (1 file)

## Task 4: saveSmsSettings mutation + status exposure
**Description:** Add `saveSmsSettings({ ownerClerkId, smsEnabled: boolean,
smsThresholdUsd: number })` mutation with strict validation (boolean +
integer 0–1000000); expose both fields in `getComposioStatus`.
**Acceptance criteria:**
- [ ] Non-boolean / non-integer / out-of-range → throw, nothing written
- [ ] Patch path (existing row) + insert path (new row with defaults for
  scheduler/sendWindow) both work
- [ ] Status query returns `smsEnabled` (default true) + `smsThresholdUsd`
  (default 2500) with no secrets leaked
**Verification:**
- [ ] `npx tsc --noEmit` passes
- [ ] Manual: Convex dashboard run of mutation (valid + invalid args)
**Dependencies:** Task 1
**Files likely touched:**
- `convex/reminders.ts`
**Estimated scope:** Small (1 file)

## Checkpoint: Wiring
- [ ] Types green; manual sweep shows suppression reasons in decisions feed
- [ ] Mutation rejects invalid input; review with human before UI

## Task 5: /connect SMS escalation card
**Description:** New card in `src/presentation/connect-page.tsx`: toggle
(checkbox/switch) + threshold number input, wired to `saveSmsSettings` +
status query; Tally theme styling; inline validation errors.
**Acceptance criteria:**
- [ ] Toggle + threshold prefilled from status query (defaults enabled/2500)
- [ ] Invalid input (empty/negative/>1000000/non-integer) blocked inline,
  never sent to mutation
- [ ] Save success/failure message shown; Clerk-gated like sibling cards
**Verification:**
- [ ] Manual: toggle OFF → save → reload persists; `npm run build` green
- [ ] No `.env.local` / key exposure; styling matches Tally tokens
**Dependencies:** Task 4
**Files likely touched:**
- `src/presentation/connect-page.tsx`
**Estimated scope:** Medium (1–2 files)

## Task 6: end-to-end verification + docs
**Description:** Fixture sweep (high-value invoice, email sent for +14):
toggle OFF → 0 SMS queued; threshold 5000 → $3000 queues email; second sweep
→ queued 0. Update HANDOFF known-limitations line; run full gates.
**Acceptance criteria:**
- [ ] All 6 spec success criteria demonstrably met
- [ ] `npm test`, `npx tsc --noEmit`, `npm run build` all green
- [ ] HANDOFF "no per-owner toggle" line updated/removed
**Verification:**
- [ ] Tests pass; build succeeds; fixture sweep log pasted in review
- [ ] Human approves before merge/ship
**Dependencies:** Tasks 1–5
**Files likely touched:**
- `HANDOFF.md`
**Estimated scope:** Small (1 file + verification)

## Checkpoint: Complete
- [ ] All acceptance criteria met
- [ ] Ready for review (`code-review-and-quality`) then ship
