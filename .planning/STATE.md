---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Nature/Direction Model Realignment
status: verifying
last_updated: "2026-06-11T10:41:14.879Z"
last_activity: 2026-06-11
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 8
  completed_plans: 8
  percent: 40
stopped_at: Completed 47-05-PLAN.md
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-10)

**Core value:** The user can safely import real bank transactions, see where their money goes categorized by month, and instantly spot deviations from their baseline spending — all running on a zero-cost personal deploy.
**Current focus:** Phase 47 — taxonomy-seed-rework

## Current Position

Phase: 48
Plan: Not started
Status: Phase 47 gate green — ready for verify-work / Phase 48
Last activity: 2026-06-11

Progress: [█████████████████░░░] 88% milestone (7/8 plans)

## Accumulated Context

### Decisions

Design contract is LOCKED. Do not re-open or re-derive the data model:

- ADR 0012: direction derived from nature; 4th direction `allocation`; `category.type` removed
- CONTEXT.md: canonical nature/direction vocabulary + categorization rules
- `.planning/nature-remapping-WORKING.md`: 23 categories / ~65 subcats — final remap confirmed 2026-06-09

v2.0 / Phase 46 decisions (shipped 2026-06-11):

- **8 nature rows** (not 9): `income`, `income_extraordinary`, `essential`, `discretionary`, `debt`, `transfer`, `savings`, `investment` — stale "9" references in docs; uncategorized = `null` `nature_id` on subcategory (D-02)
- `direction` + `nature` lookup tables in `schema.ts` (varchar codes, not pgEnum); FK chain `sub_category.nature_id → nature → direction`
- `category.type`, `flow_nature` enum, `amount_sign` removed from schema; pattern unique constraint `(pattern, subCategoryId)`
- **D-06:** no `drizzle-kit generate` / DB apply in Phase 46 — migration deferred to Phase 48
- **D-10:** `sub_category.exclude_from_totals` retained in schema — removal + `direction.included_in_totals` consumption deferred to Phase 49
- **46-02 minimum-compile:** DAL/actions/components/tests compile green; semantic aggregation/filter rewrite marked `TODO(Phase 49)` — not a Phase 46 deliverable
- **46-03 seed baseline:** `directions` (4) + `natures` (8) in `seed-data.ts`; `seed.ts` FK-order insert; `seed-extras` pattern-dedupe sign-agnostic repair only (no new STEPS yet — Phase 47 adds nature_id backfill)
- **47-02 seed-data v2:** wholesale replace `categories` (23 active) + `subCategories` (87 with `natureId` 1-8); dissolved wrappers omitted from fresh baseline; Wave 0 tests GREEN (TAX-01/TAX-02 baseline)
- **47-03 patterns + seed wiring:** sign-agnostic `categorizationPatterns` (28 rows) retargeted to v2 slugs; bonifico deduped to `trasferimento-tra-conti`; `seed.ts` excludeFromTotals triple + natureId pass-through (D-10, D-13)
- **47-05 R-FN-03 + phase gate:** R-FN-03 todos enabled; transfer subs assert natureId 6 (D-13); 949 tests + build green; 47-VALIDATION.md Nyquist sign-off; no DB apply (D-05)

- Migrations: `drizzle-kit generate` + `scripts/migrate.ts` only — never `drizzle-kit push`
- Seeds: additive model — append steps to `seed-extras.ts`, never edit shipped `seed-data.ts` shapes
- Monetary arithmetic: Decimal.js throughout
- Layering: dal / services / actions

### Planning Risk

**Resolved (Phase 46):** 8-vs-9 nature row count — **8 is correct**; implemented in schema + seed (46-01, 46-03).

**Open for Phase 47:** None — Phase 47 complete. Deployed DB apply deferred to Phase 48 (D-05).

### Blockers/Concerns

None.

### Quick Tasks Completed (carried from v1.16)

| # | Description | Date | Commit |
|---|-------------|------|--------|
| 260609-fru | Dashboard overview prototype fixes | 2026-06-09 | 5ebd690 |
| 260609-k2d | Transactions nature + in/out/transfer filters; 7 UI fixes | 2026-06-09 | cdc5997 |
| 260609-lcp | Cascading filters (type→nature, category→subcat); amount sign strip | 2026-06-09 | ffd4fc3 |

## Deferred Items

| Category | Item | Status |
|----------|------|--------|
| phase_46 | 46-VERIFICATION.md | not generated — run `/gsd-verify-work 46` if process gap matters |
| phase_49 | DATA-06 `exclude_from_totals` removal | D-10 — deferred from Phase 46 |
| phase_49 | Semantic DAL/dashboard/filter rewrite | `TODO(Phase 49)` stubs from 46-02 |
| operator | R038/R039/R041 | live deploy operator-pending |
| backlog | R029 | partial revalidation coverage |
| backlog | REVAL-01 | parked |

## Session Continuity

Last session: 2026-06-11 — Completed 47-03-PLAN.md (sign-agnostic patterns + seed.ts wiring)
Handoff synced: 2026-06-11 — 28 patterns retargeted; excludeFromTotals v2 TRANSFER triple; tests GREEN
Resume file: None

**Next:** `/gsd-execute-phase 47` (Plan 04 — seed-extras STEPS 6+ remap/backfill)

## Operator Next Steps

- Plan Phase 47: taxonomy remap per `nature-remapping-WORKING.md`
- `develop` is 26 commits ahead of `origin/develop` — push when ready
