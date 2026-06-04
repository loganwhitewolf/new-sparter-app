# Phase 40: table-filter-sort — Context

**Gathered:** 2026-06-04
**Status:** Ready for planning
**Source:** ADR Ingest + grill-with-docs session (2026-06-04)

<domain>
## Phase Boundary

Replace three divergent per-table controls (Transactions, Expenses, Files) with one coherent filtering + sorting system. Same behaviour and same UI shape everywhere; only the **declared fields** differ per table. Ships as a single phase with 5 ordered plans (waves), each independently verifiable and deployable.

Scope: `DataTableToolbar` shared component + per-table declarative config + DAL plumbing + month-multi picker + amount-range control + wiring across all three tables + polish.

Out of scope: operator-rich filter engine, saved/named views, CSV export of filtered data, per-field AND/OR operators.

</domain>

<decisions>
## Implementation Decisions

### Architecture (ADR 0010 — LOCKED)
- D-01: **Harmonize, not a filter engine.** Shared UI (`DataTableToolbar`) + per-table declarative `TableConfig`. No `{field, operator, value}[]` query builder.
- D-02: **URL = single source of truth.** Filters are ephemeral (no localStorage). Share link = share view; refresh/back preserve filters.
- D-03: **Server-side filtering** in the DAL. Zod-validated `searchParams` → DAL conditions.
- D-04: **Pagination unchanged:** offset + infinite-scroll (IntersectionObserver) + "Carica altre 50" fallback + "tutte caricate" end state + `aria-live`. Offset is client state, **not** in the URL.
- D-05: **Default view:** no filters applied, newest-first, streamed. Removes the Expenses `this-month` default.
- D-06: **`id` tiebreaker on every DAL `orderBy`** — fixes latent offset-window duplication/skip bug, acute for amount sort.

### Temporal model (ADR 0009 — LOCKED)
- D-07: Temporal filter unit = **calendar month**, not free date range.
- D-08: **Multi-select** of `(year, month)` pairs, label format "Mag 2026".
- D-09: Picker offers **only months that contain data** (new DAL query: `getMonthsWithData(table)`).
- D-10: Relative presets ("Ultimi 3 mesi", "Quest'anno", "Anno scorso") = optional shortcuts resolving to concrete month chips.
- D-11: **Expenses have NO temporal filter** — aggregate entity; no date is meaningful (ADR 0009, justified omission).
- D-12: **Month picker at scale = year-grid.** Switcher for year + 12-cell month grid (cells disabled where no data) + "Tutto l'anno" toggle + relative presets. Validated against 3 years of mock data in prototype.

### UI pattern (Prototype Verdict — Variant A — LOCKED)
- D-13: **Ordinamento = column headers only** (desktop). `aria-sort` on each sortable column header; click → ASC → DESC → off cycle. Mobile = detached "Ordina" control.
- D-14: **Filtri = "Filtri (n)" trigger** opening a panel with the table's declared filter controls. Active filters = removable chips + "Cancella tutto".
- D-15: Search (`q`) always visible inline (not inside the panel).
- D-16: Mobile filter panel = **vaul bottom sheet** (reuse SubcategoryPicker pattern).
- D-17: **Every displayed column is sortable.** Text columns → Italian case/accent-insensitive collation (`ASC/DESC`); amount → numeric; date → chronological; tiebreaker `id` always appended.
- D-18: Variants B and C discarded; no pieces carried forward.

### Field inventory (LOCKED)
| Field | Transactions | Expenses | Files |
|-------|-------------|----------|-------|
| Search (`q`) | description | title | filename / label |
| Months (temporal) | occurredAt | ❌ none | coverage months |
| Amount range | ✅ add | ✅ add (totalAmount) | total amount |
| Category / Subcategory | ✅ | ✅ | ❌ |
| Platform | ✅ | ✅ (via file join) | ✅ |
| Status | categorization (2 states) | categorization (2 states) | processing (3 buckets) |

- D-19: **Search param key unified to `q`** across all tables (was `name` on Transactions).
- D-20: **Amount filter = absolute value** (`|amount|`): "10–200 €" matches income and expense of that magnitude.
- D-21: **Status = categorization** for Transactions & Expenses: `categorized` / `uncategorized`.
- D-22: **Status = processing** for Files, collapsed to 3 buckets: `Importato` (`imported`), `Da completare` (`uploaded`+`analyzed`+transient states), `In errore` (`failed`).
- D-23: **Labels confirmed:** "Categorizzazione" for T/E status, "Elaborazione" for Files status.

### DAL changes
- D-24: `orderBy` on joined name columns (`category`, `platform`) — verify index / query plan acceptable.
- D-25: Status sort: uncategorized-first on `asc` (actionable), categorized-first on `desc`.

### Config contract (reference — refine in planner)
```ts
type FilterFieldType = 'text' | 'select' | 'multi-select' | 'month-multi' | 'amount-range' | 'status'
type FilterField = { key: string; label: string; type: FilterFieldType; options?: ...; toChip: (v: string) => string }
type SortColumn = { key: string; label: string }
type TableConfig = { id: 'transactions'|'expenses'|'files'; search: { key: 'q'; placeholder: string }|null; filters: FilterField[]; sortable: SortColumn[]; defaultSort: { key: string; dir: 'asc'|'desc' } }
```
A shared `<DataTableToolbar config={…}/>` consumes this; per-table files declare the instance.

### Open items (confirm during planning, not design decisions)
- O-01: Expense status `4` semantics (enum 1–4; UI maps 1=uncategorized, 2/3=categorized — what is 4?).
- O-02: Files import-date: sortable/displayed column, NOT a filter (coverage months = temporal filter for Files).
- O-03: Relative month presets — keep or drop; already validated in prototype, lean keep.
- O-04: Server-revalidation collapses infinite-scroll to first 50 (table remount via `key`) — accept.
- O-05: Amount filter: absolute value confirmed in decisions; implementation uses `WHERE ABS(amount) BETWEEN ? AND ?`.

### Related (out of scope for this phase — separate task)
- Transfer rows rendered neutral (cell-rendering only; detection: subcategory belongs to `type='transfer'` category). **Do NOT include in this phase.**

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked design documents
- `.planning/table-filter-sort-DECISIONS.md` — full design decisions + open items + proposed config contract
- `docs/adr/0009-month-based-temporal-filtering.md` — month-based temporal filter rationale
- `docs/adr/0010-unified-table-filter-sort-architecture.md` — harmonize-not-engine rationale
- `app/proto/table-toolbar/NOTES.md` — prototype verdict (Variant A wins)
- `app/proto/table-toolbar/variant-a.tsx` — working reference implementation to extract patterns from

### Existing table implementations (files to harmonize)
- `app/(app)/transactions/` — current Transactions page + search/filter state
- `app/(app)/expenses/` — current Expenses page + `this-month` default (to remove)
- `app/(app)/import/` — current Files/import table

### DAL layer
- `lib/dal/` — existing DAL queries; all `orderBy` calls need `id` tiebreaker
- `lib/db/schema.ts` — Drizzle schema; column types, foreign keys

### Shared UI patterns to reuse
- `components/ui/` — shadcn components (Popover, Badge, Input, etc.)
- `app/(app)/import/[fileId]/_components/` — vaul bottom sheet usage reference (SubcategoryPicker)

### CLAUDE.md constraints
- `CLAUDE.md` — Next.js 16 App Router, Drizzle `searchParams` Zod validation, server-side queries in DAL layer

</canonical_refs>

<specifics>
## Specific Implementation Notes

### 5-wave roadmap (plan order — LOCKED)
1. **Wave 1 — Foundation:** Shared types (`TableConfig`, `FilterField`, `SortColumn`) + URL contract (Zod `searchParams` parser) + `id` tiebreaker patch to ALL existing DAL `orderBy`. Ships independently (pure DAL/type change, no UI).
2. **Wave 2 — Shared UI:** `DataTableToolbar` component — search input, "Filtri (n)" trigger → panel, active-chip row, "Cancella tutto", header-sort (desktop, `aria-sort`), mobile "Ordina" detached control. No table wiring yet; renders against a mock config.
3. **Wave 3 — New controls:** `MonthMultiPicker` (year-grid + presets + `getMonthsWithData` DAL query) + `AmountRangePicker` (absolute value). Replace existing free date-range on Transactions and `period` preset on Expenses.
4. **Wave 4 — Wire per-table configs:** Declare `TableConfig` for Transactions (add amount, months, fix `q` key) → Expenses (drop date filter, add amount + category + platform + status) → Files (3 processing buckets, coverage months, amount). Each wired table verifies end-to-end.
5. **Wave 5 — Polish:** "Nessun dato" vs "nessun risultato" empty states distinction; a11y pass (`aria-sort`, `aria-live`, screen reader labels); URL migration (`name`→`q`, `from/to`→`months`, remove `period`); prototype route deletion; `yarn build` green.

### Mobile behaviour (design, not prototype-tested)
- Filter panel = vaul bottom sheet (same as SubcategoryPicker).
- Sort = detached "Ordina" button below search that opens a simple list of sortable columns.
- Implementation decision: treat mobile as Wave 2 responsibility (scaffold the hook points) even if full mobile UX is finalized in Wave 5.

### Key invariants
- `id` tiebreaker must be the LAST element in every `orderBy` array.
- `getMonthsWithData` query must be per-table (different columns: `occurredAt` for transactions, coverage months for files).
- Amount range uses `WHERE ABS(amount) BETWEEN :min AND :max`; min defaults to 0, max to +∞ (no upper bound if omitted).
- Month URL encoding: `months=2026-04,2026-05` (ISO year-month, comma-separated).
- Expenses `this-month` default removal is a deliberate UX change — default view = all time, no filters.

</specifics>

<deferred>
## Deferred Ideas

- Transfer rows neutral rendering — separate task (detection via category `type='transfer'`).
- Saved/named views (stored querystring).
- CSV export of filtered data.
- Per-field AND/OR operators / operator-rich filter engine.
- Intra-month date range filtering.
- O-01: Expense status `4` — resolve during Wave 4 planning; if unknown, map to `uncategorized` bucket conservatively.

</deferred>

---

*Phase: 40-table-filter-sort*
*Context gathered: 2026-06-04 — locked design from grill-with-docs session + ADR 0009/0010 + prototype verdict (Variant A)*
