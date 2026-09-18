---
description: Start spec-driven development — write a structured specification before writing code
---

Invoke the `spec-driven-development` skill (`.agents/skills/spec-driven-development/SKILL.md` — symlinked into every agent dir; do NOT use speckit/`.specify`, retired).

Begin by understanding what the user wants to build. Ask clarifying questions about:
1. The objective and target users
2. Core features and acceptance criteria
3. Tech stack preferences and constraints
4. Known boundaries (what to always do, ask first about, and never do)

Then generate a structured spec covering all six core areas: objective, commands, project structure, code style, testing strategy, and boundaries.

ClearDue addendum: record the human approval gate (sweep queues `pending_approval`, nothing sends without Approve + Send), the credit model (1/invoice, free 3), and secrets policy (`.env.local` gitignored, Composio keys server-side) in the spec boundaries.

If the request bundles several independently testable capabilities, first propose a capability map (module ids, dependency direction, build order) per the skill's Phase 0 and get it approved, then spec each module in dependency order.

Save the spec as SPEC.md in the project root and confirm with the user before proceeding.
