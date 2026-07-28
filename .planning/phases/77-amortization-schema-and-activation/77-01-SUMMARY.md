---
phase: 77-amortization-schema-and-activation
plan: 01
subsystem: database
tags: [drizzle, postgres, decimal.js, server-actions, dialog, pgview]

# Dependency graph
requires:
  - phase: 76-reimbursements-section
    provides: reimbursement/reimbursement_refund tables, effectiveAmount()/isNotSecondary() CTE, expense-group-membership shape
provides:
  - amortization_plan + amortization_instalment tables (D-02/D-05/D-13)
  - ledger_entry_cash / ledger_entry_accrual Postgres VIEWs (D-11 seam, plain pgView per user decision)
  - materializeInstalments / validateMonthsForAmount / maxMonthsForAmount / minimumTwoMonthInstalment (AMORT-03, D-02, D-07)
  - activatePlanTx (D-03/AMORT-02 atomic detach+plan+instalment write)
  - getAmortizationEligibility (D-04..D-07 + outflow-only guard, short-circuit order)
  - "Ammortizza" row-action end-to-end (dialog preview -> Server Action -> atomic write)
  - getOverviewAmountTotals migrated to ledger_entry_cash, LENS-03 byte-identical regression proof
affects: [77-02-undo-and-manual-entry, 77-03-manual-entry-form, 77-04-dal-migration-wave-1, 77-05-dal-migration-wave-2, 77-06-dal-migration-closure, 78-amortization-drift-detection]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ledger_entry seam: one swappable pgView row source per lens (cash/accrual), amount resolved INSIDE the view — not a lens parameter threaded through aggregation functions"
    - "Eligibility guard returns a discriminated-union {eligible: true} | {eligible: false, reason, ...}, shared Italian message formatter kept in a client-safe module so server guard + client tooltip never drift on copy"
    - "Client-side eligibility mirror derived synchronously from already-loaded list-row fields (zero extra round-trips, no loading flash) — server action independently re-checks every guard before any write"
    - "IntersectionObserver incremental-render preview table, sliced from an in-memory array (no server round-trip) — same technique as transaction-table.tsx's loadMoreRef pagination, but the data source is a pure function"

key-files:
  created:
    - lib/services/amortization-math.ts
    - lib/services/amortization-activation.ts
    - lib/services/amortization-guards.ts
    - lib/utils/amortization-guard-messages.ts
    - lib/dal/dashboard-filters.ts
    - lib/validations/amortization.ts
    - lib/actions/amortization.ts
    - components/transactions/activate-amortization-dialog.tsx
    - tests/amortization-math.test.ts
    - tests/amortization-guards.test.ts
    - drizzle/migrations/0033_loud_layla_miller.sql
  modified:
    - lib/db/schema.ts
    - lib/dal/dashboard.ts
    - lib/dal/overview.ts
    - lib/dal/transactions.ts
    - components/transactions/transaction-table.tsx
    - tests/fixtures/reimbursement-seed.ts
    - tests/helpers/reimbursement-test-db.ts
    - tests/reimbursement-regression.test.ts
    - tests/overview-dal.test.ts
    - tests/transaction-table-menu.test.tsx

key-decisions:
  - "ledger_entry_cash/ledger_entry_accrual are plain Postgres VIEWs (pgView), not materialized — resolved at the Task 1 checkpoint by the user: always-fresh reads, zero added query cost vs. today's inline CTE, no refresh infrastructure to build or forget."
  - "not-outflow guard reads the transaction's signed amount directly (toDecimal(amount).isNegative()), never via a subCategory->nature->direction join — an uncategorized transaction has no resolvable direction yet, and 'Spesa a sé' is already offered regardless of categorization state; requiring a join would silently and inconsistently block amortization on every uncategorized row."
  - "Client-side row-action eligibility is derived synchronously from transactionListSelect's already-loaded fields (reimbursementId, amortizationPlanId, groupId, amount) rather than a separate server round-trip — there is no async gap to produce a loading-flash (D-08), and the server action re-validates every guard independently before any write."

patterns-established:
  - "Guard-message sharing: put Italian guard copy in a client-safe util (no 'server-only') imported by both the server-side guard function and the client-side entry-point tooltip, so the two independent checks never drift on wording."
  - "Eligibility-first write ordering: a service function that composes multiple guarded writes (activatePlanTx) calls its eligibility check as the literal first statement, before any row load needed for the write itself — an ineligible request touches zero rows."

requirements-completed: [AMORT-01, AMORT-02, AMORT-03, LENS-03]

coverage:
  - id: D1
    description: "amortization_plan + amortization_instalment schema, migration 0033 applied to the live dev database, ledger_entry_cash/ledger_entry_accrual views confirmed present"
    requirement: "AMORT-01"
    verification:
      - kind: integration
        ref: "information_schema query confirming 4 objects (amortization_plan, amortization_instalment BASE TABLE; ledger_entry_cash, ledger_entry_accrual VIEW) — run via yarn db:migrate + a one-off verification script"
        status: pass
    human_judgment: false
  - id: D2
    description: "Decimal.js instalment materialisation math (materializeInstalments, validateMonthsForAmount, maxMonthsForAmount) — remainder-on-first, day-clamping, minimum-instalment floor"
    requirement: "AMORT-03"
    verification:
      - kind: unit
        ref: "tests/amortization-math.test.ts (15 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Full row-action activation path: dialog preview -> createAmortizationPlan Server Action -> activatePlanTx atomic detach+plan+instalment write, proven end-to-end against real Postgres"
    requirement: "AMORT-02"
    verification:
      - kind: integration
        ref: "tests/amortization-guards.test.ts#a transaction with none of the above is eligible (full activatePlanTx success path assertion)"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-04..D-07 + outflow-only eligibility guards block activation server-side with a specific reason each, and write nothing on failure"
    requirement: "AMORT-01"
    verification:
      - kind: integration
        ref: "tests/amortization-guards.test.ts (7 tests: 6 guard predicates + write-blocking assertions per ineligible reason)"
        status: pass
    human_judgment: false
  - id: D5
    description: "getOverviewAmountTotals migrated to read from ledger_entry_cash (no more effectiveAmount()/isNotSecondary() direct calls); cash-lens totalOut proven byte-identical before/after an amortization plan exists on the transaction"
    requirement: "LENS-03"
    verification:
      - kind: integration
        ref: "tests/reimbursement-regression.test.ts#amortization cash-lens byte-identical (Phase 77, ADR 0019 D-12)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Amortize dialog UI (empty auto-focused months input, live preview, bounded incremental-render table, error-toast-and-stay-open on write failure) matches UI-SPEC's Copywriting Contract and Entry Point Visibility Matrix"
    verification: []
    human_judgment: true
    rationale: "Visual/interaction fidelity to the UI-SPEC (typography, spacing, tooltip placement, preview scroll behavior) requires a human to click through the real dialog in a browser — no automated visual assertion exists for this phase."

# Metrics
duration: resumed session (~2h from interruption point)
completed: 2026-07-28
status: complete
---

# Phase 77 Plan 01: Amortization Schema & Activation Tracer Summary

**amortization_plan/amortization_instalment schema + ledger_entry_cash/accrual Postgres views + Decimal.js instalment math + full "Ammortizza" row-action activation (dialog -> atomic detach+plan+instalment write) + D-04..D-07 eligibility guards + getOverviewAmountTotals migrated with a byte-identical LENS-03 regression proof**

## Performance

- **Duration:** Resumed after a session-limit interruption; this continuation session completed the remaining ~70% of the plan (seam migration finish, full activation write path, dialog UI, table wiring, eligibility guards, all tests) in roughly 2 hours.
- **Completed:** 2026-07-28
- **Tasks:** 3/3 (1 checkpoint:decision — already resolved by the user before this session — + 2 execution tasks)
- **Files modified:** 23 (11 created, 12 modified)

## Accomplishments

- `amortization_plan` + `amortization_instalment` tables and `ledger_entry_cash`/`ledger_entry_accrual` plain Postgres VIEWs migrated onto the live dev database (migration `0033_loud_layla_miller.sql`), confirmed present via `information_schema`.
- Decimal.js-exclusive instalment materialisation (`materializeInstalments`, `validateMonthsForAmount`, `maxMonthsForAmount`, `minimumTwoMonthInstalment`) — remainder folded into the first instalment, per-instalment day-of-month independently clamped to its own target month's last day, €0.01 floor enforced.
- One complete activation entry point: transaction row action -> `ActivateAmortizationDialog` (client-side live preview, bounded max-height incremental-render table for long plans) -> `createAmortizationPlan` Server Action -> `activatePlanTx` (guard-first, then `applyDetachCleanupTx` + plan insert + instalment inserts, all inside one `db.transaction`).
- `getAmortizationEligibility` — D-04 (reimbursement-involved), D-05 (already-amortized), D-06 (expense-group), outflow-only, D-07 (too-small) — checked in a fixed short-circuit order, wired as the literal first step of `activatePlanTx`, and mirrored client-side from already-loaded `transactionListSelect` fields for a zero-round-trip, no-flash row-action gate with a matching Tooltip.
- `getOverviewAmountTotals` rewired to `.from(ledgerEntryCash)`, dropping direct `effectiveAmount()`/`isNotSecondary()` calls; a new real-Postgres regression block proves `totalOut` is byte-identical before and after an amortization plan (with materialized instalments) exists on the same transaction.

## Task Commits

Each task was committed atomically (continuing from the pre-interruption commits):

1. **Pre-interruption — RED: instalment math test** - `e5867ea` (test)
2. **Pre-interruption — GREEN: instalment math** - `6295f1c` (feat)
3. **Pre-interruption — schema + ledger_entry seam** - `4cedbfe` (feat)
4. **Seam-migration finish: dashboard-filters extraction, getOverviewAmountTotals -> ledgerEntryCash** - `7557469` (feat)
5. **Row-action activation: dialog + atomic write + LENS-03 proof** - `78e2e1f` (feat)
6. **Eligibility guards (D-04..D-07 + outflow-only) wired into activation** - `9292f90` (feat)
7. **Prove full activatePlanTx success path against real Postgres** - `cecd89c` (test)

**Plan metadata:** committed alongside this SUMMARY (see final commit below).

## Files Created/Modified

- `lib/db/schema.ts` - `amortizationPlan`/`amortizationInstalment` tables, `ledgerEntryCash`/`ledgerEntryAccrual` plain pgView definitions (pre-interruption work, verified in this session)
- `drizzle/migrations/0033_loud_layla_miller.sql` - generated migration, applied via `yarn db:migrate`
- `lib/services/amortization-math.ts` - `materializeInstalments`, `validateMonthsForAmount`, `maxMonthsForAmount`, `minimumTwoMonthInstalment`
- `lib/services/amortization-activation.ts` - `activatePlanTx` (guard-first, atomic detach+plan+instalment write)
- `lib/services/amortization-guards.ts` - `getAmortizationEligibility`
- `lib/utils/amortization-guard-messages.ts` - shared client-safe Italian guard copy formatter
- `lib/dal/dashboard-filters.ts` - `dateScopedTransactions` (generalized to any row source), `expenseStatusIncludedInDashboardTotals`
- `lib/dal/dashboard.ts` - `getOverviewAmountTotals` migrated to `ledgerEntryCash`; all other call sites updated to the new shared-helper signature (unchanged behavior)
- `lib/dal/overview.ts` - deleted duplicate private helpers, imports the shared ones
- `lib/dal/transactions.ts` - `transactionListSelect.amortizationPlanId` (correlated subquery) + `TransactionListRow.amortizationPlanId`
- `lib/validations/amortization.ts` - `CreateAmortizationPlanSchema`
- `lib/actions/amortization.ts` - `createAmortizationPlan` Server Action
- `components/transactions/activate-amortization-dialog.tsx` - preview dialog (D-01), IntersectionObserver incremental-render table
- `components/transactions/transaction-table.tsx` - "Ammortizza" row action with client-side eligibility gate + Tooltip
- `tests/amortization-math.test.ts` - 15 tests (materialisation math)
- `tests/amortization-guards.test.ts` - 7 tests (6 guard predicates + full activation success/failure write-path proof)
- `tests/fixtures/reimbursement-seed.ts` - `seedAmortizationPlan` fixture
- `tests/helpers/reimbursement-test-db.ts` - `amortization_plan`/`amortization_instalment` added to `FIXTURE_TABLES`
- `tests/reimbursement-regression.test.ts` - LENS-03 byte-identical proof block
- `tests/overview-dal.test.ts` - drizzle-orm mock's `sql()` stubbed `inlineParams()` (needed once `schema.ts` gained module-eval-time `pgView(...).as(...)` calls)
- `tests/transaction-table-menu.test.tsx` - `amortizationPlanId: null` added to the `TransactionListRow` test factory

## Decisions Made

- **ledger_entry seam is a plain Postgres VIEW, not materialized** — resolved by the user at the Task 1 checkpoint before this session; locked into `lib/db/schema.ts` comments and this SUMMARY.
- **not-outflow guard uses the transaction's raw signed amount**, never a category/direction join — documented in `lib/services/amortization-guards.ts` and consistent with "Spesa a sé"'s own gating (works regardless of categorization state).
- **Client-side row-action eligibility is a synchronous mirror of server guards**, not a separate fetch — the row already carries every field needed (`reimbursementId`, `amortizationPlanId`, `groupId`, `amount`), so there is no async gap to produce a D-08 loading-flash.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `tests/overview-dal.test.ts`'s `drizzle-orm` mock crashing on schema import**
- **Found during:** Full-suite verification pass after completing the seam migration commit
- **Issue:** `lib/db/schema.ts`'s `ledgerEntryCash`/`ledgerEntryAccrual` `pgView(...).as(sql\`...\`)` definitions call `query.inlineParams()` at module-eval time (inside the real, unmocked `drizzle-orm/pg-core` view builder). `tests/overview-dal.test.ts` fully mocks `drizzle-orm`'s `sql` tag with a plain object literal lacking `inlineParams`, so importing the real `lib/db/schema.ts` (transitively, via `lib/dal/overview.ts`) threw `TypeError: query.inlineParams is not a function`, failing all 18 tests in that file.
- **Fix:** The mocked `sql()` function now returns an object with a no-op `inlineParams()` (`() => node`), sufficient for the real view builder's `.as()` call to succeed without needing a full SQL AST.
- **Files modified:** `tests/overview-dal.test.ts`
- **Verification:** `vitest run tests/overview-dal.test.ts` — 18/18 pass; full suite (151 files, 1858 tests) green.
- **Committed in:** `78e2e1f` (row-action activation commit)

**2. [Rule 2 - Missing Critical] Added server-side defense-in-depth month validation in `activatePlanTx`**
- **Found during:** Task 2 (row-action activation), while wiring `createAmortizationPlan`
- **Issue:** The plan's threat register (T-77-02) already documents "`validateMonthsForAmount` additionally rejects N whose base instalment would round below €0.01" as the intended mitigation, but the original Step 7/9 action text only specified client-side validation (`CreateAmortizationPlanSchema`'s `min(2)`) plus a dialog-level gate — a tampered/stale request with a technically-valid-but-too-large N could otherwise reach the write.
- **Fix:** `activatePlanTx` re-validates via `validateMonthsForAmount(row.amount, input.months)` immediately after the eligibility guard, before any write.
- **Files modified:** `lib/services/amortization-activation.ts`
- **Verification:** Covered implicitly by every guard test exercising `activatePlanTx`; no test currently exercises the "valid Zod schema but too-large N" case specifically, but the code path matches the plan's own documented threat mitigation.
- **Committed in:** `78e2e1f`

**3. [Rule 2 - Missing Critical] Shared client-safe guard-message module**
- **Found during:** Task 3 (eligibility guards), wiring the client-side row-action tooltip
- **Issue:** The plan's Step-level guidance says to "reuse the reimbursement/already-amortized/expense-group/too-small text verbatim" in both the server guard and the client entry point, but `lib/services/amortization-guards.ts` carries a `'server-only'` import — any module importing from it (even just its message-formatting logic) would be poisoned for client-component use.
- **Fix:** Extracted the five Italian guard messages + their reason-type definitions into `lib/utils/amortization-guard-messages.ts` (no `'server-only'`), imported by both `lib/services/amortization-activation.ts` (server) and `components/transactions/transaction-table.tsx` (client) — guaranteeing the two independent eligibility checks never drift on copy.
- **Files modified:** `lib/utils/amortization-guard-messages.ts` (new), `lib/services/amortization-guards.ts`, `lib/services/amortization-activation.ts`, `components/transactions/transaction-table.tsx`
- **Verification:** `tsc --noEmit` clean; `tests/amortization-guards.test.ts` asserts the exact message strings server-side.
- **Committed in:** `9292f90`

---

**Total deviations:** 3 auto-fixed (1 bug fix, 2 missing-critical additions)
**Impact on plan:** All three were necessary for correctness (test suite integrity) or already-documented security mitigations (T-77-02) that the original action text under-specified. No scope creep, no architectural changes, no user decision required.

## Issues Encountered

- The previous executor was interrupted mid-Step-5 (the `dashboard-filters.ts` extraction), leaving `lib/dal/dashboard.ts` with 8 remaining `dateScopedTransactions(userId, ...)` call sites still on the old 3-argument signature after the function itself had already been generalized to accept a `source` parameter first. Resolved by updating all remaining call sites in both `dashboard.ts` and `overview.ts` to pass `transactionTable` explicitly (unchanged behavior, migration to `ledgerEntryCash` for the other 9 aggregation functions deferred to Plans 77-04/77-05 as planned).
- `tests/amortization-guards.test.ts`'s eligible-transaction success-path assertion initially expected `activatePlanTx` to always return a NEW expense id; `applyDetachCleanupTx`'s 1:1 (single-transaction-source) branch re-hashes the EXISTING expense in place instead, so the assertion was corrected to expect the SAME expense id with a new synthetic `descriptionHash` (matches `transaction-detach.ts`'s documented behavior, not a bug).

## User Setup Required

None - no external service configuration required. `yarn db:migrate` was run against the local dev database (`sparter`) as part of this plan's Step 3 [BLOCKING] requirement; production/staging deploy still needs the standard `yarn db:migrate` step per `CLAUDE.md`'s migration-order convention (no seed/seed-extras/seed-patterns step needed — no new seeded taxonomy rows in this plan).

## Next Phase Readiness

- Schema, seam, math, guards, and one full activation entry point are proven end-to-end against real Postgres — the architecture Plans 77-02 (undo path) and 77-03 (manual-entry activation) will reuse directly (`activatePlanTx`, `getAmortizationEligibility`, `materializeInstalments` are all already composable/importable).
- `lib/dal/overview.ts` and `lib/dal/tags.ts` still have 9 aggregation functions reading `transactionTable` + `effectiveAmount()`/`isNotSecondary()` directly — Plans 77-04/77-05/77-06 migrate these to `ledgerEntryCash` and close the full LENS-03 gate (this plan only proves `getOverviewAmountTotals`, as scoped).
- `ledger_entry_accrual` is defined in the schema/migration but unconsumed until Phase 80 wires the accrual-lens reads (documented in a schema.ts comment).
- No blockers identified for the next wave.

---
*Phase: 77-amortization-schema-and-activation*
*Completed: 2026-07-28*
