---
phase: 36-post-import-reanalysis
reviewed: 2026-05-23T10:30:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - lib/dal/transactions.ts
  - tests/transactions-dal.test.ts
  - app/(app)/import/[fileId]/suggestions/page.tsx
  - tests/import-suggestions-page.test.tsx
  - components/import/import-row-actions.tsx
  - tests/import-table-actions.test.tsx
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 36: Code Review Report

**Reviewed:** 2026-05-23T10:30:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 36 adds three deliverables: `getUncategorizedTransactionsByFileId` (DAL), the `/import/[fileId]/suggestions` server page, and the "Rivedi suggerimenti" dropdown item in `ImportRowActions`.

The DAL function's ownership boundary is sound — it enforces user ownership via an `innerJoin` on the file table and a `eq(importFile.userId, userId)` predicate, so a foreign `fileId` cannot leak rows. The page adds a second gate via `getFileForUser` and `status !== 'imported'` before calling the DAL. The SCOP-03 copy constraint (no implication of re-classifying existing transactions) is respected.

One critical bug exists: the page's `PatternDetectorRow` adapter assigns `normalizedDescription: t.description` (raw value), which means the case-sensitive tokenizer and bucketing logic in `detectPatternSuggestions` never sees normalized input. Three warnings cover a double CTA in the failed state of `ImportRowActions`, an unescaped LIKE wildcard in the pre-existing `filters.name` path, and an unbounded result set in `getUncategorizedTransactionsByFileId`. Two info items cover a missing mock entry and a re-export layering concern.

---

## Critical Issues

### CR-01: `normalizedDescription` is set to raw `t.description` — tokenizer receives un-normalized input

**File:** `app/(app)/import/[fileId]/suggestions/page.tsx:35`

**Issue:** The adapter block on lines 33-39 constructs `PatternDetectorRow` objects and sets:

```ts
normalizedDescription: t.description,
```

`PatternDetectorRow.normalizedDescription` is the field used by `detectPatternSuggestions` for all token extraction (`stripNumericTokens(r.normalizedDescription)`) and bucket-key computation (`c.tokens.slice(0, 2).join(' ')`). The coverage-pattern regex is applied with the `i` flag, but the suggestion-generation side — tokenization and `longestCommonPrefix` — is fully case-sensitive (`a[i] !== b[i]`).

Bank CSV descriptions arrive in mixed case (e.g. `"Amazon EU"` vs `"AMAZON EU"`). Without normalization these map to different first-token pairs, so the buckets never merge and suggestions are silently dropped. The `PatternDetectorRow` interface deliberately exposes two separate fields (`description` for display, `normalizedDescription` for matching) — assigning both to the same raw value makes the split meaningless and the field name misleading.

The test at `import-suggestions-page.test.tsx:170-171` asserts `normalizedDescription === 'X'` (same as `description`), which means the test was written to match the production bug rather than the intended contract.

**Fix:** Apply at minimum the same casing normalization used during import. Check `lib/utils/import.ts` for `computeDescriptionHash` or similar — it typically uppercases and collapses whitespace. Apply the same transform here:

```ts
const detectorRows: PatternDetectorRow[] = uncategorizedTxs.map((t) => ({
  description: t.description,
  normalizedDescription: t.description.toUpperCase().replace(/\s+/g, ' ').trim(),
  amount: t.amount,
  valid: true,
  covered: false,
}))
```

The test at line 170 in `tests/import-suggestions-page.test.tsx` must also be updated to assert the normalized form when `normalizedDescription` is derived from input `'X'`:

```ts
expect(callArg[0]).toEqual({
  description: 'X',
  normalizedDescription: 'X', // toUpperCase().trim() of 'X' is still 'X' — passes
  amount: '-1.00',
  valid: true,
  covered: false,
})
```

For inputs with meaningful casing (e.g. `"Coffee Shop 001"`) the test should assert `normalizedDescription: 'COFFEE SHOP 001'`.

---

## Warnings

### WR-01: `filters.name` LIKE pattern is not escaped — `%` and `_` in user input act as wildcards

**File:** `lib/dal/transactions.ts:163`

**Issue:**

```ts
const pattern = `%${filters.name}%`
```

Drizzle's `ilike()` passes this as a parameterized bind value so there is no SQL injection at the DB layer. However, `%` and `_` inside `filters.name` are live SQL LIKE metacharacters. A search for `%` returns every row; a search for `_` matches any single-character description. This corrupts the "substring search" semantics of the filter and could allow a user to fetch all their transactions regardless of search term.

This path is not new to phase 36 but the test suite added in this phase exercises `getTransactions` extensively and is the right place to cover this gap. The same unescaped interpolation exists in `lib/dal/imports.ts:108` for `filters.q`.

**Fix:**

```ts
function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, '\\$&')
}

// in the filters.name block:
const pattern = `%${escapeLikePattern(filters.name)}%`
```

Verify with the DB driver that `ESCAPE '\\'` is either automatic or add it explicitly.

---

### WR-02: `ImportRowActions` renders both "Configura formato" and "Riprova analisi" simultaneously for unknown-format failures

**File:** `components/import/import-row-actions.tsx:64-81`

**Issue:** The `failed` state renders two independent blocks. When `unknownFormat` is true, both evaluate to true and both `<Button>` elements appear side by side as primary CTAs:

- Line 64: `{row.status === 'failed' && unknownFormat && (<Button>Configura formato</Button>)}`
- Line 77: `{row.status === 'failed' && (<Button>Riprova analisi</Button>)}`  — no `!unknownFormat` guard

"Riprova analisi" links to `/import/.../analyze`, which is the same route that already failed with "unknown format." Presenting it as a co-equal primary action next to "Configura formato" is misleading: clicking "Riprova analisi" without first configuring a format will fail again with the same error.

The test at `tests/import-table-actions.test.tsx:246-252` asserts both appear and passes, but a test asserting incorrect behavior does not make the behavior correct.

**Fix:** Gate the second block to non-unknown-format failures only:

```tsx
{row.status === 'failed' && !unknownFormat && (
  <Button asChild size="sm" variant="outline" aria-label={`Riprova analisi di ${displayName}`}>
    <Link href={`/import/${encodeURIComponent(row.id)}/analyze`}>Riprova analisi</Link>
  </Button>
)}
```

Update the test at line 237-252 in `tests/import-table-actions.test.tsx` to assert that `Riprova analisi` is absent for the unknown-format case, and add a separate test for the non-unknown-format case.

---

### WR-03: `getUncategorizedTransactionsByFileId` has no row limit — unbounded result set in the RSC render cycle

**File:** `lib/dal/transactions.ts:404-423`

**Issue:** The function returns every uncategorized transaction for a file with no `.limit()` clause. A large bank export (e.g., a 12-month statement with 2,000 rows, all uncategorized on first import) will load the full set into memory on the server. The suggestions page materializes all rows into `detectorRows` before `detectPatternSuggestions` runs and `slice(0, 5)` caps output — so the full unbounded array is always allocated.

For a personal finance app this is unlikely to cause a production incident, but there is no defense against edge cases (yearly exports, imported-then-cleared files) and no test asserting any bound.

**Fix:** Add a pragmatic upper limit sufficient for any realistic single-file import:

```ts
return database
  .select({ description: transaction.description, amount: transaction.amount })
  .from(transaction)
  .innerJoin(importFile, eq(transaction.fileId, importFile.id))
  .where(
    and(
      eq(transaction.fileId, fileId),
      eq(importFile.userId, userId),
      isNull(transaction.expenseId),
    ),
  )
  .limit(2000)
```

Add a test asserting `.limit()` is called with the expected value.

---

## Info

### IN-01: `ilike` is absent from the `drizzle-orm` mock — `filters.name` path would throw at test time

**File:** `tests/transactions-dal.test.ts:74-87`

**Issue:** The mock at line 74 exports `and`, `asc`, `desc`, `eq`, `gte`, `inArray`, `isNull`, `lte`, `or`, `sql` — but not `ilike`. The production code imports `ilike` on line 3 of `transactions.ts` and calls it at lines 166-167 when `filters.name` is set. No current test exercises this branch, so the omission is silent. Adding a `filters.name` test would immediately throw `TypeError: ilike is not a function`.

**Fix:**

```ts
ilike: (left: unknown, right: unknown) => ({ op: 'ilike', left, right }),
```

Add to the `vi.mock('drizzle-orm', ...)` block, then add a test for the `name` filter.

---

### IN-02: `isInProgress` is re-exported from the UI component but never used inside it

**File:** `components/import/import-row-actions.tsx:14,149`

**Issue:**

```ts
import { isInProgress, isUnknownFormatFailed } from '@/lib/utils/import-status'
// ...
export { isInProgress }
```

`isInProgress` is imported and immediately re-exported. It is not called anywhere in the component; the early-return guards at lines 25 and 37 manually check `row.status === 'analyzing'` and `row.status === 'importing'` rather than using the utility. The re-export leaks a utility function through a UI component module boundary, contrary to the project's layering convention (`lib/utils/` for utilities, `components/` for UI). A linter auto-removing the import would silently break the re-export.

**Fix:** Either use `isInProgress` inside the component for the early-return logic and keep the re-export intentional, or remove the re-export and have consumers import directly from `@/lib/utils/import-status`. The simpler fix is:

```tsx
// Replace both early-return blocks with:
if (isInProgress(row)) {
  const label = row.status === 'analyzing' ? 'Analisi…' : 'Importazione…'
  const ariaLabel = row.status === 'analyzing'
    ? 'Analisi in corso, nessuna azione disponibile'
    : 'Importazione in corso, nessuna azione disponibile'
  return (
    <div className="flex items-center justify-end gap-1.5 text-sm text-muted-foreground" aria-label={ariaLabel}>
      <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
```

Then the re-export is backed by actual usage in the module.

---

_Reviewed: 2026-05-23T10:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
