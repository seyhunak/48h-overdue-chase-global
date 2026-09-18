# Project Coding Standards — ClearDue (agent-skills workflow)

> speckit/`.specify` is retired. Follow the skills in `.github/skills/<name>/SKILL.md`
> (symlinks → `.agents/skills/`). Each skill is also a `/<skill-name>` slash command.

## Routing

- Unsure which workflow → read `using-agent-skills` first.
- New feature / vague idea → `spec-driven-development`, then `incremental-implementation` + `test-driven-development`.
- Plan → `planning-and-task-breakdown`. Bug → `debugging-and-error-recovery`.
- API/contract → `api-and-interface-design`. UI → `frontend-ui-engineering` (+ `hallmark` for greenfield/audit/redesign).
- Before merge → `code-review-and-quality`. Security → `security-and-hardening`.

## Testing

- Write tests before code (TDD); bugs: failing reproduction first (Prove-It pattern).
- Test hierarchy: unit > integration > e2e (lowest level that captures the behavior).
- Verify with `npx tsc --noEmit` + `npm run build` before calling work done.

## Code Quality

- Review across five axes: correctness, readability, architecture, security, performance.
- Every PR must pass: lint, type check, tests, build.
- No secrets in code or version control (`.env.local` gitignored; Composio keys server-side only).

## Implementation

- Build in small, verifiable increments: implement → test → verify → commit.
- Never mix formatting-only changes with behavior changes.

## ClearDue invariants (never violate)

- Human approval gate: sweep queues `pending_approval`; NOTHING sends without explicit Approve + Send.
- 1 credit per invoice (free 3 on signup); validate CSV/phone (E.164) before spending credits.
- Keep the domain/application/infrastructure/presentation split.
