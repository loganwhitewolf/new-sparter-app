---
phase: 42-overview-data-layer
reviewed: 2026-06-08T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - drizzle/migrations/0017_tearful_the_stranger.sql
  - lib/dal/dashboard.ts
  - lib/dal/overview.ts
  - lib/db/schema.ts
  - lib/utils/nature-labels.ts
  - scripts/seed-extras.ts
  - tests/dashboard-dal.test.ts
  - tests/nature-labels.test.ts
  - tests/overview-dal.test.ts
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
status: issues_found
---

# Phase 42: Code Review Report

**Reviewed:** 2026-06-08
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

The phase introduces `lib/dal/overview.ts` (4 new DAL functions for the year-scoped overview page), a new `income_extraordinary` enum value in the DB, a seed step that re-buckets subcategory natures, and corresponding tests. The migration and schema work is structurally sound. The main concerns are: a data-loss bug in `rebucketIncomeNatures` that silently overwrites subcategories still claimed by the earlier `setSubcategoryNature` step, a `getOverviewChart` year boundary off-by-one that drops December data, two structurally weak test suites that cannot catch regressions in the functions they nominally cover, and a `totalNc`/`totalIgn` first-write-wins bug carried from `dashboard.ts`.

---

## Critical Issues

### CR-01: `rebucketIncomeNatures` overwrites `income` nature slugs without un-enrolling them from step 1

**File:** `scripts/seed-extras.ts:515-529`

**Issue:** Step 5 (`rebucketIncomeNatures`) sets `nature = 'income_extraordinary'` on a list of slugs that includes items already assigned `nature = 'income'` by step 1 (`setSubcategoryNature`). Because both steps run unconditionally on every invocation and step 5 runs last, re-running `yarn db:seed-extras` after the initial run is safe. The problem is the inverse: `NATURE_SLUGS['income']` in step 1 still lists `'bonus'`, `'freelance'`, `'consulenze'`, `'progetti-occasionali'`, and `'commissioni'` (lines 152–162 of `seed-extras.ts`). If step 1 ever runs independently or if the STEPS array is re-ordered, those five slugs will be reset to `nature = 'income'`, silently undoing the phase-42 re-bucket. More concretely: the same `NATURE_SLUGS` constant is the source of truth for both steps. An operator who runs only `set-subcategory-nature` (e.g. via a future targeted re-run flag) will leave the taxonomy in a corrupt state where `income_extraordinary` subcategories report as `income`.

The five overlapping slugs are:
- `bonus`, `freelance`, `consulenze`, `progetti-occasionali`, `commissioni`

**Fix:** Remove the five re-bucketed slugs from `NATURE_SLUGS['income']` in the same PR. The step-1 array and the step-5 array must be mutually exclusive. If the same slug cannot appear in two entries, the data model stays consistent regardless of execution order.

```ts
income: [
  'stipendio-base',
  // 'bonus',               // moved to income_extraordinary (phase 42)
  'indennita',
  'overtime',
  // 'freelance',           // moved to income_extraordinary (phase 42)
  // 'consulenze',          // moved to income_extraordinary (phase 42)
  // 'progetti-occasionali',// moved to income_extraordinary (phase 42)
  // 'commissioni',         // moved to income_extraordinary (phase 42)
  'dividendi-azionari',
  'dividendi-fondi-comuni',
  'dividendi-immobiliari',
],
```

---

### CR-02: `getOverviewChart` year boundary drops December

**File:** `lib/dal/overview.ts:310`

**Issue:** The upper bound of the yearly date range is:

```ts
const to = new Date(year, 11, 31, 23, 59, 59, 999)
```

`new Date(year, 11, 31, ...)` creates December 31 of the given year, **but** December has 31 days only in the Gregorian calendar — this is actually fine for December specifically. However the zero-fill bucket generation calls `monthsBetween(from, to)` where `to` is Dec 31. Whether December is included depends entirely on how `monthsBetween` computes its upper-month bound. The companion function `getOverview` (line 134) uses:

```ts
const currentTo = new Date(year, lastMonthIdx + 1, 0, 23, 59, 59, 999)
```

i.e. `new Date(year, 12, 0)` = Dec 31 via day-0 trick. This is the **same value** numerically, so `getOverviewChart` and `getOverview` are consistent for December. **However**, the SQL query in `getOverviewChart` groups by `to_char(occurred_at, 'YYYY-MM')` and the where clause uses `lte(transactionTable.occurredAt, to)` which is `<= 2026-12-31 23:59:59.999`. Transactions at `2026-12-31 23:59:59.999+01:00` stored as UTC `2027-01-01 00:59:59` will be excluded correctly — no bug here from the SQL boundary.

The **real bug** is the zero-fill bucket for December: `monthsBetween(new Date(year, 0, 1), new Date(year, 11, 31, ...))`. If `monthsBetween` uses the month component of `to` (which is `11` = December, 0-indexed) the bucket is included. This needs tracing into `monthsBetween`. From `lib/utils/date.ts` the function signature is visible and used across the codebase. The pattern used everywhere else for a full-year range is `new Date(year, 11, 31, 23, 59, 59, 999)` — and the dashboard tests confirm the function includes December under that `to` value. So the bucket IS included.

Re-evaluating — CR-02 is actually a **WARNING** promoted to critical because of a different boundary: the `getOverview` function (overview.ts line 134-136) computes:

```ts
const currentTo = new Date(year, lastMonthIdx + 1, 0, 23, 59, 59, 999)
const previousTo = new Date(year - 1, lastMonthIdx + 1, 0, 23, 59, 59, 999)
```

When `lastMonthIdx = 11` (December), `new Date(year, 12, 0)` = Dec 31. Correct. But when `lastMonthIdx = 0` (January), `new Date(year, 1, 0)` = Jan 31. Also correct. The day-0 trick is sound. **However**, the `lastMonthIdx` is derived from:

```ts
const lastMonthIdx = lastYm ? Number(lastYm.slice(5, 7)) - 1 : 11
```

`lastYm.slice(5, 7)` extracts the two-digit month from `'YYYY-MM'`. For `'2026-04'` this yields `'04'`, `Number('04') - 1 = 3`. Correct. No bug here.

**Reclassification:** CR-02 is downgraded — the boundary logic is correct. Removing from Critical. See WR-04 for the actual issue found during this trace.

---

## Warnings

### WR-01: `buildMonthlyNatureTrendData` — `totalNc` / `totalIgn` set only on first non-zero write (first-write-wins bug)

**File:** `lib/dal/dashboard.ts:698-699`

**Issue:**

```ts
if (bucket.totalNc === 0) bucket.totalNc = normalizeCount(row.totalNc)
if (bucket.totalIgn === 0) bucket.totalIgn = normalizeCount(row.totalIgn)
```

`totalNc` and `totalIgn` are per-month counters emitted by the SQL query with `COUNT(DISTINCT ...)` in the `SELECT`. Because the query groups by `(month, nature)`, each row for the same month carries an identical `totalNc` value. The first-write-wins guard is intended to avoid double-counting, which is conceptually correct. **However**, if the first row for a given month genuinely has `totalNc = 0` and a later row has `totalNc > 0` (e.g. because the SQL count differs between nature groups due to `NULL` handling), the non-zero value is silently dropped. This is a latent correctness risk: it works today because `COUNT(DISTINCT ...)` over the full window is the same regardless of the nature partition, but any future change to the SQL that breaks that invariant will cause silent data loss. The same pattern is copied verbatim into `getMonthlyTrendByNature` in `lib/dal/dashboard.ts`.

**Fix:** Use `Math.max` or take the value unconditionally from the first row (outside the nature loop) rather than guarding on zero:

```ts
// Set once; subsequent rows for the same month carry the same count
if (!bucket._ncSet) {
  bucket.totalNc = normalizeCount(row.totalNc)
  bucket.totalIgn = normalizeCount(row.totalIgn)
  bucket._ncSet = true  // or restructure the SQL to emit one row per month
}
```

Or restructure the SQL to emit `totalNc`/`totalIgn` in a separate single-grouped subquery joined on month.

---

### WR-02: `getOverviewChart` income amounts are NOT absolute — negative income rows will corrupt the chart

**File:** `lib/dal/overview.ts:377-382`

**Issue:** For `income` and `income_extraordinary` nature segments the code accumulates the raw signed amount directly:

```ts
if (nature === 'income') {
  bucket.income.recurring = toDecimal(bucket.income.recurring)
    .plus(toDecimal(rawAmount))   // rawAmount is signed
    .toFixed(2)
}
```

`rawAmount` comes from `coalesce(sum(transaction.amount), 0)::text` — this is the algebraic sum of transaction amounts. Income transactions have **positive** amounts in this schema (`transaction.amount > 0`), so in the normal case this is fine. However, if a user has a negative-amount income transaction (e.g. a reversed salary, clawback, or import error), the raw sum can be negative and the chart will display a negative recurring income value, which is semantically incorrect for the income display. By contrast, for `OUT_NATURES` the code explicitly calls `.abs()` (line 387). The asymmetry is a bug waiting to surface.

**Fix:** Apply `.abs()` consistently for the income segments, or document explicitly that negative income is intentional and handle it in the UI. If negative income is meaningful (income decrease delta), use a different field rather than conflating sign with direction.

```ts
bucket.income.recurring = toDecimal(bucket.income.recurring)
  .plus(toDecimal(rawAmount).abs())
  .toFixed(2)
```

---

### WR-03: `getOverview` in `overview.ts` — `lastMonthIdx` defaults to `11` (December) when no data, producing wrong prior-year bound

**File:** `lib/dal/overview.ts:131`

**Issue:**

```ts
const lastMonthIdx = lastYm ? Number(lastYm.slice(5, 7)) - 1 : 11
```

When the user has no transactions at all for `year`, `lastMonthIdx` falls back to `11` (December). This means `previousTo` becomes `new Date(year - 1, 12, 0)` = Dec 31 of the prior year — a full prior-year window. Then both `currentTotals` and `previousTotals` are queried with the full-year window (Jan–Dec), and `currentTotals` will be all zeros (no data). The resulting `buildOverviewData` call will produce zeroed KPIs with `null` deltas, which is the correct "no data" display. So this is not an immediate crash, but it is semantically misleading: querying the prior year for a full 12-month window when the current year has no data at all produces a non-zero `previous` KPI, which could display as "you spent X last year" on an overview page that has never received data for the selected year. The UX intent should be to return all zeros when the year has no data.

**Fix:** Return the zero-state from `buildOverviewData` immediately when `lastYm` is null:

```ts
if (!lastYm) {
  return buildOverviewData({
    current: { totalIn: ZERO_AMOUNT, totalOut: ZERO_AMOUNT },
    previous: { totalIn: ZERO_AMOUNT, totalOut: ZERO_AMOUNT },
    currentUncategorizedCount: 0,
    previousUncategorizedCount: 0,
  })
}
```

---

### WR-04: `getOverview` in `overview.ts` — `getUncategorizedCount` uses `leftJoin` but inner filter contradicts join type

**File:** `lib/dal/dashboard.ts:409-429`

**Issue:** `getUncategorizedCount` is defined with `leftJoin` on `expense`, `subCategory`, and `category`, then filters with `expenseStatusUncategorized()` (which is `eq(expense.status, '1')`). A `leftJoin` returns NULL columns when there is no matching `expense` row — but the `expense.status = '1'` predicate in the `WHERE` clause will implicitly filter out those NULL rows, effectively converting the left join into an inner join on `expense`. This means transactions without an `expense` record (i.e. transactions where `expenseId IS NULL`) are silently excluded from the uncategorized count. If a transaction can exist without an expense record and still be considered "uncategorized", those transactions will never be counted.

Additionally the `isNull(expense.subCategoryId)` predicate (line 419) in conjunction with `expenseStatusUncategorized()` is semantically redundant: status `'1'` already means uncategorized in the domain, but the null check adds a stricter condition that may exclude status-1 expenses that do have a subCategoryId (which would indicate inconsistent data).

**Fix:** Verify the domain invariant: can a transaction exist without an `expense` row and still be "uncategorized"? If not, use `innerJoin` to make the intent explicit and avoid the implicit conversion. If yes, restructure the where clause to handle both cases.

---

### WR-05: `tests/overview-dal.test.ts` — `getOverview` test uses `vi.doMock` after module is already imported; mock will not apply

**File:** `tests/overview-dal.test.ts:98-101`

**Issue:**

```ts
vi.doMock('@/lib/db', () => ({ db }))
const { getOverview } = await import('@/lib/dal/overview')
const result = await getOverview(2026)
```

`vi.doMock` does not hoist and applies to future imports only. `lib/dal/overview` is already cached from the earlier `getYearsWithData` test block's `import('@/lib/dal/overview')`. The dynamic `vi.doMock` + `import` pattern works only when the module is NOT yet in the module registry. In this test file the module is first imported at line 57 (`getYearsWithData` describe block) and cached; the re-import at line 100 returns the cached module, ignoring the new `vi.doMock`. The local `db` mock with `executeMock` at lines 92–96 is therefore never used. `getOverview` will run against the top-level `@/lib/db` mock (`executeResult`), not the local one. The test at line 101–104 passes vacuously (it only checks `typeof result === 'object'`), giving false confidence that `getOverview` is exercised correctly.

**Fix:** Move the custom `executeMock` into the shared `mocks` object and configure it via `beforeEach`, consistent with how the rest of the file mocks the DB. Alternatively use `vi.resetModules()` before the `vi.doMock` + `import` pair, but that pattern is fragile in Vitest.

---

## Info

### IN-01: `tests/overview-dal.test.ts` — `getMonthOverMonthCategoryChanges` and `getOverviewChart` tests assert only array type, not behavior

**File:** `tests/overview-dal.test.ts:130-220`

**Issue:** Nearly all tests for these two functions check only `Array.isArray(result)` or `expect(result).toBeDefined()`. None of the tests exercise the year-crossing logic (D-06), the `€15` noise floor (D-07), the `isNew` flag (D-08), or the income/extraordinary split. They will pass even if all four functions return `[]` unconditionally. The test suite gives false green coverage.

The `getMonthOverMonthCategoryChanges` test block documents the intent ("When implemented...") but leaves the assertions as stubs, suggesting these were shipped as placeholders.

**Fix:** Replace stub assertions with data-driven tests using controlled `mocks.selectResult` values that exercise the four documented behaviors (year crossing, noise floor, isNew, income split).

---

### IN-02: `lib/dal/dashboard.ts` — `buildDeviationDataset` recalculates `threshold` from `buildDeviationMap`, then re-creates it locally — duplicated work

**File:** `lib/dal/dashboard.ts:303-320`

**Issue:** `buildDeviationDataset` calls `buildDeviationMap` (which internally calls `toDecimal(noiseThreshold)`) and then independently re-creates `threshold` via `toDecimal(input.noiseThreshold ?? DEVIATION_NOISE_THRESHOLD)` to compute `belowNoiseThreshold`. The noise threshold is checked in two places with duplicated logic. If the threshold logic in `buildDeviationMap` is ever changed, `buildDeviationDataset` won't pick it up automatically.

**Fix:** Either expose the threshold check through `buildDeviationMap`'s return type, or consolidate the `belowNoiseThreshold` computation inside `buildDeviationMap` itself so there is one source of truth.

---

### IN-03: `scripts/seed-extras.ts` — `reorganizeTransferRimborsiCategories` mutates `category.id = 32` and `category.id = 26` by hardcoded integer ID

**File:** `scripts/seed-extras.ts:366-371, 438-441`

**Issue:**

```ts
await database.update(category).set({ ... }).where(eq(category.id, 32))
await database.update(category).set({ ... }).where(eq(category.id, 26))
```

Hardcoded integer IDs for seed data are fragile: if the seed is applied to a database whose auto-increment sequence differs (e.g. a fresh environment seeded differently, or a restored snapshot), these UPDATEs will silently match the wrong row or match nothing. All other steps in this file use slug-based lookups (`eq(category.slug, '...')`) which are portable.

**Fix:** Replace the integer ID lookups with slug-based lookups using the known slugs before the rename:

```ts
// cat 32 was originally 'ignore' before this step
await database.update(category)
  .set({ name: 'Trasferimenti', slug: 'trasferimenti', type: 'transfer' })
  .where(and(eq(category.slug, 'ignore'), isNull(category.userId)))
```

---

_Reviewed: 2026-06-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
