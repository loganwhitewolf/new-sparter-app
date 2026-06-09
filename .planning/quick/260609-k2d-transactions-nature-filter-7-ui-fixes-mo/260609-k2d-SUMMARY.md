---
quick_id: 260609-k2d
phase: quick
subsystem: transactions/expenses/import/data-table
tags: [filters, ui, dal, ux, transactions, expenses, imports]
dependency_graph:
  requires: []
  provides:
    - FlowNature filter on transactions (nature URL param)
    - In/Out/Transfer filter on transactions (type URL param)
    - categoryType on TransactionListRow
    - platformName on ExpenseRow
    - pending prop on SubcategoryPicker
  affects:
    - lib/dal/transactions.ts
    - lib/validations/transactions.ts
    - app/(app)/transactions/transactions.table.ts
    - app/(app)/transactions/page.tsx
    - components/transactions/transaction-table.tsx
    - components/categorization/subcategory-picker.tsx
    - components/data-table/DataTableToolbar.tsx
    - lib/dal/expenses.ts
    - components/expenses/expense-table.tsx
    - components/import/import-table.tsx
    - components/expenses/expense-categorize-dialog.tsx
    - components/expenses/bulk-categorize-dialog.tsx
tech_stack:
  added: []
  patterns:
    - controlled Radix Popover with explicit close button
    - React.forwardRef on SearchInput for autofocus
    - deferred focus via setTimeout(…, 0) past Radix focus-trap
    - pending prop overlay pattern on SubcategoryPicker
key_files:
  created: []
  modified:
    - lib/validations/transactions.ts
    - lib/dal/transactions.ts
    - app/(app)/transactions/transactions.table.ts
    - app/(app)/transactions/page.tsx
    - components/transactions/transaction-table.tsx
    - components/categorization/subcategory-picker.tsx
    - components/data-table/DataTableToolbar.tsx
    - lib/dal/expenses.ts
    - components/expenses/expense-table.tsx
    - components/import/import-table.tsx
    - components/expenses/expense-categorize-dialog.tsx
    - components/expenses/bulk-categorize-dialog.tsx
decisions:
  - categoryType cast uses NonNullable<> to satisfy Drizzle eq() overloads
  - nature filter sentinel 'unclassified' maps to OR(isNull(subCategoryId), isNull(nature))
  - type filter sentinel 'unclassified' maps to isNull(category.type)
  - Transfer rows dim via opacity-60 on TableRow; amount stays text-foreground (not red)
  - import-table currency columns use Number() only inside Intl.NumberFormat (no monetary arithmetic)
metrics:
  duration: ~45 minutes
  completed: 2026-06-09
  tasks: 3
  files_modified: 12
---

# Quick Task 260609-k2d: Transactions nature filter + 7 UI fixes Summary

One-liner: FlowNature + In/Out/Transfer URL filters on transactions with categoryType row coloring, expenses Platform column, import per-file totals columns, categorize autofocus + pending state, and Filtri popover explicit close.

## Tasks Completed

| # | Name | Commit | Key files |
|---|------|--------|-----------|
| 1 | Nature + In/Out/Transfer filters — data path | c65821f | validations/transactions.ts, dal/transactions.ts, transactions.table.ts, page.tsx |
| 2 | Row colors + autofocus + popover close button | 8e41b1b | transaction-table.tsx, subcategory-picker.tsx, DataTableToolbar.tsx |
| 3 | Expenses Platform column + Import totals + dialog loaders | cdc5997 | dal/expenses.ts, expense-table.tsx, import-table.tsx, *-categorize-dialog.tsx |

## What Was Built

### Feature: FlowNature + In/Out/Transfer filters (Task 1)

- **Validations** (`lib/validations/transactions.ts`): Added `nature?: string` and `type?: string` to `ParsedTransactionFilters`. Defined `NATURE_ALLOWED` (9 enum members + `unclassified`) and `TYPE_ALLOWED` (`in`/`out`/`transfer`/`unclassified`). Parsed via the shared `parseStatus` allowlist helper.
- **DAL** (`lib/dal/transactions.ts`): Added `nature` and `type` to `TransactionFilters`; added `categoryType: category.type` to `transactionListSelect` and `TransactionListRow`. Added WHERE conditions: nature sentinel → `OR(isNull(subCategoryId), isNull(nature))`; type sentinel → `isNull(category.type)`; concrete values use `eq()` with correct Drizzle type casts.
- **Table config** (`transactions.table.ts`): Added `nature` and `type` `FilterField` entries with `toChip` using `NATURE_LABELS` and `TYPE_LABELS` for Italian chip labels.
- **Page** (`page.tsx`): Built `natureOptions` from `NATURE_ORDER` (null filtered out) + sentinel; built `typeOptions`; passed both in `filterOptions`; added both keys to `buildTransactionTableKey` filterKey and `hasActiveTransactionFilters`.

### Fix 5: Transaction row colors (Task 2)

- IN transactions: `text-total-in` (green token, reuses dashboard CSS variable).
- OUT transactions: `text-total-out` (red token).
- Transfer rows: `opacity-60` on the `<TableRow>`, amount stays `text-foreground`.
- Uncategorized: falls back to amount-sign logic — positive → `text-total-in`, negative → `text-foreground`. Red is never applied to uncategorized negatives.

### Fix 1: Categorize sheet autofocus (Task 2)

- `SearchInput` converted to `React.forwardRef` accepting an `HTMLInputElement` ref.
- `PickerBody` holds a `searchInputRef` and runs `setTimeout(() => ref.current?.focus(), 0)` on mount — deferred one tick past Radix Sheet's focus-trap initialization.
- The existing `key={open ? 'open' : 'closed'}` pattern on `PickerBody` ensures the effect re-fires on every open.

### Fix 6: Filtri popover explicit close (Task 2)

- `DataTableToolbar` now holds `[filterPopoverOpen, setFilterPopoverOpen]` state.
- The desktop `<Popover>` is controlled via `open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}`.
- A ghost icon `Button` with `X` icon sits in a popover header row; click calls `setFilterPopoverOpen(false)`.
- Click-outside dismissal retained (Radix default behavior, no overrides added).

### Fix 3: Dialog loaders (Task 2 + Task 3)

- `SubcategoryPicker` gains an optional `pending?: boolean` prop (default `false`).
- When `pending=true`: `pointer-events-none opacity-60` on the picker body wrapper; sheet title swaps to "Categorizzazione…".
- `expense-categorize-dialog.tsx` and `bulk-categorize-dialog.tsx`: both now destructure `[isPending, startTransition]` from `useTransition()` and pass `pending={isPending}` to `SubcategoryPicker`.
- Pre-existing loaders confirmed present: `DeleteTransactionMenuItem` (Dialog + disabled button), `IgnoreExpenseMenuItem` ("Attendere…" state), `DeleteExpenseMenuItem` (disabled confirm), `ExpenseFormDialog` (its own pending handling).

### Fix 2: Expenses Platform column (Task 3)

- `ExpenseRow` type gained `platformName: string | null`.
- `getExpenses` select now includes `platformName: platform.name` (platform join already present).
- `getExpenseById` gained the same platform join chain and select field.
- `expense-table.tsx`: added non-sortable "Piattaforma" `<TableHead>` and `<TableCell>` (renders `exp.platformName ?? '—'`, placed after Categoria, before Stato).

### Fix 7: Import totals columns (Task 3)

- `positiveTotal` and `negativeTotal` are already on `ImportListRow` (precomputed DECIMAL strings on the `file` table). No DAL changes, no cross-row aggregation.
- Added `currencyFormatter = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })` at module scope in `import-table.tsx`.
- Two new columns added after "Righe", before "Periodo": "Totale entrate" (`text-total-in`) and "Totale uscite" (`text-total-out`). Values passed through `Number(...)` only inside the formatter (display only — no monetary arithmetic, CLAUDE.md compliant).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Drizzle eq() type error on nature filter cast**
- **Found during:** Task 1 typecheck
- **Issue:** `eq(subCategory.nature, filters.nature as (typeof subCategory.$inferSelect)['nature'])` included `null` in the cast union, failing Drizzle's overload resolution.
- **Fix:** Used `NonNullable<(typeof subCategory.$inferSelect)['nature']>` as the cast target, which excludes `null` and satisfies the first `eq()` overload.
- **Files modified:** `lib/dal/transactions.ts`
- **Commit:** c65821f (same task commit)

None other — plan executed as written.

## Verification Results

- `yarn tsc --noEmit`: No new errors in any touched file. Pre-existing error in `tests/sidebar-provider.test.tsx` (unrelated, not introduced by this task).
- `yarn lint`: No new errors in touched files. Pre-existing errors in `tests/sidebar-provider.test.tsx` and `tests/suggestion-promote-form.test.tsx` (not introduced by this task).
- `yarn check:language`: No new failures. Pre-existing failures in `scripts/seed-extras.ts` and two test files (not introduced by this task).

## Known Stubs

None — all columns are wired to real data sources.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Self-Check: PASSED

- All 12 modified files verified to exist on disk.
- All 3 commits verified in git log: c65821f, 8e41b1b, cdc5997.
