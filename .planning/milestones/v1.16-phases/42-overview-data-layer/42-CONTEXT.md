# Phase 42: overview-data-layer - Context

**Gathered:** 2026-06-07
**Status:** Ready for planning

<domain>
## Phase Boundary

All server-side **data contracts** for the redesigned `/dashboard/overview` tab, plus the project glossary update. **No UI** — the overview shell, chart, KPIs, nudge, filters, and movers UI land in Phases 43–45.

Delivers requirements **DATA-01, DATA-02, DATA-03, DATA-04** plus the roadmap-scoped **income-split resolution** (the data foundation that powers Phase 44's income-type filter chips).

Design is LOCKED in `app/proto/overview/NOTES.md` (grill-me 2026-05-29 + PO review 2026-06-03; PO verdict: chart **variant A** + header **H1**). Do not re-open locked decisions.

</domain>

<decisions>
## Implementation Decisions

### Income split (recurring vs extraordinary) — D-01..D-04

The open question #1 from NOTES.md is resolved: the existing `nature` taxonomy does **not** cleanly separate income (Phase 37 seeded `income` nature across both recurring *and* one-off slugs, and put a lot of in-side income under `financial`). The split is modeled as a **`nature` dimension**, not a parallel column.

- **D-01 — Approach: extend `flowNature`, not a dedicated column.** Recurring vs extraordinary income is a `nature` distinction (single classification axis, editable via the existing `SubcategoryNatureSelect` in settings). A dedicated `incomeType` column was rejected — it would be `null` on every OUT row.
- **D-02 — V1 additive enum change.** `ALTER TYPE flow_nature ADD VALUE 'income_extraordinary'`. The existing `income` value **stays** and is re-labeled **"Entrate ricorrenti"** (recurring). No destructive enum-type recreation, no row remap of `income`. (V2 — replacing `income` with symmetric `income_recurring`/`income_extraordinary` — was rejected as a heavier, destructive migration.)
- **D-03 — Two-bucket model on the `in` side.** Every `in` subcategory is either `income` (recurring) or `income_extraordinary` (straordinaria). The `in`-side rows currently on `financial` nature (vendite, cashback, rimborsi, dividendi, bonifico-in-entrata) **fold into `income_extraordinary`**. `financial` is thereafter an OUT/investment nature only. The income filter (Phase 44) covers 100% of the `in` side.
- **D-04 — Phase 42 ships the data substrate.** This phase delivers **1 enum migration** + **1 `seed-extras` STEP** that re-buckets slugs. The exact per-slug reclassification is a **candidate list** (see Specific Ideas) requiring **PO confirmation during execution** — the data contract is fixed, the seed contents are tunable.

  **Migration gotcha for research:** Postgres `ALTER TYPE … ADD VALUE` cannot run inside the same transaction that subsequently uses the new value. Ensure the migration runner does not wrap the `ADD VALUE` together with a statement that references `'income_extraordinary'`. Validate against the project's `scripts/migrate.ts` flow.

### Month-over-month movers — D-05..D-08

`getMonthOverMonthCategoryChanges(year, monthIndex?, limit?)` (DATA-02):

- **D-05 — Granularity: Category level.** Movers aggregate by `category.id` (e.g. "Trasporti · +220€"), matching NOTES copy `{categoria}` and the `getCategoryDeviations` category path. Not subcategory.
- **D-06 — "Previous month" = previous *calendar* month, crossing the year boundary.** `getMonthOverMonthCategoryChanges(2026, 0)` (January) compares against **December 2025**. If the previous calendar month has no data, the panel is **not** an empty state — every category renders as **"spesa nuova"** (delta = full current spend, `isNew = true`). The query must therefore look back one month *before* Jan 1 of the scoped year.
- **D-07 — Noise threshold €15 acts on |Δ€|; sort by |Δ€| desc.** Hide movers whose absolute month-over-month change is `< €15`; order remaining by magnitude of change descending. (This is *not* the Deviation Noise Threshold semantics — that one filters on the period's spend.)
- **D-08 — OUT only; `isNew` flag when prev = 0.** Return shape carries `{ categoryId, name, delta, isNew }`. The MOVE-05 "first month → empty state" rule is a **Phase 45 UI concern** (default month selection), not a data-layer concern — the query simply returns an empty array when the month has no OUT spend.

### Query surface & migration — D-09..D-11

- **D-09 — New file `lib/dal/overview.ts`, year-scoped.** All new v1.16 queries live here (`getOverview(year)`, `getYearsWithData()`, `getMonthOverMonthCategoryChanges(...)`, `getOverviewChart(year)`). The existing preset-based `getOverview(preset)`, `getAggregatedTransactionsData(preset)`, `getMonthlyTrendByNature(preset)` in `lib/dal/dashboard.ts` stay **intact and working** → `yarn build` stays green between Phase 42 and 43. Phase 43 swaps `overview/page.tsx` to the new queries; cleanup deletes the old ones. Same one-concern-per-file pattern as `lib/dal/months-with-data.ts`.
- **D-10 — Chart series IS in scope (rich query).** `getOverviewChart(year)` returns, per month: `{ income: { recurring, extraordinary }, out: { <per-nature> } }`. Phase 44's filter chips (income type + expense nature) become **client-side slicing** of this payload — no extra round-trips. This satisfies the milestone goal "all data contracts in place" and exercises `income_extraordinary` immediately.
- **D-11 — YTD bound = last month with data (equal-span comparison).** For the in-progress year, `getOverview(year)` spans Jan → **last month with transactions** (not the partial current calendar month); the YTD-vs-prior-YTD delta compares Jan→same month of the prior year. Avoids comparing a partial 2026 month against a complete 2025 month. Consistent with the Reference Period redefinition (D-12).

### Glossary — D-12..D-13 (DATA-04)

- **D-12 — Reference Period redefined to "ultimo mese con dati" — glossary only.** CONTEXT.md (the project glossary) redefines **Reference Period** as "the last month that has transaction data" (the PO's point: "completo" is not knowable, only "imported" is). The **Deviation engine (`getDeviationDateRanges`) is NOT changed in this phase** — see Deferred. The glossary thus describes the *target* semantics; the Deviation code's migration is a tracked follow-up. Known, accepted doc-vs-code drift.
- **D-13 — `MonthOverMonthChange` becomes the canonical internal term.** Query `getMonthOverMonthCategoryChanges`. This is mese-su-mese, distinct from `Deviation` (vs 3-month Baseline). The word **"variazione" stays banned** (already reserved-deprecated). User-facing copy: "Rispetto al mese scorso" / "Dove hai speso di più" / "Dove hai risparmiato".

### Claude's Discretion
- `getYearsWithData()` (DATA-03): distinct years that have ≥1 transaction, DESC; reuse the `getMonthsWithData('transactions')` pattern (`DISTINCT TO_CHAR(occurred_at, 'YYYY')`, user-scoped via `verifySession()`).
- Exact TypeScript return-type shapes and the `react cache()` wrapping mirror existing `lib/dal/dashboard.ts` conventions (string DECIMALs, Decimal.js for any arithmetic, try/catch → safe empty fallback).
- Reference Period glossary wording (exact Italian phrasing) at writer's discretion, preserving the `_Avoid_` lines.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design source (LOCKED)
- `app/proto/overview/NOTES.md` — the full locked redesign: chart variant A + header H1, movers humanization, 4-KPI + inline nudge, income/nature filters, qualitative KPI readings. The three open questions and the Reference Period tension are stated here. **Read first.**
- `app/proto/overview/mock-data.ts` — intended data shapes: `INCOME_TYPES = ['recurring','extraordinary']`, 6 `USCITE_NATURES`, per-month `{ income, uscite }`, `Mover` type, `CATEGORIES_2026/2025`.

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — v1.16 contract; DATA-01..04 map to this phase; FILT-01 flags the income-split schema question resolved here.
- `.planning/ROADMAP.md` §"Phase 42" — goal + success criteria.

### Glossary (target of DATA-04)
- `CONTEXT.md` §"Dashboard e analisi" — current definitions of Reference Period, Baseline, Deviation, Noise Threshold, Preset; the `_Avoid_` discipline. This file is **edited** by this phase.

### Existing code to extend / mirror
- `lib/dal/dashboard.ts` — current `getOverview(preset)`, `getAggregatedTransactionsData`, `getMonthlyTrendByNature`, `buildOverviewData`, `computeSavingsRate`, `getOverviewAmountTotals`, the `notTransferCategory()` / `notExcludedFromTotals()` / `dateScopedTransactions()` helpers, and `DASHBOARD_TOTAL_EXPENSE_STATUSES`. New `lib/dal/overview.ts` mirrors these patterns.
- `lib/dal/months-with-data.ts` — pattern for `getYearsWithData()`.
- `lib/utils/nature-labels.ts` — `FlowNature` union + `NATURE_LABELS/ORDER/COLORS`; all must gain `income_extraordinary` and relabel `income` → "Entrate ricorrenti".
- `lib/db/schema.ts` §`flowNatureEnum` (line ~52), `subCategory.nature`, `userSubcategoryOverride.nature` — enum to extend.
- `scripts/seed-extras.ts` §`NATURE_SLUGS` / `setSubcategoryNature` (lines ~53-200) — pattern for the additive re-bucketing STEP.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`buildOverviewData` + `computeSavingsRate` + `computeDeltaPercent`** (`lib/dal/dashboard.ts`): the 4-KPI + delta math already exists; year-scoped `getOverview` reuses the builders, only the date ranges change (YTD span vs prior-YTD span).
- **`getOverviewAmountTotals`** pattern (positive→totalIn, abs(negative)→totalOut, excludes transfers + `excludeFromTotals`) is the canonical totals SQL to reuse.
- **`getMonthlyTrendByNature`** already groups per month × `coalesce(userSubcategoryOverride.nature, subCategory.nature)` — this is the template for `getOverviewChart`'s per-nature OUT segments and per-income-type IN segments.
- **`getCategoryDeviations`** groups per category over two date windows — structurally close to the movers query (swap Baseline window for "previous calendar month").

### Established Patterns
- DAL files: `import 'server-only'`, `react cache()`, `verifySession()` for user scoping, try/catch → empty fallback, DECIMAL columns returned as strings, month bucket via `to_char(occurred_at, 'YYYY-MM')`.
- Dashboard totals always exclude `category.type = 'transfer'` and `subCategory.excludeFromTotals = true`, and filter expense status to `['1','2','3']`.
- Seed is additive: new column values land via a new `seed-extras.ts` STEP (idempotent UPDATE by slug), never by editing `seed-data.ts`.

### Integration Points
- `getOverview(preset)` & friends are consumed **only** by `app/(app)/dashboard/overview/page.tsx` (rewritten in Phase 43) — safe to leave untouched and parallel new functions.
- `income_extraordinary` flows into every `Record<FlowNature | 'unclassified', …>` (e.g. `buildMonthlyNatureTrendData.emptySegments`) and the settings nature picker.

</code_context>

<specifics>
## Specific Ideas

**Candidate income re-bucketing (PO to confirm in execution).** Current `income`-nature slugs (`scripts/seed-extras.ts`):
- **Keep `income` (recurring):** `stipendio-base`, `indennita`, `overtime` — and dividend streams if the PO considers them regular (`dividendi-azionari`, `dividendi-fondi-comuni`, `dividendi-immobiliari`).
- **Move to `income_extraordinary`:** `bonus`, `freelance`, `consulenze`, `progetti-occasionali`, `commissioni`.
- **From `financial` → `income_extraordinary` (per D-03):** `vendita-di-beni-usati`, `commercio-online`, `immobili-vendita`, `vendita-investimenti`, `rimborso-*`, `cashback-*`, `bonifico-in-entrata`, `rimborsi`, `ricariche-conti`. (Leave OUT-side `financial` slugs — `azioni`, `obbligazioni`, `criptovalute`, `fondi-comuni`, `immobili`, `bonifico-in-uscita` — as `financial`.)

This list is a starting point; the exact membership is a domain call confirmed during the seed STEP.

</specifics>

<deferred>
## Deferred Ideas

- **Align the Deviation engine to "ultimo mese con dati".** D-12 redefines Reference Period in the glossary only; migrating `getDeviationDateRanges` (and the Categories page behavior) to actually compute from the last month *with data* is a separate, behavior-changing task with blast radius on an existing shipped feature — out of scope for this data-foundation phase. Tracks the known doc-vs-code drift.
- **FlowNature friendly display-labels rename (EDU-FUT-01).** e.g. "Discrezionale" → "Sfizi/Extra", keeping canonical economic values internal. Cross-cutting (CONTEXT.md, seed, `SubcategoryNatureSelect`, charts, user overrides) → separate quick task, explicitly NOT this milestone.
- **None of the above are in Phase 42 scope** — discussion stayed within the data-layer boundary.

</deferred>

---

*Phase: 42-overview-data-layer*
*Context gathered: 2026-06-07*
