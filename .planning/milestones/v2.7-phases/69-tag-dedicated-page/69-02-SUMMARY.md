---
phase: 69-tag-dedicated-page
plan: 02
subsystem: tags
tags: [drizzle, decimal, rsc, tags, dataviz-css]

# Dependency graph
requires:
  - phase: 69-tag-dedicated-page
    plan: 01
    provides: getTagDetail / buildTagDetailData DAL + TagDetailReport presentational component
provides:
  - "getTagDetail returning a reconciled per-category breakdown (signed Decimal totals, sorted by |total| desc) from the single existing query (D3)"
  - "TagBreakdownItem type + TagDetail.breakdown field (signed DECIMAL string totals)"
  - "TagDetailReport 'Per categoria' CSS-bar card (sign-colored, no charting dependency, D4)"
affects: [69-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-group signed-Decimal accumulation in a pure shaping function (Map<categoryName, {total, count}>) → materialize + sort by |total| desc, mirroring buildTagTotalsData"
    - "CSS-bar dataviz: width = |total| / max|total|, color by sign (--total-in / --total-out), no charting library"

key-files:
  created: []
  modified:
    - lib/dal/tags.ts
    - tests/tags-dal.test.ts
    - components/tags/tag-detail-report.tsx
    - tests/tag-detail-report.test.tsx

key-decisions:
  - "Extended the EXISTING getTagDetail select with categoryName (category already innerJoined) — no parallel query, so the netted row set and therefore net are provably unchanged (D3, TAG-07)"
  - "Map value typed via ReturnType<typeof toDecimal> to avoid adding a new Decimal type import to the DAL, keeping the file's single decimal-helper import surface"
  - "maxAbs guarded with Math.max(..., 1) so an all-zero/empty breakdown never divides by zero; Number() is presentation-only (reconciliation already done in Decimal in the DAL)"

patterns-established:
  - "buildTagDetailData now derives both the netted totals and the per-category breakdown from one row pass, keeping Σ breakdown === net structurally guaranteed"

requirements-completed: [TAG-07, TAG-08, TAG-09]

coverage:
  - id: breakdown-grouping
    description: "buildTagDetailData groups mixed category rows into one signed-Decimal-summed entry per category with the row count, sorted by |total| desc"
    requirement: "TAG-09"
    verification:
      - kind: unit
        ref: "tests/tags-dal.test.ts#groups mixed category rows / sorts the breakdown by absolute total descending"
        status: pass
    human_judgment: false
  - id: breakdown-reconciliation
    description: "Σ breakdown.total === net and Σ breakdown.count === count === transactions.length, holding even for an allocation-style row where inflow − outflow ≠ net"
    requirement: "TAG-07"
    verification:
      - kind: unit
        ref: "tests/tags-dal.test.ts#reconciles: Σ breakdown.total === net / keeps the invariant when an allocation-style row..."
        status: pass
    human_judgment: false
  - id: net-unchanged
    description: "Adding category.name to the select is a column, not a row (category already innerJoined), so net stays exactly the pre-breakdown net and reconciles with getTagTotals"
    requirement: "TAG-07"
    verification:
      - kind: unit
        ref: "existing getTagDetail net/count coverage unchanged; empty-rows case → breakdown [], net 0.00, count 0"
        status: pass
    human_judgment: true
    rationale: "Cross-query reconciliation (net vs getTagTotals total for the same tag against /dashboard/tags) is the live-data human-verify checkpoint in Plan 69-03."
  - id: breakdown-card
    description: "TagDetailReport renders a 'Per categoria' card: one row per category with the signed sign-colored amount and a CSS bar scaled to |total| / max|total|, colored by sign; empty breakdown renders no card"
    requirement: "TAG-09"
    verification:
      - kind: unit
        ref: "tests/tag-detail-report.test.tsx#renders the 'Per categoria' breakdown card / both signed amounts / renders no card when empty"
        status: pass
    human_judgment: false

# Metrics
duration: 4min
completed: 2026-07-22
status: complete
---

# Phase 69 Plan 02: Per-Category Breakdown Summary

**Extended the single existing `getTagDetail` query and pure `buildTagDetailData` shaper with a reconciled per-category breakdown (signed Decimal totals, sorted by |total| desc) and rendered it on `/tags/[id]` as sign-colored CSS bars — no parallel query, no charting dependency.**

## Performance

- **Duration:** ~4 min
- **Tasks:** 2 (Task 1 TDD)
- **Files modified:** 4 (0 created, 4 modified)

## Accomplishments
- Added `categoryName: category.name` to the EXISTING `getTagDetail` select. Category was already `innerJoin`ed, so this adds a column — never a row — leaving the netted row set (and therefore `net`) unchanged and still reconciling with `getTagTotals` (D3, TAG-07).
- Added the exported `TagBreakdownItem = { categoryName; total (signed DECIMAL string); count }` type and `breakdown: TagBreakdownItem[]` on `TagDetail`.
- `buildTagDetailData` now accumulates a per-category `Map` (signed `Decimal` running total + integer count) in the same single row pass that computes inflow/outflow/net, then materializes and sorts by absolute total descending (same rule as `buildTagTotalsData`). Money math is Decimal.js throughout — never native arithmetic (CLAUDE.md).
- `TagDetailReport` gained a "Per categoria" shadcn Card between the count line and the transaction list: one row per category (name + signed it-IT amount, sign-toned, `tabular-nums`) over a CSS track/bar whose width is `|total| / max|total|` and whose color follows the sign (`--total-in` / `--total-out`). Empty breakdown renders no card. No charting library added (D4, CONTEXT out-of-scope).
- Extended both test suites: DAL pure-function coverage for grouping, sort order, the allocation-row edge (inflow − outflow ≠ net yet Σ breakdown === net), the empty case, and the explicit Σ breakdown.total === net / Σ count === count === transactions.length reconciliation invariant; component coverage for the populated card (both category names, both signed amounts, both sign colors) and the empty-breakdown no-card case.

## Task Commits

1. **Task 1: Per-category breakdown in getTagDetail / buildTagDetailData (TDD)** - `830d467` (feat)
2. **Task 2: "Per categoria" breakdown card with CSS bars** - `09723b5` (feat)

## Files Created/Modified
- `lib/dal/tags.ts` - Added `TagBreakdownItem` type, `breakdown` field on `TagDetail`, `categoryName` on `TagDetailQueryRow` and the `getTagDetail` select; per-category Decimal accumulation + |total|-desc sort in `buildTagDetailData`.
- `tests/tags-dal.test.ts` - New `buildTagDetailData (pure)` describe block (grouping, sort, allocation-row invariant, empty case, reconciliation); imported `buildTagDetailData` + `toDecimal`.
- `components/tags/tag-detail-report.tsx` - `CategoryBar` subcomponent + "Per categoria" Card; `maxAbs` bar scale; imported `TagBreakdownItem`.
- `tests/tag-detail-report.test.tsx` - Added `breakdown` to both fixtures; assertions for the populated card and the empty no-card case.

## Decisions Made
- Extended the existing query/shaper rather than adding a parallel query (D3), so `net` is structurally identical to the pre-breakdown value and reconciliation with `getTagTotals` is preserved by construction.
- Typed the accumulator Map value as `ReturnType<typeof toDecimal>` to avoid introducing a second decimal-related import into the DAL.
- Guarded `maxAbs` with `Math.max(..., 1)` to avoid divide-by-zero on an all-zero/empty breakdown; `Number()` in the component is presentation-only (the authoritative signed sums are Decimal in the DAL).

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## Verification Results
- `./node_modules/.bin/vitest run tests/tags-dal.test.ts tests/tag-detail-report.test.tsx` — 35/35 passing (26 + 9).
- `./node_modules/.bin/tsc --noEmit` — no errors in any touched file (pre-existing unrelated test-file errors ignored per plan).
- `./node_modules/.bin/eslint` on the four touched files — clean.
- `yarn check:language` — passed.
- Build-level reconciliation invariant asserted: Σ breakdown.total === net and Σ breakdown.count === count === transactions.length (TAG-07/TAG-08). Cross-query reconciliation against `/dashboard/tags` remains the Plan 69-03 human-verify checkpoint.

## Next Phase Readiness
- The D4 report body is now complete (KPIs → count → per-category breakdown → tx list); Plan 69-03 wires the entry points (`/tags` index + `/dashboard/tags` ranking primary link) and runs the human-verify checkpoint confirming reachability and live net-vs-`getTagTotals` reconciliation.

## Self-Check: PASSED
- FOUND: lib/dal/tags.ts (breakdown / TagBreakdownItem)
- FOUND: components/tags/tag-detail-report.tsx (Per categoria card)
- FOUND: tests/tags-dal.test.ts (buildTagDetailData pure block)
- FOUND: tests/tag-detail-report.test.tsx (breakdown fixtures + assertions)
- FOUND: commit 830d467
- FOUND: commit 09723b5

---
*Phase: 69-tag-dedicated-page*
*Completed: 2026-07-22*
</content>
</invoke>
