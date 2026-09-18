---
description: Conduct a five-axis code review — correctness, readability, architecture, security, performance
---

Invoke the `code-review-and-quality` skill (`.agents/skills/code-review-and-quality/SKILL.md`).

Review the current changes (staged or recent commits) across all five axes:

1. **Correctness** — Does it match the spec? Edge cases handled? Tests adequate?
2. **Readability** — Clear names? Straightforward logic? Well-organized?
3. **Architecture** — Follows existing patterns? Clean boundaries? Right abstraction level (domain/application/infrastructure/presentation)?
4. **Security** — Input validated? Secrets safe? Auth checked? (Use `security-and-hardening` skill)
5. **Performance** — No N+1 queries? No unbounded ops? (Use `performance-optimization` skill)

ClearDue extras: approval gate still human-only, credit accounting correct, no keys in diff.

Categorize findings as Critical, Important, or Suggestion.
Output a structured review with specific file:line references and fix recommendations.
