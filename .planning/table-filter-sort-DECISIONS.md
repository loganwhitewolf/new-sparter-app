# Table Filter & Sort — Design Decisions

Locked design from the grill-with-docs session of 2026-06-04. Source of truth for `/gsd-plan-phase`.
See also: `docs/adr/0009-month-based-temporal-filtering.md`, `docs/adr/0010-unified-table-filter-sort-architecture.md`.

## Goal

One coherent filtering + sorting system across all tables (Transactions, Expenses, Files). Same behaviour and UI everywhere; only the **declared fields** change per table. Clean visual + verbal separation between **Filtri** and **Ordinamento**.

## Locked decisions

### Architecture
- **Harmonize, not a filter engine.** Shared UI + per-table declarative config. No per-field operators, no AND/OR query builder. (ADR 0010)
- **URL = single source of truth** (unchanged); sessionStorage is a per-tab restore layer for bare navigation only (quick task 260707-fy4) — saved on every filter/sort change per table, restored via `router.replace` only when the URL has no search params. A URL with params (shared link, refresh, back/forward) always wins; localStorage still rejected.
- **Server-side filtering** in the DAL (unchanged). Zod-validated searchParams → DAL conditions.
- **Pagination unchanged:** offset + infinite-scroll (IntersectionObserver) + "Carica altre 50" fallback + "tutte caricate" end state + `aria-live`. Offset is client state, **not** in the URL.
- **Default view everywhere:** no filters applied, newest-first, streamed. Removes the Expenses `this-month` default.
- **Tiebreaker `id` on every sort** (bug fix; offset windows otherwise duplicate/skip on non-unique sorts — acute for amount).

### Temporal model (ADR 0009)
- Temporal filter unit = **calendar month**, not free date range.
- **Multi-select** of `(year, month)`, label like "Mag 2026".
- Picker offers **only months that contain data** (derived like Months Covered).
- Relative presets ("ultimi 3 mesi") = optional shortcuts that resolve to concrete month chips. Validate in prototype.
- The same month primitive = the Files coverage **month tags** (replaces the "coverage date range" field).
- **Month picker at scale (multi-year): year-grid.** With years of data (e.g. 36 months) a flat list doesn't scale. Picker = a **year switcher + 12-cell month grid** for the active year (cells disabled where no data), a **"Tutto l'anno"** toggle, and the relative presets ("Ultimi 3 mesi / Quest'anno / Anno scorso") as the fast path. Cross-year selections accumulate into chips. Multi-select preserved. Prototyped in `app/proto/table-toolbar` against 3 years of mock data.

### Coherence contract
- Identical behaviour + identical fields **where the domain makes them meaningful**. Omit a field only when meaningless, never out of laziness.

### Field inventory (per table)

| Field | Transactions | Expenses | Files |
|---|---|---|---|
| Search (text) | description | title | filename / label |
| Months (temporal) | occurredAt | — (aggregate, no meaningful date) | coverage / reference |
| Amount range | ✅ add | ✅ add (totalAmount) | total amount |
| Category / Subcategory | ✅ | ✅ | — |
| Platform | ✅ | ✅ (join via file) | ✅ |
| Status | Categorization | Categorization | Processing (3 buckets) |

- Search param key **unified to `q`** across tables (was `name` vs `q`).
- **Amount filter = absolute value** (`|amount|`): "10–200 €" matches both income and expense of that magnitude. Direction is carried by sign/type, not by the amount range. (Amount *sort* stays signed.)
- **Status = categorization** (categorized / uncategorized) for Transactions & Expenses. Direction (in/out) is carried by amount sign; transfers are a *category* (Trasferimenti), not a status.
- **Status = processing** for Files, collapsed to 3 buckets:
  - **Importato** = `imported`
  - **Da completare** = `uploaded` + `analyzed` (+ transient `analyzing`/`importing`); UI shows the next action
  - **In errore** = `failed` (parse / platform-not-recognized / import error; recoverable via re-analyze)
- Recommended status labels: **"Categorizzazione"** vs **"Elaborazione"** (confirm in prototype).

### UX — Filtri vs Ordinamento
- **Ordinamento = Option A:** sort lives on **column headers** (desktop). `aria-sort` already present. Mobile = **detached "Ordina" control**. One state in URL (`sort`+`dir`).
- **Every displayed column is sortable** (not just date/amount): text columns (description, category, platform, status) sort **alphabetically** with an **Italian, case- and accent-insensitive collation**; amount = numeric, date = chronological; `id` tiebreaker always appended. DAL note: `category`/`platform` are **joined** name columns → `ORDER BY` on the joined column; verify a usable index / acceptable plan. Status sort groups uncategorized-first on `asc` (actionable).
- **Filtri = Option C:** compact bar (search always visible) + **"Filtri (n)"** trigger opening a panel with the table's declared controls. Active filters = **removable chips** + **"Cancella tutto"**.
- Mobile filter panel = **vaul bottom sheet** (reuse the shipped SubcategoryPicker interaction).
- Each field declares a **label→chip** function (e.g. "Categoria: Alimentari", "Mesi: Apr, Mag").

### Related (separate task, same feature area)
- **Transfer rows rendered neutral** (neither green nor red, near-"disabled") in tables. Detection: row's subcategory belongs to a category `type='transfer'` (≡ `nature='transfer'`). Not filter/sort — a cell-rendering task.

## Open decisions

1. **Expense status `4`** — meaning unknown (enum is 1–4; UI maps 1=uncategorized, 2/3=categorized). Confirm what `4` is and how it maps to the categorization filter.
2. **Files import-date as a filter** — default: import date is a **sortable/displayed** column, not a filter (coverage months is the file temporal filter). Confirm.
3. **Status labels** — "Categorizzazione" vs "Elaborazione" recommended; ratify in prototype.
4. **Relative month presets** — keep as shortcuts or drop; decide from prototype.
5. **Server-revalidation collapses infinite-scroll to first 50** (table remount via `key`). Accept, or preserve loaded window across revalidation?

## Proposed config contract (deliverable — refine in plan-phase)

```ts
type FilterFieldType =
  | 'text' | 'select' | 'multi-select'
  | 'month-multi' | 'amount-range' | 'status'

type FilterField = {
  key: string                              // URL param key
  label: string                            // panel label
  type: FilterFieldType
  options?: { value: string; label: string }[]   // select/multi/status
  toChip: (value: string) => string        // active-chip renderer
}

type SortColumn = { key: string; label: string }  // header-driven

type TableConfig = {
  id: 'transactions' | 'expenses' | 'files'
  search: { key: 'q'; placeholder: string } | null
  filters: FilterField[]
  sortable: SortColumn[]
  defaultSort: { key: string; dir: 'asc' | 'desc' }  // newest-first
}
```

A shared `<DataTableToolbar config={…}/>` consumes this; per-table files (`transactions.table.ts`, …) declare the instance. DAL maps each `key` to a column/condition with the `id` tiebreaker appended.

## Roadmap (proposed)

1. **Foundation** — shared types + URL contract + generalized Zod parsing; add `id` tiebreaker to all DAL sorts (ships independently).
2. **Shared UI** — `DataTableToolbar` (search + Filtri panel + active chips + Cancella tutto) + header-sort + mobile detached sort.
3. **New controls** — month-multi (months-with-data query) + amount-range; replace free date-range / expenses `period`.
4. **Wire per-table configs** — Transactions → Expenses (drop this-month default + date filter, add amount) → Files (3 status buckets, coverage months).
5. **Polish** — distinguish "nessun dato" vs "nessun risultato" empty states; transfer neutral rendering (separate task); a11y pass.

## Risks

- Offset instability without tiebreaker → fixed in step 1.
- URL param migration (`name`→`q`, `from/to`/`period`→months) breaks old bookmarks — low impact (single user).
- Month-only filtering forecloses intra-month analysis — accepted (ADR 0009); reversal has cost.
- Expense status `4` unknown semantics could break categorization filter mapping (open #1).
- Scope creep toward the filter-engine — guarded by ADR 0010.
- Perf: amount-range + multi-month OR + joins → verify indexes (amount needs an index; `occurredAt`/`status` already indexed).
