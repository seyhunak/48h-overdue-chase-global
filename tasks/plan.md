# Implementation Plan: Per-Owner SMS Escalation Controls

## Overview
Add per-owner SMS toggle + threshold (0–1000000, default enabled/2500) to the
intelligent sweep. Sweep gate 6 splits into 6a (disabled → skip SMS) / 6b
(enabled + owner threshold). Spec: `SPEC-sms-controls.md`. Approval gate,
credit model, and per-channel dedupe are unchanged.

## Architecture Decisions
- `SmsConfig` is an optional `sms?:` field on `decideSweepAction` input —
  additive, all existing callers/tests keep passing with default behavior.
- Threshold normalization lives in `sweepDecide.ts` (pure): finite number in
  [0, 1000000] else fallback to `ESCALATE_SMS_AMOUNT_USD`; sweep never throws
  on bad config (defensive, mirrors 401/attempts guards).
- `settings` fields are optional (`smsEnabled?`, `smsThresholdUsd?`);
  `undefined` = enabled/2500, so no data migration. `saveSmsSettings`
  validates strictly server-side (boolean + integer range).
- UI lives in `/connect` SMS card (approved decision); suppressions surface
  in decisions feed only — no `getBoundaryMap` change.
- `ESCALATE_SMS_AMOUNT_USD` stays as the default constant (never removed).

## Dependency Graph
schema (settings fields)
 └─→ engine (SmsConfig + gate 6a/6b)
      ├─→ unit tests (sweepDecide.test.ts)
      └─→ sweepOwner wiring (reminders.ts reads settings → passes config)
           └─→ saveSmsSettings + getComposioStatus exposure
                └─→ /connect SMS card UI
                     └─→ end-to-end verification (fixture sweep + tsc + build)

## Task List

### Phase 1: Foundation (engine + schema)
- [ ] Task 1: settings schema fields + codegen
- [ ] Task 2: engine SmsConfig + gate 6a/6b (TDD: failing tests first)

### Checkpoint: Foundation
- [ ] `npm test` green (old + new engine cases), `npx convex codegen` clean

### Phase 2: Wiring (Convex)
- [ ] Task 3: sweepOwner passes owner SMS config
- [ ] Task 4: saveSmsSettings mutation + status exposure

### Checkpoint: Wiring
- [ ] `npx tsc --noEmit` green; manual sweep on fixture shows suppression reasons

### Phase 3: UI + Verify
- [ ] Task 5: /connect SMS escalation card
- [ ] Task 6: end-to-end verification + docs (HANDOFF note)

### Checkpoint: Complete
- [ ] All 6 spec success criteria met; `npm test`, `tsc`, `build` green; human review

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Schema change needs Convex deploy to take effect (cf. HANDOFF FIX 7 stale bundle) | Med | Run `npx convex codegen` + verify function-spec; preview deploy before prod |
| Threshold unit confusion (USD-equiv with EUR/GBP x1.1) | Low | Reuse existing `amountInUsd`; label UI "USD-equivalent" |
| SMS suppressed but approver confused why only email queued | Low | Explicit `detail` string in decisions feed ("SMS escalation disabled / threshold $X") |
| Invalid threshold written by old client | Low | Server-side strict validation; engine defensive fallback |

## Open Questions
- None — all 4 spec questions decided 2026-09-18 (see SPEC-sms-controls.md).
