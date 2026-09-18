# ClearDue — Agent Operating Guide (48h)

> SpecKit / `.specify` is RETIRED in this repo. The single workflow is
> **addyosmani/agent-skills** (25 engineering skills), installed project-local
> via the `skills` CLI. Every agent below reads the same pack — no per-agent
> skill copies, no speckit commands.

## 1. Installed skill pack (source of truth)

```bash
npx skills add addyosmani/agent-skills --all -y   # 25 skills → .agents/skills/
npx skills list                                   # verify project scope
```

- Canonical skills live in `.agents/skills/<name>/SKILL.md` (tracked in git
  via `skills-lock.json`).
- `.claude/skills/`, `.opencode/skills/`, `.kilo-code/skills/`,
  `.cline/skills/`, `.cursor/skills/`, `.github/skills/`, `.roo-code/skills/`
  are **symlinks** → `../../.agents/skills/<name>`. Never edit a skill in
  place — run `npx skills update <name>` (or `--all`) and re-link.
- `npx skills add` only creates the `.claude/skills` + `.agents/skills`
  links on its own; the remaining agent dirs are linked by
  `scripts/sync-agent-skills.sh` (run it after every add/update).
- Extra project skill: `hallmark` (anti-AI-slop design, same layout, same
  symlink treatment). 26 skills total on disk.

## 2. Agent map — all agents read the same files

| Agent | Skills path (symlink target) | Adapter / entry point |
|---|---|---|
| Claude Code | `.claude/skills/` | `.claude/commands/*.md` (`/spec /plan /build /test /review /ship`) |
| OpenCode | `.opencode/skills/` | `AGENTS.md` intent table below (no slash-command runtime; optional `.opencode/commands/*.md`) |
| Kilo Code | `.kilo-code/skills/` | Skills auto-discovered; `.kilocode-rules` mirrors the intent table |
| Cline | `.cline/skills/` | Skills auto-discovered; `.clinerules` mirrors the intent table |
| Roo Code | `.roo-code/skills/` | Skills auto-discovered via `.roo-code/skills/` |
| Cursor | `.cursor/skills/` | `.cursor/rules/agent-skills.mdc` (router, alwaysApply) + skills on demand |
| GitHub Copilot (VS Code) | `.github/skills/` | Each skill is `/<skill-name>`; `.github/copilot-instructions.md` is the router |
| Universal fallback (any other agent) | `.agents/skills/` | Read `using-agent-skills` first, then the matching skill |

## 3. Mandatory lifecycle (replaces speckit)

```
DEFINE (/spec) → PLAN (/plan) → BUILD (/build) → VERIFY (/test) → REVIEW (/review) → SHIP (/ship)
```

Intent → skill (check for a match BEFORE writing code — even 1% chance):

- New feature / vague idea → `spec-driven-development`, then
  `incremental-implementation` + `test-driven-development`
- Plan / breakdown / estimate → `planning-and-task-breakdown`
- Bug / 500 / failing test → `debugging-and-error-recovery`
- API / contract / module boundary → `api-and-interface-design`
- UI / page / component → `frontend-ui-engineering` (+ `hallmark` for greenfield/audit/redesign)
- Review / PR → `code-review-and-quality`
- Simplify / refactor → `code-simplification`
- Security / auth / input / secrets → `security-and-hardening`
- Speed / N+1 / vitals → `performance-optimization`
- Git / commit / PR / release → `git-workflow-and-versioning`
- CI / deploy pipeline → `ci-cd-and-automation`
- Launch readiness → `shipping-and-launch`
- Quality bar / thresholds → `constraint-driven-development`
- Unsure which skill → `using-agent-skills` (router), `interview-me` (clarify), `idea-refine` (sharpen)

Anti-rationalization (all agents): "too small for a skill", "I'll just
implement it", "context first" — all wrong. Skill first, then act.

## 4. ClearDue non-negotiables (apply inside every skill)

- Human approval gate: the sweep queues `pending_approval`; NOTHING sends
  without explicit Approve + Send. Never bypass, auto-approve, or batch-send.
- 1 credit per invoice, free 3 on signup; validate CSV/phone (E.164) before credits.
- Secrets: `.env.local` is gitignored and never committed; owner Composio keys
  stay server-side in Convex `settings`.
- Verify with `npx tsc --noEmit` + `npm run build`; keep the clean-architecture
  split (domain/application/infrastructure/presentation).

## 5. Skill maintenance

```bash
./scripts/sync-agent-skills.sh        # re-link all agent dirs → .agents/skills
npx skills update -y                  # refresh pack, then re-run sync script
npx skills add addyosmani/agent-skills --skill <name> -y && ./scripts/sync-agent-skills.sh
```
