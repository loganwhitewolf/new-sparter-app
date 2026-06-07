# Phase 42: overview-data-layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-07
**Phase:** 42-overview-data-layer
**Areas discussed:** Income split, Month-over-month movers, Query surface & migration

---

## Income split (recurring vs extraordinary)

User pushed back on the initial framing (dedicated column would be `null` for all OUT rows) and proposed treating the split as a new `nature` instead. Confirmed grounded by codebase: Phase 37's `nature` seeding does not cleanly separate income (`income` mixes recurring + one-off; in-side income also lives under `financial`).

### Q1 — Form of the split (after reframing to `nature`)

| Option | Description | Selected |
|--------|-------------|----------|
| V1 — add `income_extraordinary` (income stays recurring) | Additive `ALTER TYPE ADD VALUE`; relabel `income` → "Entrate ricorrenti"; seed-extras re-buckets straordinari. Non-destructive. | ✓ |
| V2 — `income_recurring` + `income_extraordinary` (replace income) | Symmetric names but requires recreating the enum type + remapping all rows. Destructive. | |
| Dedicated `incomeType` column | Separate enum column, `null` on all OUT rows. Parallel classification axis. | |

**User's choice:** V1 — additive enum value.
**Notes:** First reformulated the original 3-option question (dedicated column / static map / derive-from-nature) per user request; user's own suggestion ("non possiamo creare una nuova nature? income-ricorrente e income-straordinaria?") became the lead direction.

### Q2 — In-side `financial` rows (vendite, cashback, rimborsi, dividendi)

| Option | Description | Selected |
|--------|-------------|----------|
| Confluiscono in `income_extraordinary` | Every `in` subcategory → income or income_extraordinary; filter covers 100% of in side. | ✓ |
| Restano `financial` (fuori dal filtro entrate) | More faithful to `financial` semantics but leaves a gap in the income filter. | |
| Lock principle only, slugs to PO | Fix the rule, defer per-slug classification. | |

**User's choice:** Fold into `income_extraordinary` — clean 2-bucket income model.

---

## Month-over-month movers

### Q1 — Granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Categoria | Category-level movers, matches NOTES copy `{categoria}`. | ✓ |
| Sottocategoria | More granular/actionable but more rows + noise. | |

### Q2 — Meaning of "previous month" + empty state

| Option | Description | Selected |
|--------|-------------|----------|
| Mese di calendario precedente (anche se vuoto) | X vs X-1 calendar; empty prev → all "spesa nuova"; crosses year boundary. | ✓ |
| Mese-con-dati precedente (salta i buchi) | X vs last month with data; gaps skipped. | |
| Calendar-adjacent, confine anno = empty | X vs X-1 but never crosses year boundary. | |

### Q3 — €15 threshold target + sort

| Option | Description | Selected |
|--------|-------------|----------|
| Su \|Δ€\|, ordina per \|Δ€\| desc | Hide changes < €15; sort by change magnitude. | ✓ |
| Sulla spesa del mese, ordina per \|Δ€\| desc | Deviation-style threshold on month spend. | |

**User's choice:** Category-level; previous calendar month (crosses year boundary, empty prev → "spesa nuova"); threshold on |Δ€|, sort by |Δ€| desc.
**Notes:** MOVE-05 "first month → empty state" reclassified as a Phase 45 UI default-selection concern; the data query returns an empty array only when the month has no OUT spend.

---

## Query surface & migration

### Q1 — getOverview signature migration

| Option | Description | Selected |
|--------|-------------|----------|
| New file `lib/dal/overview.ts`, year-scoped | Old preset functions stay intact → build green between phases; cleanup deletes later. | ✓ |
| Change `getOverview` in-place to `(year)` | Breaks overview/page.tsx build until Phase 43. | |

### Q2 — Chart series in scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — rich `getOverviewChart(year)` (client-side filters) | Per-month income/out split baked in; Phase 44 chips = client slicing. | ✓ |
| No — only DATA-01..04; series at 43/44 | Reuse/adapt existing per-month queries later. | |

### Q3 — YTD end-bound for current year

| Option | Description | Selected |
|--------|-------------|----------|
| Ultimo mese con dati (equal-span) | Jan→last month with data; delta vs same span prior year. | ✓ |
| Mese di calendario corrente (può essere parziale) | Literal to NOTES but compares partial month vs full prior. | |

**User's choice:** New `lib/dal/overview.ts`; ship rich `getOverviewChart(year)`; YTD bound = last month with data.

---

## Claude's Discretion

- **Reference Period redefinition (DATA-04)** — user deselected this area, delegating to Claude. Decision: glossary-only redefinition to "ultimo mese con dati" + introduce `MonthOverMonthChange` canonical term; **do NOT** change the Deviation engine (`getDeviationDateRanges`) this phase. Presented to the user in the wrap-up; user accepted ("OK così, scrivi CONTEXT.md").
- `getYearsWithData()` shape — distinct years DESC, reuse `months-with-data.ts` pattern.
- TypeScript return-type shapes, `react cache()` wrapping, Italian glossary phrasing — mirror existing DAL conventions.

## Deferred Ideas

- Align the Deviation engine to "ultimo mese con dati" (behavior change on the Categories page) — separate tracked follow-up; resolves the known doc-vs-code drift introduced by D-12.
- FlowNature friendly display-labels rename (EDU-FUT-01) — separate quick task, not this milestone.
