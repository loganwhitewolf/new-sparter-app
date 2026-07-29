---
phase: 80-dashboard-accrual-lens
plan: 01
subsystem: dashboard
tags: [nextjs, drizzle, postgres, decimal.js, react, url-state, sessionstorage]

# Dependency graph
requires:
  - phase: 77-amortization-schema-and-activation
    provides: ledgerEntryCash/ledgerEntryAccrual Postgres views (the swappable row-source seam), materializeInstalments, amortization_plan/amortization_instalment schema
provides:
  - "LedgerRowSource type + resolveLedgerRowSource(lens) — the single place a Lens resolves to a concrete row source (lib/dal/dashboard-filters.ts)"
  - "Lens type + parseLensParam(value) — the single place ?lens= is ever parsed from raw input (lib/utils/search-params.ts)"
  - "lens-persistence.ts (LENS_STORAGE_KEY, readSavedLens, saveLens) and lens-switch.tsx (LensSwitch component) — reusable by every later Phase 80 plan"
  - "getOverviewAmountTotals + getOverview both gain an optional trailing ledgerRowSource parameter, defaulting to cash (zero behavior change for existing callers)"
  - "/dashboard/overview renders the Cassa/Competenza switch and its KPI totals thread the selected lens end-to-end"
  - "tests/amortization-lens-regression.test.ts — new real-Postgres regression proving cash byte-identical + accrual instalment-sum correctness"
affects: [80-02, 80-03, 80-04, 80-05, 80-06, 80-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ledger_entry seam consumption: an aggregation function accepts an optional LedgerRowSource parameter (default ledgerEntryCash) and swaps its FROM/dateScopedTransactions target — never threads a lens string into WHERE/amount logic"
    - "URL-canonical + sessionStorage-restore-layer for a second piece of dashboard view state (lens), reusing the exact year-selector shape (ADR 0009/0010)"

key-files:
  created:
    - components/dashboard/lens-persistence.ts
    - components/dashboard/lens-switch.tsx
    - tests/amortization-lens-regression.test.ts
    - tests/lens-persistence.test.ts
  modified:
    - lib/dal/dashboard-filters.ts
    - lib/dal/dashboard.ts
    - lib/dal/overview.ts
    - lib/utils/search-params.ts
    - components/dashboard/overview/overview-header.tsx
    - app/(app)/dashboard/overview/page.tsx
    - tests/helpers/reimbursement-test-db.ts
    - tests/table-search-params.test.ts

key-decisions:
  - "requirements.mark-complete NOT run for LENS-01/LENS-02 — this plan delivers only the ONE-route tracer slice (Overview KPI totals); LENS-01 ('every widget... one global control') and LENS-02 ('every dashboard widget... reflects instalments') require the remaining nine aggregation sites and three routes (Plans 80-02..80-07), consistent with the Phase 73-76 precedent of deferring requirements.mark-complete until the full capability ships (e.g. 75-01/75-02/75-03/76-01)"
  - "getUncategorizedCount stays lens-invariant (no ledgerRowSource parameter) — an amortized transaction is always categorized before a plan can attach (D-04's activation guard), so an instalment can never itself be uncategorized; closes the seam survey's flagged 'Confirm' note"
  - "lens-persistence.ts re-exports safeSessionStorage from overview/overview-persistence.ts so lens-switch.tsx (a sibling of the overview/ directory) has one import path for both lens persistence and the shared storage helper, without duplicating it"

patterns-established:
  - "Lens row-source resolution: resolveLedgerRowSource(lens) is the ONLY function that ever turns a validated Lens into a concrete ledgerEntryCash/ledgerEntryAccrual reference — every DAL call site receives the resolved row source, never the lens string itself"
  - "parseLensParam is the ONLY place ?lens= is parsed from raw input across the whole phase, built on the existing parseStatus(value, allowed) primitive"

requirements-completed: []

# Coverage metadata
coverage:
  - id: D1
    description: "parseLensParam validates ?lens= to exactly 'cassa'|'competenza', defaulting to 'cassa' on absent/garbage/array input (T-80-01 mitigation, D-02)"
    requirement: "LENS-01"
    verification:
      - kind: unit
        ref: "tests/table-search-params.test.ts#parseLensParam"
        status: pass
    human_judgment: false
  - id: D2
    description: "resolveLedgerRowSource resolves a Lens to the exact ledgerEntryCash/ledgerEntryAccrual view object"
    requirement: "LENS-01"
    verification:
      - kind: unit
        ref: "tests/table-search-params.test.ts (parseLensParam suite, exercised transitively via getOverviewAmountTotals's default-param contract)"
        status: pass
      - kind: integration
        ref: "tests/amortization-lens-regression.test.ts#dashboard accrual lens — getOverviewAmountTotals seam"
        status: pass
    human_judgment: false
  - id: D3
    description: "readSavedLens/saveLens mirror the year-selector's try/catch-degrade-silently sessionStorage contract"
    verification:
      - kind: unit
        ref: "tests/lens-persistence.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "getOverviewAmountTotals stays byte-identical under cassa (LENS-03 regression) and sums only in-range instalments under competenza"
    requirement: "LENS-03"
    verification:
      - kind: integration
        ref: "tests/amortization-lens-regression.test.ts#dashboard accrual lens — getOverviewAmountTotals seam (real Postgres)"
        status: pass
      - kind: integration
        ref: "tests/reimbursement-regression.test.ts (full suite, unmodified, run against the new ledgerRowSource parameter)"
        status: pass
    human_judgment: false
  - id: D5
    description: "/dashboard/overview renders a Cassa/Competenza LensSwitch next to the year selector; clicking it updates ?lens= and the KPI totals reflect the selected lens"
    requirement: "LENS-01"
    verification:
      - kind: automated_ui
        ref: "yarn build (production build succeeds, /dashboard/overview route compiles and registers; typecheck clean)"
        status: pass
    human_judgment: true
    rationale: "The interactive click-through (URL flip + visual KPI change) requires a live browser session; this sandbox has no browser-automation tool. The underlying data-correctness (which lens produces which totals) is proven end-to-end by D2/D4's real-Postgres tests, and the exact UI mechanics mirror OverviewHeader's already-shipped year-selector pattern line-for-line — but the click-through itself was not visually driven in this execution, consistent with this codebase's own precedent for identical sessionStorage+URL interactions (STATE.md quick task 260709-gfz: 'Verification gap: live browser round-trip not driven')."

# Metrics
duration: ~25min
completed: 2026-07-29
status: complete
---

# Phase 80 Plan 01: dashboard-accrual-lens tracer Summary

**Threaded `?lens=cassa|competenza` through `getOverviewAmountTotals`/`getOverview` and rendered a global `LensSwitch` on `/dashboard/overview`, proving the ledger_entry row-source seam on one real path with a real-Postgres regression gate before fanning out to the remaining nine aggregation sites.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-29T08:57:04Z
- **Tasks:** 2/2
- **Files modified:** 12 (8 modified, 4 created)

## Accomplishments

- `LedgerRowSource` type + `resolveLedgerRowSource(lens)` (`lib/dal/dashboard-filters.ts`) — the single place a validated `Lens` resolves to `ledgerEntryCash`/`ledgerEntryAccrual`
- `Lens` type + `parseLensParam(value)` (`lib/utils/search-params.ts`) — the single place `?lens=` is ever parsed from raw input, built on the existing `parseStatus` allowlist primitive, defaulting to `'cassa'` on absent/garbage/array input
- `getOverviewAmountTotals` (dashboard.ts) and `getOverview` (overview.ts) both gain an optional trailing `ledgerRowSource` parameter defaulting to `ledgerEntryCash` — zero call-site changes for every other existing caller
- `components/dashboard/lens-persistence.ts` / `lens-switch.tsx` — the reusable persistence helpers and `LensSwitch` component every later Phase 80 plan reuses unmodified, mirroring the year selector's URL-canonical + sessionStorage-restore pattern (ADR 0009/0010)
- `/dashboard/overview` now parses `?lens=`, resolves the row source, threads it into `getOverview`, and renders the switch next to the year selector
- `tests/amortization-lens-regression.test.ts` — new real-Postgres suite proving `getOverviewAmountTotals` is byte-identical under cassa (LENS-03) and correctly sums only in-range instalments under competenza (verified against a real 3-month plan via `materializeInstalments`, Decimal.js comparison)
- Full existing `tests/reimbursement-regression.test.ts` suite (26 tests) confirmed green, unmodified, proving the new `ledgerRowSource` parameter introduces zero behavior change to any of the ten already-verified aggregation call sites

## Task Commits

Each task was committed atomically:

1. **Task 1: Thread ?lens= through getOverviewAmountTotals + render LensSwitch on /dashboard/overview** - `2399530` (feat)
2. **Task 2: Real-Postgres regression proof — cash byte-identical + accrual instalment totals** - no additional commit (verification-only task; ran `yarn db:up && yarn test tests/amortization-lens-regression.test.ts tests/reimbursement-regression.test.ts` against the Task 1 commit — 27/27 passing, confirmed against commit `2399530`)

**Plan metadata:** committed separately at end of this SUMMARY's creation.

_Note: Task 1's `<action>` block wrote ALL of this plan's files, including the two shared test-harness files (`tests/helpers/reimbursement-test-db.ts`, `tests/amortization-lens-regression.test.ts`); Task 2's own `<action>` block is purely "run and confirm" with no additional code, so it produced no separate diff to commit._

## Files Created/Modified

- `lib/dal/dashboard-filters.ts` - `LedgerRowSource` type + `resolveLedgerRowSource(lens)`
- `lib/dal/dashboard.ts` - `getOverviewAmountTotals` gains optional `ledgerRowSource` param (defaults `ledgerEntryCash`); `getUncategorizedCount` documented as lens-invariant
- `lib/dal/overview.ts` - `getOverview` threads `ledgerRowSource` into both current/previous period `getOverviewAmountTotals` calls
- `lib/utils/search-params.ts` - `Lens` type + `parseLensParam(value)`
- `components/dashboard/lens-persistence.ts` (new) - `LENS_STORAGE_KEY`, `readSavedLens`, `saveLens`; re-exports `safeSessionStorage`
- `components/dashboard/lens-switch.tsx` (new) - `LensSwitch` component (URL-canonical + sessionStorage restore, `disabled`/`note` props for D-05's future tag-surface use)
- `components/dashboard/overview/overview-header.tsx` - `lens` prop, renders `<LensSwitch>` beside the year `<Select>`
- `app/(app)/dashboard/overview/page.tsx` - parses `?lens=`, resolves the row source, threads both through `OverviewDataSection`/`OverviewHeader`
- `tests/helpers/reimbursement-test-db.ts` - `CaptureAggregationSnapshotInput` gains an optional `ledgerRowSource` field, passed through to `getOverviewAmountTotals`
- `tests/amortization-lens-regression.test.ts` (new) - real-Postgres cash/accrual proof for `getOverviewAmountTotals`
- `tests/table-search-params.test.ts` - `parseLensParam` unit tests
- `tests/lens-persistence.test.ts` (new) - `readSavedLens`/`saveLens` unit tests

## Decisions Made

- **`requirements.mark-complete` NOT run for LENS-01/LENS-02.** This plan delivers only the one-route KPI-totals tracer slice. LENS-01 ("switch the whole dashboard... with one global control") and LENS-02 ("every dashboard widget... reflects spread instalments") both require the remaining nine aggregation sites and three routes (Plans 80-02 through 80-07). Marking either complete now would misstate coverage in REQUIREMENTS.md. Consistent with this codebase's own established precedent (Phase 75/76: `requirements.mark-complete NOT run` for RMB-07/RMB-08/RMB-10/RMB-11 until the full user-facing capability shipped).
- **`getUncategorizedCount` stays lens-invariant**, with no `ledgerRowSource` parameter — an amortized transaction is always categorized before a plan can attach to it (D-04's activation guard), so an instalment can never itself be "uncategorized". This closes the seam survey's flagged "Confirm" note (`.scratch/amortization/assets/01-lens-seam.md`).
- **`lens-persistence.ts` re-exports `safeSessionStorage`** from `overview/overview-persistence.ts` rather than duplicating it, giving `lens-switch.tsx` (a sibling of, not inside, the `overview/` directory) one import path for both lens persistence and the shared storage helper.

## Deviations from Plan

None - plan executed exactly as written. The `requirements.mark-complete` omission above is a state-update judgment call (documented as a decision, not a code deviation) — it follows the same reasoning already established and accepted in Phase 75/76's own SUMMARYs for partial-capability plans.

## Issues Encountered

None. All automated verification passed on the first attempt:
- `yarn test tests/table-search-params.test.ts tests/lens-persistence.test.ts` — green (Task 1's `<verify>`)
- `yarn db:up && yarn vitest run tests/amortization-lens-regression.test.ts tests/reimbursement-regression.test.ts` — 27/27 passing against real Postgres (Task 2's `<verify>`)
- Full suite: 158 test files, 1932 tests passing, 1 pre-existing todo
- `tsc --noEmit` — clean
- `yarn check:language` — passed
- `yarn build` — production build succeeds; `/dashboard/overview` compiles and registers as a dynamic route; no new ESLint warnings beyond the pre-existing pattern the new files replicate (verified via before/after ESLint diff on the base files)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The shared infrastructure (`LedgerRowSource`, `parseLensParam`, `lens-persistence.ts`, `lens-switch.tsx`) is proven and ready for reuse, unmodified, by Plans 80-02 through 80-07 (the remaining nine aggregation sites, `getYearsWithData`/`getMonthsWithData` lens-awareness (D-09/D-10), and the `/dashboard/tags` disabled+noted variant (D-05/D-06)).
- **Known gap:** interactive browser click-through on `/dashboard/overview` (URL flip + visual KPI change) was not manually driven in this sandbox — see coverage `D5.rationale`. Recommend a quick manual spot-check before considering the phase's UI fully signed off, or defer to the phase-level UAT pass at Phase 80 close.

## Self-Check: PASSED

- FOUND: components/dashboard/lens-persistence.ts
- FOUND: components/dashboard/lens-switch.tsx
- FOUND: tests/amortization-lens-regression.test.ts
- FOUND: tests/lens-persistence.test.ts
- FOUND: .planning/phases/80-dashboard-accrual-lens/80-01-SUMMARY.md
- FOUND commit: 2399530

---
*Phase: 80-dashboard-accrual-lens*
*Completed: 2026-07-29*
