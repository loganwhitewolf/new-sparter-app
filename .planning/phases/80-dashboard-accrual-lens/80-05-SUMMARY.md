---
phase: 80-dashboard-accrual-lens
plan: 05
subsystem: dashboard
tags: [nextjs, drizzle, dashboard-lens, react-server-components]

# Dependency graph
requires:
  - phase: 80-dashboard-accrual-lens
    provides: "LensSwitch component, parseLensParam, resolveLedgerRowSource (Plan 80-01); getCategoryRanking/getCategoryDeviations/getCategoryDetail migrated to accept a trailing ledgerRowSource parameter (Plan 80-02)"
provides:
  - "/dashboard/categories parses ?lens=, renders LensSwitch next to its title, and threads resolveLedgerRowSource(lens) into getCategoryRanking/getCategoryDeviations"
  - "/dashboard/categories/[id] parses ?lens=, renders LensSwitch next to 'Dettaglio categoria', and threads resolveLedgerRowSource(lens) into getCategoryDetail/getCategoryDeviations"
affects: [80-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "LensSwitch placement on preset-based routes: rendered in the page's own title/header flex row (justify-between), not beside DashboardFilters — DashboardFilters stays a preset/type-only shared component with no lens prop, unlike Overview's year-Select row"

key-files:
  created: []
  modified:
    - "app/(app)/dashboard/categories/page.tsx"
    - "app/(app)/dashboard/categories/[id]/page.tsx"

key-decisions:
  - "DashboardFilters left untouched — it is shared verbatim between the list and detail pages; the lens is parsed and resolved at the page level and passed only to the DAL calls and LensSwitch, never into DashboardFilters' props"

patterns-established: []

requirements-completed: []

# Coverage metadata
coverage:
  - id: D1
    description: "/dashboard/categories parses ?lens=, renders LensSwitch in its header row, and passes the resolved ledgerRowSource to getCategoryRanking and getCategoryDeviations"
    requirement: "LENS-01"
    verification:
      - kind: unit
        ref: "node_modules/.bin/tsc --noEmit (clean — confirms call sites match the Plan 80-02 signatures)"
        status: pass
      - kind: other
        ref: "node_modules/.bin/eslint app/(app)/dashboard/categories/page.tsx (clean)"
        status: pass
    human_judgment: true
    rationale: "The interactive click-through (?lens=competenza rendering the pressed Competenza state and the ranking/deviations values changing) requires a live browser session against seeded amortization data; this sandbox has no browser-automation tool. Wiring correctness (parse -> resolve -> DAL call arguments) is proven by the typecheck against Plan 80-02's real signatures and by the underlying DAL migration's own real-Postgres regression suite (Plan 80-02), but the UI round-trip on this specific route was not visually driven."
  - id: D2
    description: "/dashboard/categories/[id] parses ?lens=, renders LensSwitch beside 'Dettaglio categoria', and passes the resolved ledgerRowSource to getCategoryDetail and getCategoryDeviations"
    requirement: "LENS-02"
    verification:
      - kind: unit
        ref: "node_modules/.bin/tsc --noEmit (clean)"
        status: pass
      - kind: other
        ref: "node_modules/.bin/eslint app/(app)/dashboard/categories/[id]/page.tsx (clean)"
        status: pass
    human_judgment: true
    rationale: "Same live-browser gap as D1 — the detail page's trend/Top-5/subcategories visually reflecting the accrual lens (including an amortization instalment surfacing in Top 5 movimenti under competenza, proven at the DAL level in Plan 80-02) was not manually driven in this sandbox."

# Metrics
duration: ~10min
completed: 2026-07-29
status: complete
---

# Phase 80 Plan 05: dashboard-accrual-lens Categories routes wiring Summary

**Wired `/dashboard/categories` and `/dashboard/categories/[id]` to the global cassa/competenza lens by reusing the Plan 80-01 `LensSwitch`/`parseLensParam`/`resolveLedgerRowSource` infrastructure and Plan 80-02's already-migrated DAL functions — zero new DAL or component code, pure call-site threading.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-07-29T09:41:02Z
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments

- `app/(app)/dashboard/categories/page.tsx` now parses `?lens=` via `parseLensParam`, resolves `ledgerRowSource` via `resolveLedgerRowSource`, renders `<LensSwitch lens={lens} />` in the page's title row (next to "Categorie", not inside `DashboardFilters`), and threads `ledgerRowSource` into both `getCategoryRanking(filters, ledgerRowSource)` and `getCategoryDeviations({ type: filters.type }, ledgerRowSource)`
- `app/(app)/dashboard/categories/[id]/page.tsx` does the identical parse/resolve/render, placing `LensSwitch` next to the "Dettaglio categoria" heading, and threads `ledgerRowSource` into `getCategoryDetail(categoryId, filters, ledgerRowSource)` and `getCategoryDeviations({ type: filters.type, categoryId }, ledgerRowSource)`
- Both `Props['searchParams']` types extended with `lens?: string | string[]`; `DashboardFilters` (the shared preset/type toolbar component) received zero changes — confirmed it stays lens-unaware per the plan's explicit instruction
- Two of the four dashboard sub-routes (`/dashboard/overview` from 80-01/80-04, and now `/dashboard/categories` + `/dashboard/categories/[id]`) render the global switch and thread the lens into their aggregation calls

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire /dashboard/categories to the lens** - `e8484cc6` (feat)
2. **Task 2: Wire /dashboard/categories/[id] to the lens** - `5e813266` (feat)

**Plan metadata:** committed separately at end of this SUMMARY's creation.

## Files Created/Modified

- `app/(app)/dashboard/categories/page.tsx` - parses `?lens=`, renders `LensSwitch` in the title row, threads `ledgerRowSource` into `getCategoryRanking`/`getCategoryDeviations`
- `app/(app)/dashboard/categories/[id]/page.tsx` - parses `?lens=`, renders `LensSwitch` next to "Dettaglio categoria", threads `ledgerRowSource` into `getCategoryDetail`/`getCategoryDeviations`

## Decisions Made

- **`DashboardFilters` left untouched.** It is shared verbatim between the list and detail pages and is preset/type-only. The lens is parsed and resolved once per page and passed only to `LensSwitch` and the DAL calls — never added as a `DashboardFilters` prop, consistent with the plan's explicit instruction that these two routes have no year selector and the "next to the year selector" placement guidance from the domain_grounding doesn't apply literally here.
- **`requirements.mark-complete` NOT run for LENS-01/LENS-02.** This plan wires two of the four dashboard sub-routes. Per 80-06's own precedent, "D-03's all-four-routes contract completes at Plan 80-07" — that plan closes out the remaining lens-awareness UI wiring (year/month selectors, D-09/D-10) and is the correct point to mark LENS-01/LENS-02 complete for the whole phase.

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched the plan's `<action>` blocks verbatim: header placement, parameter threading order (`filters` then `ledgerRowSource` for ranking/detail; `input` then `ledgerRowSource` for deviations), and the extended `Props['searchParams']` shape.

## Issues Encountered

None. All automated verification passed on the first attempt:
- `node_modules/.bin/tsc --noEmit` — clean after each task
- `node_modules/.bin/eslint` on both modified files — clean
- `yarn check:language` — passed

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Three of the four dashboard sub-routes now render the lens switch and thread it into their aggregations (`/dashboard/overview`, `/dashboard/categories`, `/dashboard/categories/[id]`). `/dashboard/tags` remains lens-invariant-by-design (D-05/D-06, delivered in Plan 80-06) — Plan 80-07 closes out the phase (D-03's "all four routes" contract, any remaining year/month lens-awareness wiring, and `requirements.mark-complete` for LENS-01/LENS-02).
- **Known gap:** interactive browser click-through on both routes (`?lens=competenza` flipping the switch's pressed state and the ranking/deviations/detail values updating, including an instalment surfacing in Top 5 movimenti) was not manually driven in this sandbox — see coverage `D1.rationale`/`D2.rationale`. The underlying DAL correctness is already proven end-to-end by Plan 80-02's real-Postgres regression suite; only the UI round-trip on these two specific routes is unverified by a live browser. Recommend a quick manual spot-check before Phase 80's UAT close.

## Self-Check: PASSED

- FOUND: app/(app)/dashboard/categories/page.tsx
- FOUND: app/(app)/dashboard/categories/[id]/page.tsx
- FOUND commit: e8484cc6
- FOUND commit: 5e813266

---
*Phase: 80-dashboard-accrual-lens*
*Completed: 2026-07-29*
