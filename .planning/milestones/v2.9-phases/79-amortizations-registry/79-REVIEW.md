---
phase: 79-amortizations-registry
reviewed: 2026-07-28T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - app/(app)/amortizations/page.tsx
  - components/amortizations/amortization-summary-header.tsx
  - components/amortizations/amortization-table.tsx
  - components/layout/sidebar.tsx
  - lib/dal/amortization.ts
  - lib/routes.ts
  - lib/utils/amortizations-table-config.ts
  - lib/utils/table-config.ts
  - tests/amortization-registry-dal.test.ts
  - tests/amortization-registry-table.test.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 79: Code Review Report

**Reviewed:** 2026-07-28T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Reviewed the amortizations registry (RSC page, DAL list query, summary header, table, sidebar
nav entry, table config, and both test files) against the project's hard rules: Decimal.js for
money, IDOR-safe server-scoped queries, no synthetic-transaction realization, layering, and the
language convention.

`getAmortizationPlanList` is correctly IDOR-scoped (`WHERE p.user_id = ${userId}`, parameterized
via Drizzle's tagged `sql` template — no injection risk), the RSC page calls `verifySession()`
before querying, and the realize action is a pure deep-link (`transactionDetailHref`) with no
inline transaction/value write, satisfying the ADR 0019 §8 invariant. Monetary aggregation in the
DAL is SQL-side numeric arithmetic (documented exception to the JS Decimal.js rule) and the
client-side aggregation (`computeTotalOpenResidual`) and sort (`sortAmortizationRows`) correctly
use `toDecimal`/`.plus()`/`.comparedTo()` rather than native arithmetic on monetary strings.
`remaining_months`/`totalMonths` are counts, correctly using native `Number()`/subtraction per the
project's stated exemption.

No critical/security issues found. Two warnings: a real UX-visible mismatch between the
"Descrizione" column's sort key and its displayed value, and duplicated correlated-subquery logic
in the DAL that is a maintainability/consistency risk going forward. A few minor info-level
findings round out the review.

## Warnings

### WR-01: "Descrizione" column sorts by raw `description`, but displays `displayTitle`

**File:** `components/amortizations/amortization-table.tsx:59-68` (sort logic) and `:188-196` (cell render)
**Issue:** The Descrizione column cell renders `row.displayTitle` (customTitle when set, else
`description` — see `lib/dal/amortization.ts:111`), but the `description` sort branch in
`sortAmortizationRows` compares `a.description`/`b.description` (the raw, un-fallen-back bank
description):

```ts
if (sort === 'description') {
  return factor * a.description.localeCompare(b.description)
}
```

When a plan's transaction has a `customTitle` that differs meaningfully from the raw bank
`description` (the common case this field exists for), clicking the "Descrizione" header produces
a sort order that does not match the alphabetical order of what the user actually sees in that
column — the visible rows will appear "out of order" relative to the sort the user just requested.
This is not caught by the existing unit tests because `sortAmortizationRows` is tested with
synthetic rows where `description` and `displayTitle` are set to the same string
(`tests/amortization-registry-table.test.ts:60-69` uses only `description`, never varies
`displayTitle` independently).

**Fix:** Sort by `displayTitle` instead of `description` (matching what the column actually shows),
or rename the config/sort key to make explicit which field drives the order:

```ts
if (sort === 'description') {
  return factor * a.displayTitle.localeCompare(b.displayTitle)
}
```

Add a test case that sets `displayTitle` different from `description` and asserts the sort follows
`displayTitle`.

### WR-02: Four near-duplicate correlated subqueries for the same past/future instalment split

**File:** `lib/dal/amortization.ts:54-87`
**Issue:** The same `occurred_at < CURRENT_DATE` / `occurred_at >= CURRENT_DATE` predicate against
`amortization_instalment` is independently re-written four times: once for `consumed_amount`
(`ai`), once for `net_value` (`ai2`), once for `remaining_months` (`ai3`), and once again in
`ORDER BY` (`ai4`). Nothing enforces these four copies stay in sync. A future edit to the cutoff
condition (e.g., switching to `<=` for same-day handling, or adding a `deleted_at IS NULL` filter)
that touches only some of the four copies would silently make `consumed_amount` / `net_value` /
`remaining_months` / sort order numerically inconsistent with each other — a subtle, hard-to-spot
regression, since each subquery is independently "correct" in isolation.

**Fix:** Postgres allows `ORDER BY` to reference the SELECT list's output alias directly, so the
`ai4` subquery is redundant — replace it with `ORDER BY remaining_months ASC, p.id ASC`. For the
remaining three (`ai`, `ai2`, `ai3`), consider a single `LATERAL` join computing
`consumed_amount`/`net_value`/`remaining_months` together (or at minimum, hoist the boundary
`CURRENT_DATE` into a named CTE/subquery referenced by all three), so the cutoff condition exists
in exactly one place.

## Info

### IN-01: `ORDER BY` recomputes a subquery already available as a SELECT alias

**File:** `lib/dal/amortization.ts:81-87`
**Issue:** Same root cause as WR-02 — `ORDER BY (SELECT COUNT(*) ... ai4 ...) ASC, p.id ASC` needlessly
repeats the `remaining_months` computation already produced in the SELECT list.
**Fix:** `ORDER BY remaining_months ASC, p.id ASC`.

### IN-02: `amortizationDetailHref` is unused dead code

**File:** `lib/routes.ts:70-72`
**Issue:** Exported but not called from any of the reviewed files (row links use
`transactionDetailHref`, per the D-D1 deferred-detail-page decision documented in the comment
directly above it). The comment states this is intentional ("provided for future use/consistency
only"), so this is a deliberate placeholder rather than an oversight — flagging for visibility
since unused exports otherwise read as dead code to future maintainers/tools.
**Fix:** No action required if the detail page is genuinely on the near-term roadmap; otherwise
remove until the page exists, and re-add alongside it.

### IN-03: `formatSignedAmount` is a hand-copied duplicate of `ReimbursementTable`'s local helper

**File:** `components/amortizations/amortization-table.tsx:25-38`
**Issue:** The comment explicitly documents this as an intentional mirror of
`components/reimbursements/reimbursement-table.tsx`'s own local `formatSignedAmount`, including
its non-finite fallback convention. Two independent copies of the same non-trivial formatting
logic (currency formatting + non-finite fallback) now exist; a future fix to one (e.g., locale,
fallback wording) is unlikely to be propagated to the other.
**Fix:** Extract to a shared helper (e.g., `lib/utils/format-amount.ts`, which this file already
imports `formatAbsoluteAmount` from) and have both tables consume it.

---

_Reviewed: 2026-07-28T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
