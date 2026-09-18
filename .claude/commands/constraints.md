---
description: Set the quality bar as a written contract — thresholds, then enforcement
---

Invoke the `constraint-driven-development` skill (`.agents/skills/constraint-driven-development/SKILL.md`).

Interview the user on which dimensions matter (accessibility, performance, coverage…), supply sane default thresholds when they have no number in mind, record everything in CONSTRAINTS.md, and watch the diff for a weakened bar — new `@ts-ignore`/`eslint-disable` suppressions, skipped or deleted tests, stripped assertions, unimplemented stubs, thresholds edited down.

ClearDue defaults to propose: `tsc` clean, `next build` green, approval gate intact (no auto-send), no secrets committed.
