---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Nature/Direction Model Realignment
status: Awaiting next milestone
last_updated: "2026-06-14T15:47:51.121Z"
last_activity: 2026-06-14 — Milestone v2.0 completed and archived
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 22
  completed_plans: 22
  percent: 100
stopped_at: Phase 50 Plan 05 — COMPLETE (Phase 50 fully complete)
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-10)

**Core value:** The user can safely import real bank transactions, see where their money goes categorized by month, and instantly spot deviations from their baseline spending — all running on a zero-cost personal deploy.
**Current focus:** Phase 50 — transaction-pairing

## Current Position

Phase: Milestone v2.0 complete
Plan: —
Status: Awaiting next milestone
Last activity: 2026-06-15 — Quick task 260615-dtm: bank-agnostic regex-discovery tool shipped

## Accumulated Context

### Decisions

Design contract is LOCKED. Do not re-open or re-derive the data model:

- **49-01 D-01:** savingsRate expected value in test is 33.3 (not 33) — computeSavingsRate uses toDecimalPlaces(1); RESEARCH.md had a rounding error in the example value.

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

- **48-01 migration**: 0018 hand-crafted from 0017 snapshot diff (drizzle-kit TTY limitation, D-07 sanction); MIG-03 pre-dedup DELETE guards against sign-only duplicate constraint failures
- **48-01 D-16**: rebucketIncomeNatures guard removed; step is no-op retained for append-only registry invariant; nature assignment delegated to v2-backfill-nature-id
- **48-02 verify-migration**: classifyResults (pure, exported) + runVerification (4 read-only SQL assertions); fatal on activeSystemNullNatureCount>0 (D-04) or patternDuplicateCount>0 (MIG-03); informational for user-owned null nature_id (D-03); db:verify* scripts mirror db:seed-extras* triplet
- Migrations: `drizzle-kit generate` + `scripts/migrate.ts` only — never `drizzle-kit push`
- Seeds: additive model — append steps to `seed-extras.ts`, never edit shipped `seed-data.ts` shapes
- Monetary arithmetic: Decimal.js throughout
- Layering: dal / services / actions
- [Phase ?]: 49-02 D-01: categoryType fields use sql<union> cast for direction.code to satisfy TypeScript strict mode in dashboard.ts
- [49-04]: OUT_KEYS narrowed to essential/discretionary/debt only; savings/investment in allocation bucket; onMonthSelect carries direction param; allocationReading uses "piu/meno del {prevYear}" copy from UI-SPEC
- [49-04 post-checkpoint]: totalAllocation display wrapped in abs() — DAL algebraic value unchanged; movers changed to 3-column simultaneous layout (removed per-direction routing)
- [49-05]: buildDirectionNatureMap replaces buildTypeNatureMap (direction-keyed, allocation bucket); SubcategoryPicker 4 direction chips; table filters key=direction + dependsOn=direction; setSubcategoryNatureAction resolves real natureId via NATURE_ID_BY_CODE; detectedAmountSign removed (ADR 0012)
- [Phase ?]: 50-02 D-07: yarn db:generate --name transaction_pair bypasses drizzle-kit TTY prompt; --name flag is standard workaround for headless migration generation contexts
- [Phase ?]: 50-02: transaction_pair table LIVE in local dev DB (0020 migration applied); no userId column on pair table (D-01/T-50-01) — ownership enforced in Plan 03 service layer
- [50-03]: createPair verifies both tx.userId === sessionUserId before insert (IDOR gate, D-01); primary resolution via Decimal.js abs(), tie-break by occurredAt (D-10); getEligibleCounterparts verifySession-scoped + NOT EXISTS already-paired (D-14); actions revalidate /transactions + /overview
- [50-04]: PAIR-03 netting via shared helpers at all 8 aggregation sites; getOverview (overview.ts) untouched to avoid double-count; transactionListSelect uses correlated subqueries (not LEFT JOIN) for 4 paired fields
- [50-05]: TransactionTable key-based remount — pairedWithId + pairedNetAmount included in buildTransactionTableKey; table copies props into local state so prop updates are invisible without remount
- [50-05]: CounterpartPickerDialog mounted with key={pairTarget.id} — re-anchors ±90-day date window to the reference transaction's occurredAt on every open; prevents stale date range from reused dialog instance
- [50-05]: Popover Importo uses pairedAmount (= t2.amount correlated subquery, counterpart's original amount); Netto uses pairedNetAmount — two distinct values; pairedAmount added to transactionListSelect in Plan 04 field set

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
| 260615-dtm | Bank-agnostic regex-discovery tool (uncovered-description clustering → proposed patterns) | 2026-06-15 | d737b8e |

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

Last session: 2026-06-14T10:00:00Z
Handoff synced: 2026-06-14 — 50-05 SUMMARY committed (Phase 50 fully complete)
Resume file: None — Phase 50 complete. Remaining v2.0 work: 48-03-PLAN.md (MIGRATION-RUNBOOK) or 49-06-PLAN.md (drop exclude_from_totals).

**Next:** Phase 50 complete (5/5 plans). Remaining open v2.0 plans: 48-03 (MIGRATION-RUNBOOK + operator-guarded apply) and 49-06 (BLOCKING — drop sub_category.exclude_from_totals migration).

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 49 P02 | 30m | 2 tasks | 5 files |
| Phase 50 P01 | 20m | 2 tasks | 4 files |
| Phase 50-transaction-pairing P50-02 | 35min | 2 tasks | 5 files |
| Phase 50-transaction-pairing P50-03 | 10min | 2 tasks | 4 files |
| Phase 50-transaction-pairing P50-04 | 25min | 2 tasks | 3 files |
| Phase 50-transaction-pairing P50-05 | 90min | 2 tasks + operator checkpoint + 5 fixes | 5 files |
