---
description: Run the pre-launch checklist via parallel fan-out to specialist personas, then synthesize a go/no-go decision
---

Invoke the `shipping-and-launch` skill (`.agents/skills/shipping-and-launch/SKILL.md`).

`/ship` is a **fan-out orchestrator**. It runs three specialist reviews in parallel against the current change, then merges their reports into a single go/no-go decision with a rollback plan. The reviewers operate independently — no shared state, no ordering.

## Phase A — Parallel fan-out

Run these three passes concurrently (one message, parallel tool calls where the harness supports it; otherwise sequentially and merge as if parallel):

1. **Code review** — five-axis review (correctness, readability, architecture, security, performance) on the staged changes or recent commits per `code-review-and-quality`. Output the standard review template.
2. **Security audit** — vulnerability and threat-model pass per `security-and-hardening`. Check OWASP Top 10, secrets handling, auth/authz, dependency CVEs. Output the standard audit report.
3. **Test analysis** — coverage analysis per `test-driven-development`. Identify gaps in happy path, edge cases, error paths, and concurrency scenarios. Output the standard coverage analysis.

Constraints: reviewers do not delegate to each other. Each produces only its report back to this main session.

## Phase B — Merge in main context

1. **Code Quality** — Aggregate Critical/Important findings plus failing tests, lint, or build output. Resolve duplicates.
2. **Security** — Promote any Critical/High security findings to launch blockers.
3. **Performance** — Pull from the performance axis; cross-check Core Web Vitals if applicable.
4. **Accessibility** — Verify keyboard nav, screen reader support, contrast.
5. **Infrastructure** — Env vars, migrations, monitoring, feature flags. Verify directly.
6. **Documentation** — README, ADRs, changelog. Verify directly.

ClearDue launch gates: approval gate intact, credit model correct, no secrets in git, `npx tsc --noEmit` + `npm run build` green.

## Phase C — Decision and rollback

```markdown
## Ship Decision: GO | NO-GO

### Blockers (must fix before ship)
- [Source: Critical finding + file:line]

### Recommended fixes (should fix before ship)
- [Source: Important finding + file:line]

### Acknowledged risks (shipping anyway)
- [Risk + mitigation]

### Rollback plan
- Trigger conditions: [what signals would prompt rollback]
- Rollback procedure: [exact steps]
- Recovery time objective: [target]
```

Rules:
1. The three Phase A passes run in parallel — never sequentially when parallelism is available.
2. Reviewers do not call each other. The main agent merges in Phase B.
3. The rollback plan is mandatory before any GO decision.
4. Any Critical finding defaults to NO-GO unless the user explicitly accepts the risk.
5. **Skip the fan-out only if all of the following are true:** the change touches 2 files or fewer, the diff is under 50 lines, and it does not touch auth, payments, data access, or config/env.
