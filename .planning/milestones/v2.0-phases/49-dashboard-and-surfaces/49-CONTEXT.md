# Phase 49: dashboard-and-surfaces - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Every consumer of the old `category.type` + `nature` model — dashboard, KPI
cards, aggregation queries (`lib/dal/dashboard.ts`, `lib/dal/overview.ts`),
`lib/utils/cascade-options.ts`, the `SubcategoryPicker`, and the
Transactions/Expenses table filters — is rewritten to derive **direction** from
the `nature → direction` FK chain and to use **direction-grouped algebraic sum**
instead of the sign-split (`sum(amount>0)` / `abs(sum(amount<0))`) logic. The
result is a fully functional 4-direction view (IN / OUT / ALLOCATION visible,
TRANSFER hidden) for the user.

The codebase already marks the work with ~18 `TODO(Phase 49)` placeholders at
the affected call sites; this phase resolves them.

**Locked upstream by ADR 0012 — NOT reopened here:** the 4 directions, algebraic
sum, allocation "visible-but-separate", transfer excluded/hidden, refund &
divestment netting by algebraic sum within their own segment, removal of
`amountSign`/sign-agnostic patterns, and "direction is derived, never stored on
the transaction". This phase decides only **how to present** what ADR 0012
already locked.

This phase does NOT add explicit transaction pairing (Phase 50).

</domain>

<decisions>
## Implementation Decisions

### A — Allocation in the overview chart + drill-down
- **D-01:** Allocation renders as a **3rd grouped bar** ("Accantonato") per month,
  alongside Entrate and Uscite (extends the v1.16 variant-A grouped-bar chart).
  The bar is **always present even at zero** for visual stability of the monthly
  group (do NOT hide it on empty months — the "hide if 0" option was rejected as
  it makes month groups uneven, 2 vs 3 bars).
- **D-02:** The chart drill-down becomes **direction-aware**. Clicking a bar
  selects month **and** direction:
  - Entrate → IN movers (**NEW** — IN drill-down did not exist before)
  - Uscite → OUT movers (existing behaviour)
  - Accantonato → allocation movers
  Each shows Δ€ vs the previous month. `getMonthOverMonthCategoryChanges`
  (`lib/dal/overview.ts`) gains a `direction` parameter; `fetchMovers` action and
  `OverviewMoversPanel`/`OverviewMoversSection` adapt their header/copy per
  direction.
- **D-03:** Allocation movers are shown **per nature** (Risparmio / Investimento)
  with Δ€. IN and OUT movers stay **per category** as today (allocation has few
  categories, so nature grain reads cleaner and matches the approved mockup).
- **D-04:** A month/direction with no allocation activity shows a **zero-height
  bar** that is still clickable; the panel then shows an empty-state
  ("Nessun accantonamento in questo mese"), consistent with how the overview
  already handles empty states.

### B — KPI cards + savings rate
- **D-05:** Add a **5th KPI card "Accantonato"** (Risparmio + Investimento for the
  period) with the same YTD-vs-prior Δ treatment and a sentiment reading line as
  the other cards. "More allocated" reads as **positive** sentiment. (Rejected:
  replacing "Tasso risparmio", and demoting allocation to a reading line under
  Bilancio — DASH-04 wants allocation surfaced as its own measure.)
- **D-06:** **Savings rate stays `(in − out) / in`**, unchanged. `out` = spending
  only (essential / discretionary / debt). **Allocation and transfer are excluded
  from the spending totals** (`direction.included_in_totals = false`). Bilancio
  remains `in − out`. Allocation is a separate measure, NOT folded into the
  savings rate (the "allocation/in" reinterpretation and the "keep both metrics"
  options were rejected to avoid changing/duplicating an existing metric's
  meaning).

### C — Direction chips: picker + table filters
- **D-07:** The `SubcategoryPicker` exposes **all 4 direction chips**
  (In / Out / Accantonato / Trasferimento). Categorization is a different surface
  from the dashboard: even though the dashboard hides/separates transfer and
  allocation, the user MUST be able to assign any of the 4 directions (CAT-01).
- **D-08:** Table filters: the `type` filter (In/Out/Transfer) becomes a
  **`direction` filter with 4 values** (In/Out/Accantonato/Trasferimento); the
  `nature` filter stays a **cascade** (`dependsOn: 'direction'`), now fed by the
  `nature → direction` mapping instead of `category.type`. Tables list ALL
  transactions, so transfer and allocation ARE filterable there (CAT-02).
- **D-09:** Chip/filter labels come from the seeded **`direction.label_it`**
  (single source of truth). The planner must verify the allocation row's
  `label_it` reads well as a user-facing chip ("Accantonato"); nature labels come
  from `NATURE_LABELS` / the seeded `nature.label_it`.

### D — Remove `sub_category.exclude_from_totals`
- **D-10:** **Drop the column now** via a dedicated generated migration.
  Verified safe: all three rows currently carrying `exclude_from_totals = true`
  (`trasferimento-tra-conti`, `addebito-carta-di-credito`, `contante`) map to
  nature `transfer` → direction `transfer` → `included_in_totals = false`, and
  the column is **not user-editable** (no UI/action/validation writes it). So
  `direction.included_in_totals` covers it with **no semantic gap** — it is pure
  redundancy. Allocation natures (savings/investment) are likewise excluded via
  direction.
- **D-11:** Aggregation switches to `direction.included_in_totals`; remove the
  `notExcludedFromTotals()` helper and all its call sites in
  `lib/dal/dashboard.ts` and `lib/dal/overview.ts`. (Rejected: leaving a dead
  column for a later cleanup, and keeping it as a redundant AND — both undermine
  the single-source-of-truth and leave tech debt.)
- **D-12:** The column drop is a schema migration and MUST follow the same
  operator caution established in Phase 48 (D-13/D-14): `pg_dump` snapshot before
  `yarn db:migrate`, guarded apply, no hand-written down-migration (restore from
  dump is the rollback path).

### Claude's Discretion
- Exact plan slicing, SQL/helper naming, and whether the direction join is
  expressed as a reusable Drizzle fragment vs inline are left to the planner.
- Chart colors for the allocation bar/segments may use the seeded
  `direction.color` / `nature.color`; precise visual tuning is a UI concern.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked design contract
- `docs/adr/0012-direction-derived-from-nature-allocation.md` — the locked model:
  direction derived from nature, the 4th `allocation` direction, algebraic-sum
  aggregation, refund/divestment netting, deprecation of `category.type` /
  `flow_nature` / `amount_sign` / `exclude_from_totals`, and the list of ~18 call
  sites to migrate.
- `CONTEXT.md` (repo root) — canonical domain vocabulary for Direction,
  FlowNature, refund, divestment, allocation, transfer, Reference Period, movers.
- `.planning/nature-remapping-WORKING.md` — final v2 taxonomy/remap (23 categories,
  ~65 subcategories, 8 natures across 4 directions).

### Requirements and roadmap
- `.planning/REQUIREMENTS.md` — DASH-01..04, CAT-01, CAT-02 (the contract this
  phase validates).
- `.planning/ROADMAP.md` §"Phase 49" — goal + 5 success criteria.
- `.planning/PROJECT.md` — v1.16 overview redesign decisions this phase extends
  (variant A grouped bars, 4 KPI cards, movers drill-down).

### Prior phase context
- `.planning/phases/48-sql-migration-recategorization/48-CONTEXT.md` — migration
  safety/operator protocol (D-13/D-14) that the `exclude_from_totals` drop must
  follow; confirms `expense.sub_category_id` is the categorization target.
- `.planning/phases/46-direction-nature-schema/46-CONTEXT.md` — schema-vs-migration
  boundary; `exclude_from_totals` deliberately deferred to Phase 49.
- `.planning/phases/47-taxonomy-seed-rework/47-CONTEXT.md` — v2 taxonomy + additive
  seed model.

### Code anchors (read before editing)
- `lib/dal/dashboard.ts` — `getOverviewAmountTotals`, `getCategoriesBreakdown`,
  `getCategoryRanking`, `getCategoryDeviations`, `getCategoryDetail`,
  `getAggregatedTransactionsData`, `getMonthlyTrendByNature`,
  `notTransferCategory`, `notExcludedFromTotals` — all carry `TODO(Phase 49)`.
- `lib/dal/overview.ts` — `getOverview`, `getOverviewChart`,
  `getMonthOverMonthCategoryChanges`, `OUT_NATURES`, `OverviewChartPoint`.
- `lib/utils/cascade-options.ts` — `buildTypeNatureMap`,
  `buildCategorySubcategoryMap` (still branch on `cat.type`).
- `lib/utils/nature-labels.ts` — `FlowNature`, `NATURE_LABELS`, `NATURE_ORDER`,
  `NATURE_COLORS`.
- `lib/actions/overview.ts` — `fetchMovers` server action (gains direction param).
- `components/dashboard/overview/` — `kpi-row.tsx`, `overview-chart.tsx`,
  `overview-chart-filters.tsx`, `overview-movers-section.tsx`,
  `overview-movers-panel.tsx`.
- `app/(app)/transactions/transactions.table.ts`,
  `app/(app)/expenses/expenses.table.ts` — `type`+`nature` filter config to
  re-point to direction.
- `components/categorization/subcategory-picker.tsx` — direction chips.
- `lib/db/schema.ts` — `direction`, `nature`, `sub_category.nature_id`,
  `sub_category.exclude_from_totals` (to drop), `direction.included_in_totals` /
  `shown_separately` / `hidden`.
- `tests/fixtures/v2-taxonomy-manifest.ts` — authoritative slug→nature oracle
  (used to verify the 3 transfer-excluded slugs).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The v1.16 overview shell (`OverviewMoversSection` shared-state chart+panel,
  `KpiRow`, `OverviewChart`) is the base to extend — the 3rd bar and
  direction-aware selection plug into the existing `selectedMonth` architecture.
- The seeded `direction` table already carries `included_in_totals`,
  `shown_separately`, `hidden`, `label_it`, `color`, `display_order` — the
  presentation flags are data, not new code.
- `buildDeviationDataset` / `getMonthOverMonthCategoryChanges` already implement
  the Δ-vs-previous-month pattern; allocation/IN movers reuse it with a direction
  scope.

### Established Patterns
- DAL aggregations are `react.cache`'d, `verifySession()`-scoped, and wrap queries
  in try/catch returning zero-filled defaults — preserve this.
- Algebraic sum already governs the overview chart (ADR 0004); this phase
  generalises it to all direction buckets.
- Direction is derived via join `transaction → expense → sub_category → nature →
  direction`; it is never stored on the transaction.
- Table filters use the declarative `TableConfig` system with URL-first state and
  cascading `dependsOn`; the `type→direction` change is a config + DAL WHERE swap.

### Integration Points
- `expense.sub_category_id` is the categorization target; raw `transaction` rows
  carry the amount and link to `expense` but no category.
- `effectiveNature` resolves via `COALESCE(override.natureId, subCategory.natureId)
  → nature.code`; direction joins off the same resolved nature.
- The current placeholder logic in `overview.ts` (`isNull(subCategory.natureId)`
  to "include all") and `dashboard.ts` (`categoryType: sql\`null\``,
  `typeFilter = sql\`true\``) is wrong-but-compiling scaffolding — replace, don't
  preserve.

</code_context>

<specifics>
## Specific Ideas

- Approved drill-down mockup for the allocation bar:
  `Accantonato — marzo vs febbraio` → `Investimento € 800 Δ +300`,
  `Risparmio € 400 Δ −100` (nature grain, signed Δ€).
- "Spending totals" = essential + discretionary + debt only; allocation and
  transfer never enter spending totals or the savings-rate denominator/numerator.
- The 3rd bar must not reintroduce the per-nature OUT stacking that v1.16
  deliberately removed (variant A clarity) — allocation is a separate grouped
  bar, not a stack on Uscite.

</specifics>

<deferred>
## Deferred Ideas

- Explicit transaction↔opposite pairing (order↔refund) — Phase 50 (TX-PAIRING-01).
- Employer expense reimbursements bundled into the salary credit (cannot be split)
  — known limitation, deferred per ADR 0012.
- A "recurring spend / subscriptions" orthogonal cut/view — ADR 0012 notes this is
  a flag/view, not a nature; not in this phase.

None of the above are blockers — discussion stayed within phase scope.

</deferred>

---

*Phase: 49-dashboard-and-surfaces*
*Context gathered: 2026-06-12*
