---
phase: 40-table-filter-sort
plan: "03"
subsystem: data-table-pickers
tags: [dal, picker, month-filter, amount-filter, tdd, components]
dependency_graph:
  requires:
    - lib/utils/table-config.ts (FilterFieldType — Wave 1)
    - components/data-table/use-table-url.ts (updateParam — Wave 2)
    - components/data-table/DataTableToolbar.tsx (Wave-2 placeholders — now replaced)
  provides:
    - lib/dal/months-with-data.ts (getMonthsWithData — per-table distinct-month query)
    - components/data-table/MonthMultiPicker.tsx (year-grid multi-select month picker + monthLabel)
    - components/data-table/AmountRangePicker.tsx (absolute-value min/max inputs)
    - components/data-table/DataTableToolbar.tsx (month-multi and amount-range branches wired)
    - tests/months-with-data-dal.test.ts (6 unit tests for DAL query)
  affects:
    - Wave 4 (per-table config files pass monthsWithData prop + pages call getMonthsWithData)
tech_stack:
  added: []
  patterns:
    - TDD RED→GREEN cycle for DAL query (cache + verifySession pattern)
    - db.execute + sql template (parameterized userId only; column/format strings static)
    - year-grid month picker with monthsWithData prop (data-aware disabled cells)
    - flatMap chip builder (month chips emitted one-per-YYYY-MM for granular removal)
key_files:
  created:
    - lib/dal/months-with-data.ts
    - components/data-table/MonthMultiPicker.tsx
    - components/data-table/AmountRangePicker.tsx
    - tests/months-with-data-dal.test.ts
  modified:
    - components/data-table/DataTableToolbar.tsx
decisions:
  - "month chips emitted one-per-YYYY-MM (not one aggregate chip) — granular removal better UX; chip label uses monthLabel() so 'Mag 2026' not '2026-05'"
  - "countActiveFilters treats amount-range as one active filter unit (amountMin OR amountMax present = 1)"
  - "clearAllFilters explicitly clears amountMin + amountMax for amount-range fields (not just the field.key)"
metrics:
  duration_seconds: 222
  completed_date: "2026-06-04"
  tasks_completed: 2
  files_changed: 5
---

# Phase 40 Plan 03: New Filter Controls — MonthMultiPicker + AmountRangePicker + DAL Summary

**One-liner:** Session-scoped `getMonthsWithData` DAL query (TDD) + data-aware `MonthMultiPicker` (year-grid, presets, "Tutto l'anno") + `AmountRangePicker` (absolute-value inputs) replacing Wave-2 placeholders in `DataTableToolbar`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests for getMonthsWithData | 28c4ef1 | tests/months-with-data-dal.test.ts |
| 1 (GREEN) | getMonthsWithData DAL implementation | dc89f6b | lib/dal/months-with-data.ts |
| 2 | MonthMultiPicker + AmountRangePicker + toolbar wiring | fe78d52 | components/data-table/MonthMultiPicker.tsx, AmountRangePicker.tsx, DataTableToolbar.tsx |

## What Was Built

### Task 1 — getMonthsWithData DAL (TDD)

`lib/dal/months-with-data.ts`:
- `getMonthsWithData(table: 'transactions' | 'files'): Promise<string[]>` — `cache()`-wrapped, `verifySession()`-scoped
- `'transactions'` branch: `DISTINCT TO_CHAR(occurred_at, 'YYYY-MM') AS ym FROM transaction WHERE user_id = $1 ORDER BY ym DESC`
- `'files'` branch: `DISTINCT TO_CHAR(reference_started_at, 'YYYY-MM') AS ym FROM file WHERE user_id = $1 AND reference_started_at IS NOT NULL ORDER BY ym DESC`
- `userId` is parameterized via `sql` template (T-40-06 mitigated); column/format strings are static
- Returns `string[]` mapped from `result.rows`; returns `[]` for empty result

**Test results:**
```
yarn vitest run tests/months-with-data-dal.test.ts
  Test Files  1 passed (1)
       Tests  6 passed (6)
```

### Task 2 — MonthMultiPicker + AmountRangePicker + toolbar wiring

`components/data-table/MonthMultiPicker.tsx`:
- Props: `{ value: string[]; monthsWithData: string[]; onChange: (months: string[]) => void }`
- Year switcher (`viewYear` useState) + 12-cell month grid (MONTH_ABBR Italian abbreviations)
- Disabled cells: `cursor-not-allowed border-dashed text-muted-foreground/30` (no data for that YYYY-MM)
- "Tutto l'anno" toggle: selects/clears all enabled months in the viewed year
- Relative presets (D-10): "Ultimi 3 mesi" (last 3 from monthsWithData), "Quest'anno", "Anno scorso"
- Exported `monthLabel(ym)`: formats `YYYY-MM` → Italian short form e.g. "Mag 2026" via `Intl.DateTimeFormat('it-IT', { month: 'short', year: 'numeric' })`

`components/data-table/AmountRangePicker.tsx`:
- Props: `{ min: string; max: string; onMin: (v: string) => void; onMax: (v: string) => void }`
- Two `<Input type="number" inputMode="decimal">` with "min €" / "max €" placeholders, separated by en-dash
- Absolute-value semantics enforced DAL-side in Wave 4

`components/data-table/DataTableToolbar.tsx` (modifications):
- `month-multi` branch: renders `<MonthMultiPicker>` reading `searchParams.get('months')?.split(',')` and writing `onParamChange('months', m.join(','))`
- `amount-range` branch: renders `<AmountRangePicker>` reading/writing `amountMin` / `amountMax` URL keys
- chip builder changed from `map` to `flatMap`: month chips are one-per-YYYY-MM with `monthLabel` labels; amount chips are separate min/max chips
- `countActiveFilters`: amount-range treated as 1 unit (amountMin OR amountMax present)
- `clearAllFilters`: explicitly clears `amountMin` + `amountMax` for amount-range fields
- `FilterPanel` receives `monthsWithData` prop and passes it to `FilterField`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Granular month chip removal**
- **Found during:** Task 2 (chip builder design)
- **Issue:** Plan specified `months=YYYY-MM,YYYY-MM` comma-encoded URL. If one aggregate chip is built for all months, removing it clears all months at once — poor UX for multi-month selections
- **Fix:** `flatMap` chip builder emits one chip per YYYY-MM with individual `onRemove` that filters that month from the comma list. The aggregate chip approach would have been technically correct but functionally weak
- **Files modified:** components/data-table/DataTableToolbar.tsx
- **Commit:** fe78d52

**2. [Rule 2 - Missing functionality] amount-range requires special handling in clearAllFilters and countActiveFilters**
- **Found during:** Task 2 (implementing clearAllFilters)
- **Issue:** `amount-range` field maps to two URL keys (`amountMin`/`amountMax`) but is declared as one `FilterField`. The original `clearAllFilters` and `countActiveFilters` only handled one key per field
- **Fix:** `clearAllFilters` explicitly emits `amountMin: null` and `amountMax: null`; `countActiveFilters` checks either key presence and counts as 1
- **Files modified:** components/data-table/DataTableToolbar.tsx
- **Commit:** fe78d52

## Known Stubs

None. The Wave-2 placeholders ("Selettore mesi — Wave 3", "Range importo — Wave 3") have been replaced by the real components.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced.

- `getMonthsWithData`: `userId` from `verifySession()` only; parameterized via `sql` template (T-40-06 mitigated, T-40-08 mitigated)
- `MonthMultiPicker`: emits only YYYY-MM strings from the `monthsWithData` prop (server-supplied); no arbitrary user input enters SQL
- `AmountRangePicker`: collects numeric strings; absolute-value semantics and input validation enforced DAL-side (Wave 4, T-40-07 mitigated via Wave-1 `parseAmount` parser)
- No unmitigated surface added

## Self-Check: PASSED
