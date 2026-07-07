---
quick_id: 260703-na4
slug: full-description-tooltip-widen-expense-t
status: complete
completed: 2026-07-03
reconciled: 2026-07-07
---

# Quick Task 260703-na4: Full description tooltip (widen expense.title) — Summary

**One-liner:** `expense.title` widened `varchar(120)` → `text`, both write-time
truncations removed (import + detach), zod bounds raised to 500, idempotent
seed-extras backfill for previously truncated titles, and native `title=""`
tooltips now carry the complete bank description on all three surfaces.

## Reconciliation note

This task was fully executed on 2026-07-03 (all 5 plan tasks committed) but the
SUMMARY.md was never written, so the milestone-close audit reported it as
`missing`. Reconciled on 2026-07-07: commits verified in history, all regression
tests confirmed green in the full suite (115 files / 1368 tests passing as of
commit c9dc08a). No code changes were needed at reconciliation time.

## Commits (executed 2026-07-03)

| Commit | Task | What |
|--------|------|------|
| c3b39af | 1 | feat(schema): widen expense.title varchar(120) → text + migration 0025 (`ALTER COLUMN "title" SET DATA TYPE text`) |
| 19143a8 | 2 | fix(expense): import stores full description; detach keeps trim() only; zod title bounds 120 → 500 with updated Italian message |
| 4937f68 | 3 | feat(seed-extras): `backfill-truncated-expense-titles` STEP, registered last — rewrites only `char_length(title) = 120` rows with a longer linked description (idempotent) |
| 19ffeb8 | 4 | fix(ui): transaction main-title span uses `title={description}`; expense details dialog gains a wrapped "Descrizione" column |
| f5b65f5 | 5 | test: no truncation on import/detach, zod >120 accepted, backfill step registered last |
| 2ffbb4d | 5 | test(transactions): title tooltip carries full description |

## Must-haves verification

- Transaction title hover shows the full bank description — `title={description}` on both spans of `transaction-title-edit.tsx` ✓
- Expense title tooltips show the complete (post-widening) title — `expense-table.tsx` / `expense-title-edit.tsx` pass-through confirmed ✓
- Expense details dialog renders each linked transaction's full description, wrapped (`whitespace-normal break-words`) ✓
- Import of a >120-char description stores it untruncated (`import.ts:613` = `acc.description`) ✓
- Detach preserves a >120-char trimmed title (`transaction-detach.ts` trim-only, empty guard kept) ✓
- Backfill STEP exists, is last in STEPS, guarded by `char_length(title) = 120` + longer linked description ✓
- Migration `drizzle/migrations/0025_cuddly_roxanne_simpson.sql` — widening only, no data change in SQL ✓

## Post-execute follow-up (2026-07-07, fast task)

The validation test `lib/validations/__tests__/expense.test.ts` still pinned the
old 120-char bound and was updated to the 500-char reality in commit c9dc08a
(part of the pre-existing-failures repair fast task).

## Operator run order (live DB, if not yet applied)

```bash
yarn db:migrate        # applies 0025 widening
yarn db:seed-extras    # runs backfill-truncated-expense-titles
```
