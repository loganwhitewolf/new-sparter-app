---
phase: 79-amortizations-registry
plan: 01
subsystem: ui
tags: [nextjs, rsc, drizzle, decimal.js, data-table]

# Dependency graph
requires:
  - phase: 78-plan-lifecycle-and-reconciliation
    provides: amortizationPlan/amortizationInstalment schema (status open/closed, totalAmount snapshot, months), closePlanTx/realizePlanTx/reducePlanTx lifecycle services
  - phase: 76-reimbursements-section (v2.8)
    provides: the RSC-page + DataTableToolbar + useToolbarSort + HeaderSortButton + EmptyState list-page stack this registry structurally mirrors
provides:
  - getAmortizationPlanList(userId) DAL query (open+closed, Decimal-precise consumed/net, IDOR-safe)
  - /amortizations RSC page + AmortizationTable interactive client table (search/status filter/sort)
  - AmortizationSummaryHeader (total open net residual KPI, D-B1)
  - AMORTIZATIONS_TABLE_CONFIG, widened TableConfig['id'] union, APP_ROUTES.amortizations, amortizationDetailHref, sidebar nav entry
affects: [79-02 (row actions — close/realize, REG-02), 80-dashboard-accrual-lens]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Raw-SQL DAL list query with explicit table aliases (p/t) and correlated scalar subqueries for SQL-side Decimal-precise aggregation, mirroring getReimbursementList"
    - "Client-side status-filter default override (resolveEffectiveStatusFilter) that intentionally diverges from the shared toolbar's generic 'absent param = show all' convention"

key-files:
  created:
    - lib/dal/amortization.ts
    - app/(app)/amortizations/page.tsx
    - components/amortizations/amortization-table.tsx
    - components/amortizations/amortization-summary-header.tsx
    - lib/utils/amortizations-table-config.ts
    - tests/amortization-registry-dal.test.ts
    - tests/amortization-registry-table.test.ts
  modified:
    - lib/utils/table-config.ts
    - lib/routes.ts
    - components/layout/sidebar.tsx

key-decisions:
  - "COUNT(*) subquery for remainingMonths returns a Postgres bigint, which node-postgres surfaces as a string — coerced via Number() in the DAL mapping (Rule 1 bug fix, caught by the DAL test)"
  - "IDOR cross-user test fixture seeds direction/nature taxonomy ONCE per test (global unique(code) tables) and reuses the same subCategoryId across both users' expenses, rather than calling seedMinimalTaxonomy twice"

patterns-established:
  - "resolveEffectiveStatusFilter(statusParam): 'open' | 'closed' as the exported pure predicate for a table's client-side default-status override, unit-testable without jsdom"

requirements-completed: [REG-01, REG-03]

coverage:
  - id: D1
    description: "getAmortizationPlanList(userId) returns every plan (open+closed) owned by userId, IDOR-safe, Decimal-precise consumed/net, deterministic remainingMonths ASC + id ASC ordering, and the customTitle-trim-or-description displayTitle fallback"
    requirement: "REG-01"
    verification:
      - kind: integration
        ref: "tests/amortization-registry-dal.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "/amortizations RSC page + AmortizationTable render every column (description link, date, initial/consumed/net amounts, X/N + progress bar, open/closed badge), default-sorted by remainingMonths ascending, with a status filter defaulting to open-only"
    requirement: "REG-03"
    verification:
      - kind: unit
        ref: "tests/amortization-registry-table.test.ts"
        status: pass
    human_judgment: true
    rationale: "Visual rendering (progress bar fill, badge color, truncation, toolbar reflow, EmptyState variants) is not exercised by an automated test in this phase — the plan's own must_haves flag these as backstop/held-out UI-state checks for human/manual verification."
  - id: D3
    description: "AmortizationSummaryHeader shows the total open net residual (Decimal.js sum, excludes closed plans), mounted only when the account has at least one plan of any status"
    requirement: "REG-01"
    verification:
      - kind: unit
        ref: "tests/amortization-registry-table.test.ts#computeTotalOpenResidual"
        status: pass
    human_judgment: false

# Metrics
duration: ~10min
completed: 2026-07-28
status: complete
---

# Phase 79 Plan 1: Amortizations registry — DAL, page, table, summary header Summary

**`/amortizations` registry page listing every amortization plan (open+closed) with Decimal-precise consumed/net values, an open-only-by-default status filter, an X/N + progress-bar months column, and a single total-open-net-residual KPI — reusing the v2.8 `/reimbursements` RSC/DAL/table stack.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-07-28
- **Tasks:** 2 (Task 1 tracer + Task 2 expansion)
- **Files modified:** 10 (7 new, 3 modified)

## Accomplishments
- `getAmortizationPlanList(userId)` — one raw-SQL DAL query returning every plan (open+closed), IDOR-safe by construction (WHERE p.user_id = ${userId} is the only outer-query predicate), with SQL-side Decimal-precise consumed/net derivation and deterministic remainingMonths ASC + id ASC ordering
- `/amortizations` RSC page → `AmortizationTable` interactive client component (search + status filter + sort, URL-backed via the shared `DataTableToolbar`/`useToolbarSort` stack)
- `resolveEffectiveStatusFilter` implements D-C1's deliberate override of the toolbar's generic "no param = show all" convention (defaults to open-only)
- `AmortizationSummaryHeader` — total open net residual KPI (D-B1), Decimal.js-summed, excludes closed plans, `€0,00` fallback
- Sidebar nav entry, route constants, and the widened `TableConfig['id']` union

## Task Commits

Each task was committed atomically:

1. **Task 1: Amortizations registry — DAL, page, interactive table, route, nav (D-B2/C1/C2/C3/D1)** - `202e0a58` (feat, tracer)
2. **Task 2: Summary header — total open net residual (D-B1)** - `3ae889a3` (feat)

## Files Created/Modified
- `lib/dal/amortization.ts` - `getAmortizationPlanList(userId)`, `AmortizationPlanListRow` type
- `app/(app)/amortizations/page.tsx` - RSC page: verifySession → DAL → EmptyState / summary + table
- `components/amortizations/amortization-table.tsx` - interactive table, `sortAmortizationRows`, `resolveEffectiveStatusFilter`
- `components/amortizations/amortization-summary-header.tsx` - `computeTotalOpenResidual`, `AmortizationSummaryHeader`
- `lib/utils/amortizations-table-config.ts` - `AMORTIZATIONS_TABLE_CONFIG`
- `lib/utils/table-config.ts` - widened `TableConfig['id']` union to include `'amortizations'`
- `lib/routes.ts` - `APP_ROUTES.amortizations`, `amortizationDetailHref`
- `components/layout/sidebar.tsx` - `Ammortamenti` nav entry (CalendarClock icon)
- `tests/amortization-registry-dal.test.ts` - real-Postgres DAL test (6 cases)
- `tests/amortization-registry-table.test.ts` - jsdom-free pure-function tests (11 cases)

## Decisions Made
- `remainingMonths` maps a Postgres `COUNT(*)` bigint (returned as a string by node-postgres) through `Number()` in the DAL row mapper — caught by the DAL test asserting `toBe(2)` against a string `'2'` (Rule 1 auto-fix).
- The IDOR cross-user DAL test seeds the global `direction`/`nature` taxonomy tables (unique on `code`) exactly once per test and reuses that `subCategoryId` for the second user's expense, since `seedMinimalTaxonomy` is not designed to be called twice within one test (it would violate `direction_code_unique`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `remaining_months` bigint-as-string coercion**
- **Found during:** Task 1 (DAL test run)
- **Issue:** Postgres `COUNT(*)` returns `bigint`, which node-postgres surfaces as a JS `string` (not `number`) to avoid silent precision loss — `row.remaining_months` was typed and returned as a raw string (`'2'`) instead of a number, breaking `AmortizationPlanListRow.remainingMonths: number` and the sort/display contract.
- **Fix:** Typed the raw row field as `string` and wrapped it in `Number(...)` in the DAL's row-mapping step (a plan's remaining-months count never approaches `Number.MAX_SAFE_INTEGER`, so the coercion is safe).
- **Files modified:** `lib/dal/amortization.ts`
- **Verification:** `tests/amortization-registry-dal.test.ts` (consumedAmount/netValue/remainingMonths precision test) passes with `expect(row.remainingMonths).toBe(futureCount)` as a strict number equality.
- **Committed in:** `202e0a58` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary correctness fix caught by the plan's own real-Postgres test; no scope creep.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- REG-01 and REG-03 fully delivered: the registry lists every plan with all mandated columns, correct Decimal precision, an open/closed badge, and an open-only-by-default status filter.
- REG-02 (close/realize row actions) is explicitly deferred to Plan 79-02, per this plan's `must_haves` — `components/amortizations/amortization-table.tsx` contains zero "Azioni" occurrences and no row-action Button/Link, confirmed by grep.
- Held-out UI-state checks (loading/skeleton treatment, overflow at extreme magnitudes, toolbar reflow on mobile, empty-state degradation) are flagged as `backstop` in the plan's `must_haves` and are not exercised by an automated test in this phase — left for human/manual verification.

## Self-Check: PASSED

All 7 created files verified present on disk; both task commits (`202e0a58`, `3ae889a3`) verified in `git log`.

---
*Phase: 79-amortizations-registry*
*Completed: 2026-07-28*
