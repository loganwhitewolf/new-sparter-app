---
phase: 36-post-import-reanalysis
fixed_at: 2026-05-23T11:00:00Z
review_path: .planning/phases/36-post-import-reanalysis/36-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 36: Code Review Fix Report

**Fixed at:** 2026-05-23T11:00:00Z
**Source review:** .planning/phases/36-post-import-reanalysis/36-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (1 Critical, 3 Warning)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: `normalizedDescription` is set to raw `t.description` — tokenizer receives un-normalized input

**Files modified:** `app/(app)/import/[fileId]/suggestions/page.tsx`, `tests/import-suggestions-page.test.tsx`
**Commit:** 28f385f
**Applied fix:** Changed `normalizedDescription: t.description` to `normalizedDescription: t.description.toUpperCase().replace(/\s+/g, ' ').trim()` in the `detectorRows` adapter. Added a new test asserting that `'Coffee  Shop 001'` maps to `normalizedDescription: 'COFFEE SHOP 001'` with collapsed whitespace, verifying the normalization contract that the original test (which used single-character input `'X'`) could not exercise.

---

### WR-01: `filters.name` LIKE pattern is not escaped — `%` and `_` in user input act as wildcards

**Files modified:** `lib/dal/transactions.ts`
**Commit:** 63cbe46
**Applied fix:** Added `escapeLikePattern(input: string): string` helper after the imports (escapes `\`, `%`, `_` via `replace(/[\\%_]/g, '\\$&')`). Applied it at the `filters.name` interpolation: `const pattern = \`%${escapeLikePattern(filters.name)}%\``. The helper is file-scoped (not exported) since it is a query-building detail.

---

### WR-02: `ImportRowActions` renders both "Configura formato" and "Riprova analisi" simultaneously for unknown-format failures

**Files modified:** `components/import/import-row-actions.tsx`, `tests/import-table-actions.test.tsx`
**Commit:** 9a5c041
**Applied fix:** Added `!unknownFormat` guard to the "Riprova analisi" render condition (`{row.status === 'failed' && !unknownFormat && ...}`). Updated the corresponding test to assert that `Riprova analisi` is absent when `unknownFormat` is true, replacing the previous assertion that both CTAs appear simultaneously.

---

### WR-03: `getUncategorizedTransactionsByFileId` has no row limit — unbounded result set in the RSC render cycle

**Files modified:** `lib/dal/transactions.ts`
**Commit:** 7cce572
**Applied fix:** Added `const UNCATEGORIZED_TX_LIMIT = 2000` constant and `.limit(UNCATEGORIZED_TX_LIMIT)` to the query chain. The named constant makes the intent explicit and gives a single place to adjust if the bound needs tuning.

---

_Fixed: 2026-05-23T11:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
