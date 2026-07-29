# Quick Task 260729-hiz: Expense title parity + grocery pattern harden - Context

**Gathered:** 2026-07-29
**Status:** Ready for planning

<domain>
## Task Boundary

Two independent deliverables on branch `quick/260729-hiz-expense-title-grocery-harden` (forked from latest `origin/main`):

1. **Expense detail title parity** — port the transaction-detail layout pattern (no header title/amount; title only inside Dati card with `break-words`, no truncation) to the expense detail page.
2. **Harden `spesa-quotidiana` system regex** — surgical edits to alternatives in `scripts/seed-patterns-data.ts`, audit extension, regression tests, travel-agency pattern, and report. Full mandate: `260729-hiz-GROCERY-BRIEF.md` in this directory (LOCKED — execute every Definition of Done item).

</domain>

<decisions>
## Implementation Decisions

### Task 1 — Expense detail (locked from scout of commit 80544a6)

- Remove `title` / `amount` / `amountInline` / `amountToneClassName` from `DetailPageShell` usage in `expense-detail-client.tsx` (header = back only, like transaction detail).
- Add `variant?: 'inline' | 'detail'` to `ExpenseTitleEdit`; detail uses `break-words` (no truncate); keep `inline`+truncate for table/list usages.
- Title remains only in the Dati card with `variant="detail"`.
- Amount stays in Riepilogo only (already present) — do not invent a transaction-style amount editor in Dati.
- **Out of scope for task 1:** group detail (`group-detail-client`) unless trivial; "Descrizione originale" (expense has no separate bank description).

### Task 2 — Grocery pattern (locked from user brief)

- Follow `260729-hiz-GROCERY-BRIEF.md` end-to-end. Every §3 alternative gets RESTRINGI | RIMUOVI | MANTIENI with one-line rationale in the report.
- Principle: **a false positive costs more than an uncategorized transaction**.
- Consistency rule (§4.2) as a comment above the grocery pattern.
- Fix BOTH `\bins\b` and `\bin'?s\b` (prefer restrict to IN'S Mercato form; drop pure redundant `\bins\b` once `\bin'?s\s+mercato` exists).
- Remove or fix dead `\bu!\b`.
- Extend `scripts/audit-pattern-overlaps.ts` (do not rewrite matcher; keep `applyTier1Regex` as SoT).
- Regression tests per §4.4.
- New travel-agency system pattern → existing Vacanze subcategory only. **Locked choice:** `subCategorySlug: "alloggio"` (no dedicated agency slug; trip-package / travel-specialist payments are intrinsically travel; `trasporto` is flights/ferries; `assicurazione-viaggio` is insurance). Document in report. Priority must not lose to grocery after grocery fix.
- Write `.planning/grocery-pattern-hardening-REPORT.md`.
- **Do NOT** run `yarn db:seed-patterns` against production/local DB as deploy — propose operator step in report only.
- **Out of scope (§5):** Fineco SEPA `descriptionStripPattern`, retroactive re-categorization, other system patterns (audit may flag), moving `\brisparmio casa\b`.

### Claude's Discretion

- Exact RESTRINGI forms for Tier A–C (within brief examples).
- Whether to touch group-detail in task 1 (prefer no).
- Travel pattern priority number (must be defensible vs grocery after restrict).

</decisions>

<specifics>
## Specific Ideas

- Task 1 reference files: `components/transactions/transaction-detail-client.tsx`, `transaction-title-edit.tsx` vs `components/expenses/expense-detail-client.tsx`, `expense-title-edit.tsx`.
- Task 2 primary file: `scripts/seed-patterns-data.ts` (spesa-quotidiana ~lines 15–22 area).
- Vacanze active slugs: `alloggio`, `trasporto`, `assicurazione-viaggio` (CONTEXT.md: attivita/cibo under vacanze deactivated).

</specifics>

<canonical_refs>
## Canonical References

- `260729-hiz-GROCERY-BRIEF.md` — full grocery hardening mandate (this directory)
- Commit `80544a6` — transaction detail de-duplicate title / un-truncate
- `CONTEXT.md` — Vacanze taxonomy arbitration
- ADR 0007 — do not change descriptionStripPattern / descriptionHash in this task

</canonical_refs>
