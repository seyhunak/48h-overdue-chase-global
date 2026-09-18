# AGENTS.md — ClearDue Agent Operating Guide

> This is the **project-root system prompt** for every coding agent working in
> this repo (Cline, Kilo Code, OpenCode, Roo Code, Cursor, Copilot, Claude Code,
> or any fallback that reads `AGENTS.md`). It tells you **when and how to invoke
> the installed skills** and adapts them to the ClearDue stack.
> SpecKit / `.specify` is **RETIRED** — do not use speckit commands.

## 0. Stack snapshot (adapt all skills to this)

| Layer | Technology / Convention |
|---|---|
| Framework | Next.js 15 App Router + TypeScript (`src/app/`, `src/middleware.ts`) |
| Auth | Clerk (`@clerk/nextjs`); protect `/app`, `/admin`, `/data` via middleware |
| Backend | Convex serverless (`convex/schema.ts`, `reminders.ts`, `sweepDecide.ts`, `credits.ts`, `vault.ts`, `crons.ts`) |
| Notifications | OneSignal (email/SMS/push) via `src/infrastructure/notify.ts` — Composio first, env fallback (`ONESIGNAL_APP_ID`/`ONESIGNAL_API_KEY`); Zoho import via Composio OAuth |
| Billing | Stripe credit pack (`src/app/api/checkout/route.ts`); 1 credit/invoice, 100 credits $99, 3 free on signup (`src/domain/invoices.ts`) |
| UI | Tailwind + Hallmark Tally theme (`src/presentation/tokens.css`, `tally.css`); components in `src/presentation/` |
| Architecture | Clean split — `src/domain/` (pure, no imports) / `src/application/` / `src/infrastructure/` / `src/presentation/` / `src/app/` (routes) / `convex/` (persistence). Never leak framework code into `domain/`. |
| Env | `.env.local` gitignored, never committed; owner Composio keys server-side in Convex `settings` table only |

## 1. Skill pack — source of truth and how to invoke

Canonical skills: `.agents/skills/<name>/SKILL.md` (tracked by `skills-lock.json`).
Every agent dir is a symlink farm to `../../.agents/skills/<name>`:
`.claude/skills/`, `.opencode/skills/`, `.kilo-code/skills/`, `.cline/skills/`,
`.cursor/skills/`, `.github/skills/`, `.roo-code/skills/` (+ project skill `hallmark`).

- **26 skills on disk:** 25 from `addyosmani/agent-skills` + `hallmark`.
- **Never edit a skill in place.** Refresh with `npx skills update -y && ./scripts/sync-agent-skills.sh`, verify with `npx skills list`.
- **How to invoke (mandatory — skill first, even on 1% match):**
  1. Match the intent table in S3 to a skill name.
  2. Read `.agents/skills/<name>/SKILL.md` (or your agent-local symlink) **before** writing code.
  3. Follow its workflow steps in order; do not skip verification steps.
  4. Anti-rationalization: "too small for a skill", "I will just implement it", "context first" are all wrong — skill first, then act.
- **Per-agent entry points** (all read this file + the same pack): Claude Code via `.claude/commands/*.md` (`/spec /plan /build /test /review /ship`); OpenCode via this intent table; Kilo via `.kilo-code/skills/` + `.kilocode-rules`; Cline via `.cline/skills/` + `.clinerules`; Roo via `.roo-code/skills/` + `.roo-code-rules`; Cursor via `.cursor/rules/agent-skills.mdc`; Copilot via `/<skill-name>` + `.github/copilot-instructions.md`; fallback via `using-agent-skills` first.

## 2. Mandatory lifecycle (replaces speckit)

```
DEFINE (/spec) -> PLAN (/plan) -> BUILD (/build) -> VERIFY (/test) -> REVIEW (/review) -> SHIP (/ship)
```

Full feature sequence: `interview-me` -> `idea-refine` -> `spec-driven-development` ->
`planning-and-task-breakdown` -> `context-engineering` (+ `source-driven-development` for doc-verified APIs) ->
`incremental-implementation` (+ `frontend-ui-engineering` / `api-and-interface-design` as needed) ->
`test-driven-development` -> `debugging-and-error-recovery` (if broken) ->
`code-review-and-quality` (+ `security-and-hardening` / `performance-optimization` on those axes) ->
`git-workflow-and-versioning` -> `shipping-and-launch`.
Bugfix shortcut: `debugging-and-error-recovery` -> `test-driven-development` -> `code-review-and-quality`.
## 3. Intent -> skill router (check BEFORE writing code)

| Intent / trigger | Skill to read first | ClearDue adaptation |
|---|---|---|
| Do not know what user wants yet | `interview-me` | Ask about invoice source (CSV vs Zoho), channels (email/SMS/push), credit impact |
| Rough concept, need variants | `idea-refine` | Diverge on sequence copy (pre-due/due/+7/+14/+30 in `domain/invoices.ts`), converge on approval-gate UX |
| New feature / change / vague ask, no spec | `spec-driven-development` | Spec must state acceptance criteria + which Convex tables (`reminders`, `decisions`, `credits`, `vault`) change |
| No quality bar written down | `constraint-driven-development` | Constraints: approval gate, 1 credit/invoice, E.164 phone + CSV validation, `tsc`+`build` green |
| Have spec, need tasks / estimate | `planning-and-task-breakdown` | Thin vertical slices (domain -> Convex -> API route -> presentation); each independently verifiable |
| Implementing code | `incremental-implementation` | Slice-by-slice; commit each green slice |
| UI / page / component | `frontend-ui-engineering` | Tally theme tokens, accessible forms, preserve `TopMenu` + footer layout |
| Greenfield / audit / redesign styling | `hallmark` | Anti-AI-slop: Tally tokens, Instrument Serif accents, no generic gradients |
| API / contract / module boundary | `api-and-interface-design` | Design `src/app/api/*` + Convex function contracts first; keep `domain/` pure |
| Need better context / large exploration | `context-engineering` | Load `convex/schema.ts` + `domain/invoices.ts` + relevant route before editing |
| Need doc-verified code (Next/Convex/Clerk/Stripe/OneSignal) | `source-driven-development` | Verify against official docs, not memory |
| High-stakes / unfamiliar code | `doubt-driven-development` | Adversarial review of sweep/credit/billing decisions in-flight |
| Writing / running tests | `test-driven-development` | Failing test first; unit > integration > e2e; pure `sweepDecide.ts` + `domain/invoices.ts` are unit-testable |
| Browser-only bug / visual verification | `browser-testing-with-devtools` | Chrome DevTools MCP for `/app`, `/connect`, `/data` flows |
| Something broke / 500 / failing test | `debugging-and-error-recovery` | Reproduce -> localize -> fix -> guard; check Convex dashboard + `DEBUG_MODE` logs |
| Reviewing code / PR | `code-review-and-quality` | Five axes (correctness, readability, architecture, security, performance); must pass lint+types+tests+build |
| Code too complex | `code-simplification` | Preserve behavior; split bloated `presentation/*-page.tsx` / `*-section.tsx` |
| Auth / input / secrets / XSS / injection | `security-and-hardening` | OWASP: validate CSV/email/phone server-side; Clerk checks on API routes; never expose Composio keys client-side |
| Slow / N+1 / Core Web Vitals | `performance-optimization` | Measure first; watch Convex indexes (`by_owner`, `by_status`) |
| Committing / branching / PR / release | `git-workflow-and-versioning` | Atomic commits, clean history, no `.env.local` |
| CI / deploy pipeline / Docker / nginx | `ci-cd-and-automation` | `Dockerfile` + `docker-compose.yml` + `deploy/nginx-cleardue.conf`; preview-only deploys |
| Deprecating / migrating (e.g. whatsapp/voice -> email/sms/push) | `deprecation-and-migration` | Keep legacy union members readable; migrate writers first (see `schema.ts` channel comment) |
| Writing docs / ADRs | `documentation-and-adrs` | Document the *why* (approval gate, credit model) in `README.md`/`HANDOFF.md` |
| Adding logs / metrics / alerts | `observability-and-instrumentation` | Structured logs via `infrastructure/flags.ts` `DEBUG_MODE`; audit every sweep decision in `decisions` table |
| Deploying / launching | `shipping-and-launch` | Pre-launch checklist + monitoring + mandatory rollback plan; GO/NO-GO |
| Unsure which skill | `using-agent-skills` | Router meta-skill — read it, then the matched skill |

## 4. ClearDue non-negotiables (apply inside EVERY skill)

1. **Human approval gate:** sweep (`convex/crons.ts` 09:05 UTC -> `reminders.ts` -> `sweepDecide.ts`) only queues `pending_approval`. NOTHING sends without explicit Approve + Send (`src/app/api/reminders/send/route.ts`). Never bypass, auto-approve, or batch-send.
2. **Credits:** 1 credit/invoice, free 3 on signup. Validate CSV (`parseCsv`/`validateInvoiceRow`) and phone (E.164) *before* spending credits.
3. **Secrets:** `.env.local` / `.env.production` gitignored, never committed. Owner Composio keys stay server-side in Convex `settings` (`composioKey`, `onesignalAppId`, `zohoAccountId`); use `scripts/seed-env.sh` template.
4. **Verify before done:** `npx tsc --noEmit` + `npm run build` must pass. Keep domain/application/infrastructure/presentation split.

## 5. Core operating behaviors (all skills, all agents)

- **Surface assumptions** before non-trivial work (`ASSUMPTIONS I AM MAKING: ... -> correct me or I proceed`).
- **Manage confusion actively:** STOP on conflicting spec vs code (e.g. channel union, credit math), name it, ask, wait.
- **Push back when warranted:** quantify downside (adds ~200ms, spends N credits wrongly), propose alternative, accept override.
- **Enforce simplicity:** smallest slice that proves value; no speculative abstractions.

## 6. Cookbook (common ClearDue tasks)

- Add sweep rule -> `spec-driven-development` -> edit `convex/sweepDecide.ts` (pure) -> unit-test -> wire `reminders.ts` -> `test-driven-development` -> verify `tsc`+`build`.
- Add UI page -> `frontend-ui-engineering` (+ `hallmark` if greenfield) -> `src/presentation/*` + `src/app/<route>/page.tsx` -> check `layout.tsx` menu/footer.
- Add API route -> `api-and-interface-design` -> `src/app/api/*/route.ts` with Clerk check + validation -> `security-and-hardening` pass.
- Connect provider (OneSignal/Zoho via Composio) -> `src/infrastructure/composio.ts` + `src/app/api/connect/*` + `presentation/connect-page.tsx`; keys server-side only.
- Fix 500 -> `debugging-and-error-recovery`: repro, read Convex logs, failing-test-first guard.

## 7. Skill maintenance

```bash
./scripts/sync-agent-skills.sh        # re-link all agent dirs -> .agents/skills
npx skills update -y && ./scripts/sync-agent-skills.sh  # refresh pack
npx skills add addyosmani/agent-skills --skill <name> -y && ./scripts/sync-agent-skills.sh
```
