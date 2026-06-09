# Quick Task 260609-lcp: Filter cascade + amount sign + transaction menu - Context

**Gathered:** 2026-06-09
**Status:** Ready for planning

<domain>
## Task Boundary

Five refinements to the transactions/expenses tables and their filters. Follows quick task 260609-k2d (which added flat nature + in/out/transfer filters to transactions).

1. Remove the minus sign from displayed amounts — the color already conveys income vs expense.
2. Transactions row menu: for **categorized** rows, drop "Cerca su Google" (internet search); the only action needed there is **Ricategorizza**.
3. Add the nature + type filters to **Expenses** too, and make the **type filter cascade into nature**: choosing IN shows only IN-related natures (linked filters).
4. Make the **category filter 2-step** on both tables: pick a category first, then the subcategory options narrow to that category. No category selected → show all subcategories.
5. Type→nature cascade: nature has no direct link to in/out/transfer, so deriving "natures for type X" means scanning categories of that type. **Decision: derive dynamically now (no schema change); a dedicated `nature` table is deferred to a separate planned phase.**
</domain>

<code_context>
## Key facts discovered (verify before building)

**Data model (no schema change in this task):**
- No `nature` table. `flowNatureEnum` (9 values) is on `subCategory.nature` (schema.ts:195) and `user_subcategory_override.nature` (220).
- `category.type` = `categoryTypeEnum` in/out/system/transfer (schema.ts:165). `subCategory.categoryId` → category (direct, 187).
- Hierarchy: `category(type)` → `subCategory(nature)` → transaction/expense (via subCategoryId).
- nature↔type relationship is **implicit**: natures available for a type = distinct `subCategory.nature` over subcategories whose `category.type` = that type. Build this mapping from the existing taxonomy (DAL `getCategoriesWithSubCategories` / similar) and pass to the toolbar.

**Filter system (config-driven, LOCKED variant A):**
- `components/data-table/DataTableToolbar.tsx` renders filters from `TableConfig.filters: FilterField[]` (`lib/utils/table-config.ts`). Options come from the `filterOptions?: Record<string,{value,label}[]>` prop (server-provided) or static `field.options`. Values read/written to URL via `useTableUrl` (`updateParam`/`onParamChange`).
- `FilterField` types: text | select | multi-select | month-multi | amount-range | status. **No cascade/dependent-options support today** — each field renders independently from its URL value. Cascade must be added (e.g. a `dependsOn` key on FilterField + client-side filtering of the dependent field's options by the parent field's current URL value; or a dedicated cascading select component).
- Per-table configs: `app/(app)/transactions/transactions.table.ts` (already has flat nature + type + category filters from 260609-k2d), and the expenses equivalent (to be created/extended). Filter parsing: `lib/validations/transactions.ts` (`ParsedTransactionFilters`) + expenses equivalent; applied in `lib/dal/transactions.ts` / `lib/dal/expenses.ts`.

**Amount display (#1):**
- `components/transactions/transaction-table.tsx` formats via `Intl.NumberFormat('it-IT', …)` (line ~73); negativity detected at line ~326 via `transaction.amount.trim().startsWith('-')` to drive color. `components/expenses/expense-table.tsx` formats at line ~169. Import list amounts too (import-table.tsx, totals from 260609-k2d).
- Remove the minus **only from display** (format absolute value / strip leading `-`); keep color logic and never touch stored values or Decimal math.

**Transaction row menu (#2):**
- `components/transactions/transaction-table.tsx`: DropdownMenu around lines 430–470 — "Cerca su Google" link at ~436–446 (`https://www.google.com/search?q=…`), plus other items; "Ricategorizza"/categorize action also in this menu. Make the menu conditional on categorization state: categorized rows show only Ricategorizza (drop the Google search item); uncategorized keep their current actions.
</code_context>

<decisions>
## Implementation Decisions (LOCKED)

### Nature model (#5)
- **Derive now, table later.** Implement the type→nature cascade by deriving the nature↔type mapping from existing categories (no migration, no new table). A dedicated `nature` table (FK to in/out/transfer, category linked to nature) is a separate architectural change → **deferred to its own planned phase** (needs ADR + migration + seed strategy + blast-radius analysis). Add it as a deferred/backlog item.

### Filter cascade scope (#3, #4)
- Apply to **both** Transactions and Expenses: nature + type + (category→subcategory) filters, all cascading. Transactions already has the flat versions from 260609-k2d → upgrade them to cascade; Expenses gets the full set.
- **Category → subcategory** cascade: direct relation via `subCategory.categoryId`. No category selected → all subcategories shown.
- **Type → nature** cascade: derived. No type selected → all natures shown. Selecting IN/OUT/transfer narrows nature options to those used by categories of that type. Keep the "Non classificato" (`unclassified`) option behavior from 260609-k2d.
- When a parent filter changes such that the child's current value is no longer valid, clear the child param (avoid stale/empty results).

### Amount sign (#1)
- Strip the minus from **all** amount displays (transactions, expenses, import + their totals). Color/dimming conveys direction. Display-only — stored values and Decimal arithmetic untouched.

### Claude's Discretion
- Exact cascade mechanism in DataTableToolbar (dependsOn on FilterField vs dedicated component) — pick the minimal change that fits the existing config-driven pattern; keep it generic enough for both category→subcategory and type→nature.
- Where to compute the derived nature↔type and category→subcategory maps (DAL passing a structured taxonomy to the toolbar via filterOptions, vs a richer options payload). Prefer server-derived data passed as props; cascade filtering happens client-side from that data.
- Exact menu items kept for categorized vs uncategorized transaction rows (core: categorized → only Ricategorizza, drop Google search).
</decisions>

<specifics>
## Specific Ideas

- This builds directly on 260609-k2d — reuse its nature/type filter wiring rather than reinventing; the change is making options dependent (cascade) and extending to Expenses.
- The user explicitly questioned whether the nature-table refactor belongs in a quick task — it does not; only the derived cascade ships here.
</specifics>

<canonical_refs>
## Canonical References

- CLAUDE.md hard rules: Decimal.js for money (DECIMAL = strings), Italian only for product/UI copy, English for code/comments, dal/services/actions layering, run `yarn check:language` on touched strings/comments. No `drizzle-kit push`; migrations via generate + scripts/migrate.ts (NOT needed this task).
- CONTEXT.md domain language: Transaction vs Expense, Nature, Reference Period.
- Prior work: 260609-k2d (flat nature/type filters), v1.14 unified table filter & sort (ADR 0009+0010), Phase 39 unified subcategory picker.
- **Deferred:** dedicated `nature` table refactor — future phase.
</canonical_refs>
