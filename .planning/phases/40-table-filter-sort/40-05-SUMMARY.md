---
phase: 40-table-filter-sort
plan: "05"
subsystem: polish-a11y-url-migration
tags: [empty-state, a11y, url-migration, prototype-deletion, wave5, build]
dependency_graph:
  requires:
    - components/data-table/DataTableToolbar.tsx (Wave 2/3/4)
    - lib/validations/transactions.ts (Wave 4 — q, months, amountMin/Max, status)
    - lib/validations/expense.ts (Wave 4 — parseExpenseFilters, D-05 no period)
    - lib/validations/import.ts (Wave 4 — platform, statusBucket, months, amount)
    - app/(app)/transactions/page.tsx (Wave 4 — DataTableToolbar wired)
    - app/(app)/expenses/page.tsx (Wave 4 — DataTableToolbar wired)
    - app/(app)/import/page.tsx (Wave 4 — DataTableToolbar wired)
  provides:
    - components/data-table/EmptyState.tsx (EmptyState, no-data vs no-result)
    - URL migration complete (transactions: from/to dropped; imports: importedFrom/To/referenceFrom/To dropped)
    - app/proto/table-toolbar/ deleted
  affects:
    - Three table pages — empty rendering now uses EmptyState variant
    - Mobile a11y — Ordina button labeled
tech_stack:
  added: []
  patterns:
    - EmptyState variant selection at server (page) level — no-data vs no-result
    - Total-function URL migration — legacy params silently ignored, never throw
    - Wave 5 convention — prototype directory deleted on final plan (mirrors Phase 38/39)
key_files:
  created:
    - components/data-table/EmptyState.tsx
  modified:
    - components/data-table/DataTableToolbar.tsx
    - app/(app)/transactions/page.tsx
    - app/(app)/expenses/page.tsx
    - app/(app)/import/page.tsx
    - lib/validations/transactions.ts
    - lib/validations/import.ts
    - components/import/import-table.tsx
    - lib/validations/__tests__/transactions.test.ts
  deleted:
    - app/proto/table-toolbar/page.tsx
    - app/proto/table-toolbar/shared.tsx
    - app/proto/table-toolbar/variant-a.tsx
    - app/proto/table-toolbar/variant-b.tsx
    - app/proto/table-toolbar/variant-c.tsx
    - app/proto/table-toolbar/prototype-switcher.tsx
    - app/proto/table-toolbar/mock-data.ts
    - app/proto/table-toolbar/NOTES.md
decisions:
  - "EmptyState variant computed server-side in each page using active-filter key check; no new client state needed"
  - "from/to dropped from parseTransactionFilters return (legacy links degrade to default view, total parsing)"
  - "importedFrom/To/referenceFrom/To dropped from parseImportFilters return (months is canonical temporal filter)"
  - "ImportTable.hasActiveFilters updated to Wave 4+ keys only (legacy keys no longer set)"
  - "check:language failures in pre-existing test files (subcategory-picker, suggestion-promote-form) are out of scope — deferred"
metrics:
  duration_seconds: 1050
  completed_date: "2026-06-04"
  tasks_completed: 2
  files_changed: 15
---

# Phase 40 Plan 05: Polish — Empty States, A11y, URL Migration, Prototype Cleanup (Wave 5) Summary

**One-liner:** EmptyState component (no-data vs no-result) wired in all three table pages, mobile sort button labeled, legacy URL params (from/to, importedFrom/To/referenceFrom/To) silently dropped in total-function parsers, prototype route deleted, and `yarn build` green.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Empty-state distinction + a11y pass | baff8bc | EmptyState.tsx, DataTableToolbar.tsx, three pages |
| 2 | Legacy URL migration + prototype deletion + build green | dcfcc3c | validations/transactions.ts, validations/import.ts, prototype deleted |

## What Was Built

### Task 1 — EmptyState + a11y

`components/data-table/EmptyState.tsx`:
- `EmptyState({ variant: 'no-data' | 'no-result', message?, hint? })` — Card-based placeholder
- `no-data`: "Nessun dato" — table has zero rows regardless of filters
- `no-result`: "Nessun risultato" — rows exist but active filters exclude them all
- Custom `message`/`hint` props for per-table phrasing

Three pages updated with `hasActiveXxxFilters(params)` helper:
- `app/(app)/transactions/page.tsx` — `hasActiveTransactionFilters` checks: `q, name, months, amountMin, amountMax, platform, category, status`
- `app/(app)/expenses/page.tsx` — `hasActiveExpenseFilters` checks: `q, category, platform, status, amountMin, amountMax`
- `app/(app)/import/page.tsx` — `hasActiveImportFilters` checks: `q, platform, statusBucket, months, amountMin, amountMax, importedFrom, importedTo, referenceFrom, referenceTo`

Each page renders `<EmptyState variant="no-result" ...>` when filters are active + empty, or `<EmptyState variant="no-data" ...>` when no filters + empty.

A11y:
- `aria-label="Ordina"` added to mobile sort trigger in `DataTableToolbar.tsx`
- `aria-sort` confirmed on `HeaderSortButton` (Wave 2, unchanged)
- `aria-live="polite"` confirmed on load-more regions in all three table components (Wave 2/4)

### Task 2 — URL migration + prototype deletion

**`lib/validations/transactions.ts`** (Wave 5 migration):
- `parseTransactionFilters` no longer reads `input.from` / `input.to`
- Legacy `?from=&to=` links silently degrade to default view (total parsing — never throw)
- `q ?? name` alias retained: `?name=foo` still resolves as search

**`lib/validations/import.ts`** (Wave 5 migration):
- `parseImportFilters` no longer reads `importedFrom`/`importedTo`/`referenceFrom`/`referenceTo`
- Legacy date-param links silently degrade to default view
- `months` is the canonical temporal filter for the Files table

**`lib/validations/expense.ts`**: no changes — `period` was already absent (D-05, Wave 4).

**`components/import/import-table.tsx`**:
- `hasActiveFilters` updated to check Wave 4+ keys only (legacy keys no longer set)

**Prototype deleted**: `app/proto/table-toolbar/` (8 files) — no dangling references.

**Tests updated**: `lib/validations/__tests__/transactions.test.ts` — 3 tests updated to reflect Wave 5 behavior (from/to now returns `undefined`, not dates). All 18 tests pass. All 60 DAL tests pass.

**Build**: `yarn build` exits 0. No new TypeScript errors. `yarn check:language` passes for all files touched by this plan.

## Verification

```
yarn vitest run lib/validations/__tests__/transactions.test.ts
  Test Files  1 passed (1)
       Tests  18 passed (18)

yarn vitest run tests/transactions-dal.test.ts tests/expenses-dal.test.ts tests/imports-dal.test.ts
  Test Files  3 passed (3)
       Tests  60 passed (60)

test ! -d app/proto/table-toolbar → exit 0
grep -rE "proto/table-toolbar" app components lib → no matches
yarn build → exit 0 (19 routes generated)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Existing transaction validation tests expected legacy from/to behavior**
- **Found during:** Task 2 (after Wave 5 parser migration)
- **Issue:** 3 tests in `transactions.test.ts` checked `fromDate`/`toDate` in parser output — now removed by Wave 5
- **Fix:** Updated 3 test cases: assertions changed to `expect(parsed.fromDate).toBeUndefined()` and removed `from`/`to` fields from `toEqual` expectations
- **Files modified:** lib/validations/__tests__/transactions.test.ts
- **Commit:** dcfcc3c

**2. [Rule 1 - Bug] ImportTable.hasActiveFilters checked only legacy params (importedFrom/To/referenceFrom/To)**
- **Found during:** Task 2 (Wave 5 migration — legacy params dropped from parser)
- **Issue:** The internal `hasActiveFilters` function in `ImportTable` still checked `importedFrom/importedTo/referenceFrom/referenceTo` which are no longer set after the Wave 5 migration; Wave 4 params (platform, statusBucket, months, amountMin, amountMax) were not checked
- **Fix:** Updated `hasActiveFilters` to check canonical Wave 4+ keys
- **Files modified:** components/import/import-table.tsx
- **Commit:** dcfcc3c

**3. [Rule 2 - Language Convention] EmptyState.tsx JSDoc contained Italian product strings in developer comments**
- **Found during:** Task 2 (yarn check:language)
- **Issue:** JSDoc lines 16/18 mentioned "Nessun dato"/"Nessun risultato" as prose in developer-facing comments
- **Fix:** Rephrased to English descriptions ("Italian product string for No data/No results")
- **Files modified:** components/data-table/EmptyState.tsx
- **Commit:** dcfcc3c

### Deferred Items

**check:language failures in pre-existing test files** — `tests/subcategory-picker.test.tsx:207` and `tests/suggestion-promote-form.test.tsx:72,81,83,84,85` have Italian developer comments. These are out of scope for Wave 5 (files not touched by this plan). Logged to deferred-items.

## Known Stubs

None. All three table pages have real EmptyState variants wired with accurate filter detection.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. EmptyState variant selection is purely presentational (T-40-14: accepted — no security impact, confirmed).

## Self-Check: PASSED
