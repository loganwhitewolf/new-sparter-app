---
phase: 260609-lcp
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/utils/format-amount.ts
  - components/transactions/transaction-table.tsx
  - components/expenses/expense-table.tsx
  - components/import/import-table.tsx
  - lib/utils/table-config.ts
  - components/data-table/DataTableToolbar.tsx
  - lib/utils/cascade-options.ts
  - app/(app)/transactions/transactions.table.ts
  - app/(app)/transactions/TransactionsToolbar.tsx
  - app/(app)/transactions/page.tsx
  - app/(app)/expenses/expenses.table.ts
  - app/(app)/expenses/ExpensesToolbar.tsx
  - app/(app)/expenses/page.tsx
  - lib/validations/expense.ts
  - lib/dal/expenses.ts
  - tests/format-amount.test.ts
  - tests/cascade-options.test.ts
  - tests/data-table-toolbar.test.tsx
  - lib/validations/__tests__/expense.test.ts
autonomous: true
requirements: []

must_haves:
  truths:
    - "Displayed amounts on transactions, expenses and import lists never show a leading minus sign; color/dim still conveys direction"
    - "Categorized transaction rows show only Ricategorizza (no Cerca su Google); uncategorized rows keep Cerca su Google + Categorizza spesa + Elimina"
    - "DataTableToolbar can render a child select whose options narrow based on a parent filter's current URL value"
    - "On both transactions and expenses, choosing a type narrows the nature options; choosing a category narrows the subcategory options; clearing the parent restores all options"
    - "Changing a parent filter clears the child param when the child value is no longer valid"
    - "Expenses page exposes type, nature and category→subcategory cascade filters wired through validations and DAL"
  artifacts:
    - path: "lib/utils/format-amount.ts"
      provides: "Display-only absolute-value currency formatter shared by the three tables"
    - path: "lib/utils/cascade-options.ts"
      provides: "Pure functions deriving type→nature and category→subcategory option maps from the taxonomy"
    - path: "components/data-table/DataTableToolbar.tsx"
      provides: "Cascade-aware FilterField rendering + child-clear-on-parent-change"
    - path: "lib/validations/expense.ts"
      provides: "Expense filter parsing for nature, type and subCategory params"
  key_links:
    - from: "components/data-table/DataTableToolbar.tsx"
      to: "lib/utils/cascade-options.ts (via dependentOptions prop)"
      via: "resolve child options from parent URL value"
      pattern: "dependsOn"
    - from: "app/(app)/expenses/page.tsx"
      to: "lib/dal/expenses.ts"
      via: "nature/type/subCategory filters applied in getExpenses joins"
      pattern: "filters\\.(nature|type|subCategoryId)"
---

<objective>
Five UI/filter refinements on the transactions and expenses tables, building directly on quick task 260609-k2d (which added flat nature + in/out/transfer + category filters to transactions).

1. Strip the leading minus from ALL displayed amounts (transactions, expenses, import + totals) — display-only, color/dim logic untouched, stored values and Decimal math never touched.
2. Trim the categorized-transaction row menu to only "Ricategorizza"; uncategorized rows keep their current actions.
3. Add cascade (dependent-options) support to DataTableToolbar.
4. Apply type→nature and category→subcategory cascade on BOTH transactions (upgrade k2d's flat filters) and expenses (add the full set), deriving the maps server-side from the existing taxonomy.

Purpose: cleaner amount reading, a focused row menu, and linked filters that prevent empty/contradictory filter combinations.
Output: a shared display formatter, a cascade mechanism in the toolbar, derived cascade maps, and expenses filter wiring through validations + DAL.

Deferred (do NOT build): a dedicated `nature` table (FK to in/out/transfer). The cascade is derived dynamically from `category.type` + `subCategory.nature`. NO schema change, NO migration in this task.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/quick/260609-lcp-filter-cascade-amount-sign-transaction-m/260609-lcp-CONTEXT.md
@CLAUDE.md
@CONTEXT.md

# Toolbar + config (cascade target)
@components/data-table/DataTableToolbar.tsx
@lib/utils/table-config.ts
@components/data-table/use-table-url.ts

# Transactions side (k2d done — reuse)
@app/(app)/transactions/page.tsx
@app/(app)/transactions/transactions.table.ts
@lib/validations/transactions.ts
@lib/dal/transactions.ts

# Expenses side (extend to match transactions)
@app/(app)/expenses/page.tsx
@app/(app)/expenses/expenses.table.ts
@lib/validations/expense.ts
@lib/dal/expenses.ts

# Taxonomy source for derived maps
@lib/dal/categories.ts
@lib/utils/nature-labels.ts

# Amount display sites
@components/transactions/transaction-table.tsx
@components/expenses/expense-table.tsx
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Strip minus from displayed amounts + trim categorized-transaction menu</name>
  <files>lib/utils/format-amount.ts, tests/format-amount.test.ts, components/transactions/transaction-table.tsx, components/expenses/expense-table.tsx, components/import/import-table.tsx</files>
  <behavior>
    - format-amount: formatAbsoluteAmount('-12.50','EUR') and formatAbsoluteAmount('12.50','EUR') produce the same string with no '-' and no U+2212 minus.
    - format-amount: formatAbsoluteAmount('0','EUR') has no sign; non-finite input ('abc') falls back to the raw value joined with currency code (no throw).
    - Transaction row menu: a categorized row (expenseStatus '2' or '3') renders NO "Cerca su Google" item; an uncategorized row (expenseStatus '1' or no expense) renders "Cerca su Google".
  </behavior>
  <action>
    Create lib/utils/format-amount.ts exporting formatAbsoluteAmount(amount: string, currency = 'EUR'): string. Compute the numeric value from the already-fetched DECIMAL string and format Math.abs of it via Intl.NumberFormat('it-IT', { style:'currency', currency }); on non-finite input return `${amount} ${currency || 'EUR'}` (mirror the existing fallback in transaction-table). This is display-only on values already read from the DB — it MUST NOT touch stored values or perform monetary arithmetic that feeds writes (CLAUDE.md Decimal.js rule applies only to amounts that re-enter persistence; here we only render). Add an English module doc comment stating "display-only; never use for values written back to the DB".

    In transaction-table.tsx: replace the body of the existing formatAmount helper (~line 81) to delegate to formatAbsoluteAmount, preserving its currency-aware signature. Keep the amountColorClass logic AS-IS (line ~316-328) — the negative detection `transaction.amount.trim().startsWith('-')` must stay (it reads the raw stored string, not the display string).

    In expense-table.tsx: replace the inline formatAmount helper (~line 168) to delegate to formatAbsoluteAmount(amount) (EUR default). Keep any existing color/dim classes unchanged.

    In import-table.tsx: the negative totals column (~line 333-335) renders `currencyFormatter.format(Number(row.negativeTotal))` which shows the minus. Replace BOTH the positiveTotal and negativeTotal cell renders to use formatAbsoluteAmount(row.positiveTotal) / formatAbsoluteAmount(row.negativeTotal); keep the existing `text-total-in` / `text-total-out` classes so color still conveys direction. Leave the module-level currencyFormatter in place only if still referenced elsewhere; otherwise remove the now-unused const to satisfy lint.

    Transaction row menu (transaction-table.tsx ~line 435-462): the "Cerca su Google" DropdownMenuItem (~436-446) currently renders unconditionally. Wrap it so it renders ONLY when the row is NOT categorized — reuse the existing `isCategorized` boolean already computed in the row (`const isCategorized = isExpenseCategorized(transaction.expenseStatus)` at ~line 311). Categorized rows therefore show: Categorizza/Ricategorizza (the existing item already gated on `expenseStatus === '1'` shows for uncategorized; categorized rows currently have no categorize item) — per CONTEXT the categorized action is "Ricategorizza": add a Ricategorizza DropdownMenuItem shown when `isCategorized`, reusing the existing setCategorizeTarget flow (same handler shape as the uncategorized "Categorizza spesa" item, label "Ricategorizza", Tag icon). Keep the Elimina item for all rows. Net result — categorized: Ricategorizza + Elimina; uncategorized: Cerca su Google + Categorizza spesa + Elimina.

    Write tests/format-amount.test.ts covering the behavior cases above (assert no '-' and no '−' in output; assert abs equivalence; assert non-finite fallback). Run yarn check:language on all touched files (English comments/identifiers; Italian only in the existing UI labels).
  </action>
  <verify>
    <automated>cd /Users/andreabernardini/ai-projects/new-sparter-app && yarn test tests/format-amount.test.ts && yarn check:language && npx tsc --noEmit</automated>
  </verify>
  <done>formatAbsoluteAmount exists with passing tests; transactions/expenses/import lists render amounts and totals without a leading minus while keeping color; categorized transaction rows show Ricategorizza (no Cerca su Google), uncategorized rows keep Cerca su Google + Categorizza spesa; typecheck + language check pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add cascade (dependent-options) support to DataTableToolbar + derive cascade maps</name>
  <files>lib/utils/table-config.ts, lib/utils/cascade-options.ts, tests/cascade-options.test.ts, components/data-table/DataTableToolbar.tsx, tests/data-table-toolbar.test.tsx</files>
  <behavior>
    - cascade-options: buildTypeNatureMap derives, per category.type ('in'|'out'|'transfer'), the distinct natures used by that type's subcategories, returning option arrays in NATURE_ORDER plus 'unclassified'; no type key returns all natures.
    - cascade-options: buildCategorySubcategoryMap returns, per category slug, that category's subcategory options ({value: String(subCategory.id), label}); the "all" entry contains every subcategory.
    - DataTableToolbar: a FilterField with dependsOn set resolves its options from dependentOptions[childKey][parentUrlValue]; when the parent param is absent it falls back to the full options (filterOptions[childKey] or field.options).
    - DataTableToolbar: changing a parent select clears the child param when the child's current value is not present in the newly-resolved child options.
  </behavior>
  <action>
    Extend lib/utils/table-config.ts FilterField with an optional `dependsOn?: string` (the parent field key). Pure types only — no runtime code (preserve the file's existing contract).

    Create lib/utils/cascade-options.ts (pure, no server-only, importable by tests). Export:
      - type FilterOption = { value: string; label: string }
      - buildTypeNatureMap(categories: CategoryWithSubCategories[]): Record<string, FilterOption[]> keyed by category.type, value 'unclassified' added per type, ordered by NATURE_ORDER + unclassified; built by scanning each category's effectiveNature on its subCategories. Import CategoryWithSubCategories type from '@/lib/dal/categories' (type-only import to avoid pulling server-only runtime), NATURE_ORDER/NATURE_LABELS from '@/lib/utils/nature-labels'. Map category.type 'system' is excluded (matches existing categoryOptions filter). Always include 'unclassified' as the last option for every type and for the all-bucket.
      - buildCategorySubcategoryMap(categories): Record<string, FilterOption[]> keyed by category.slug, value = String(subCategory.id), label = subCategory.name (already effective/custom name from the DAL). Exclude type 'system' categories.
    These return the per-parent buckets; the page also supplies an "all" bucket (parent unset) — represent "all" with a reserved key such as '' (empty string) inside each map, or return the all-list separately. Pick the empty-string key '' convention and document it. Keep functions pure and total (empty input → empty maps).

    Modify components/data-table/DataTableToolbar.tsx:
      - Add a new optional prop `dependentOptions?: Record<string, Record<string, { value: string; label: string }[]>>` (childKey → parentValue → options). Thread it from Props through FilterPanel into FilterField (both the Popover and Sheet FilterPanel instances already share one FilterPanel — thread once).
      - In the FilterField renderer, before resolving options for a 'select' field, check field.dependsOn. If set: read parentValue = searchParams.get(field.dependsOn); resolvedOptions = dependentOptions?.[field.key]?.[parentValue ?? ''] ?? dependentOptions?.[field.key]?.[''] ?? options ?? field.options ?? []. (parent unset → '' bucket = all.)
      - Child-clear-on-parent-change: when a parent select changes (onChange of a field that some other field dependsOn), after writing the parent value, also clear any dependent child whose current URL value is not in the child's newly-resolved option set. Implement generically: in FilterPanel/onChange wiring, when updating key K, compute the set of children C where C.dependsOn === K; for each child, look up its resolved options for the NEW parent value; if the child's current searchParams value is set and not in that option set, batch-clear it. Use updateParams (multi-key write) so parent + child clear happen in one URL replace (avoids a stale intermediate render). This means FilterPanel needs access to updateParams (currently only updateParam is threaded) — thread updateParams from the component into FilterPanel and use it for cascade-aware writes; keep updateParam for non-parent fields.

    Update tests/data-table-toolbar.test.tsx: add cases for a cascade config — a parent 'type' select and a child 'nature' select with dependsOn:'type'; assert (a) with no parent param the child renders the all-bucket options, (b) the rendered child option set reflects the parent value when present. Use the existing renderToStaticMarkup + mocked next/navigation pattern in that file; for the clear-on-change behavior, assert the updateParams mock is called with both keys when a parent change invalidates the child (drive via the mockReplace/mock searchParams pattern already in the file).

    Write tests/cascade-options.test.ts for buildTypeNatureMap and buildCategorySubcategoryMap (ordering, unclassified presence, all-bucket via '' key, system excluded, empty input).
  </action>
  <verify>
    <automated>cd /Users/andreabernardini/ai-projects/new-sparter-app && yarn test tests/cascade-options.test.ts tests/data-table-toolbar.test.tsx && npx tsc --noEmit && yarn check:language</automated>
  </verify>
  <done>FilterField supports dependsOn; cascade-options derives both maps (with '' all-bucket, unclassified, system excluded) with passing tests; DataTableToolbar resolves child options from the parent URL value and clears an invalidated child in one URL write; toolbar tests pass; typecheck + language check pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Wire cascade filters into transactions (upgrade) + expenses (add full set)</name>
  <files>app/(app)/transactions/transactions.table.ts, app/(app)/transactions/TransactionsToolbar.tsx, app/(app)/transactions/page.tsx, app/(app)/expenses/expenses.table.ts, app/(app)/expenses/ExpensesToolbar.tsx, app/(app)/expenses/page.tsx, lib/validations/expense.ts, lib/dal/expenses.ts, lib/validations/__tests__/expense.test.ts</files>
  <behavior>
    - parseExpenseFilters parses `nature` (NATURE_ALLOWED incl. 'unclassified'), `type` (in/out/transfer/unclassified) and `subCategory` (positive int → subCategoryId), dropping invalid tokens; never throws.
    - getExpenses applies nature (via subCategory.nature, 'unclassified' = null subCategory or null nature), type (via category.type, 'unclassified' = null type) and subCategoryId filters using its existing join chain.
    - Transactions: the category filter cascades into a subcategory child; the type filter cascades into a nature child.
    - Expenses: type, nature and category→subcategory cascade filters are present and applied.
  </behavior>
  <action>
    Transactions config (transactions.table.ts): add a `subCategory` select filter with dependsOn:'category' (label 'Sottocategoria', toChip showing the subcategory label). Set the existing `nature` field's dependsOn:'type'. Order fields so each parent precedes its child in the panel. The category filter stays; subcategory narrows by it. The type filter stays; nature narrows by it.

    Transactions toolbar (TransactionsToolbar.tsx): add a `dependentOptions` prop and forward it to DataTableToolbar.

    Transactions page (page.tsx): import buildTypeNatureMap + buildCategorySubcategoryMap from '@/lib/utils/cascade-options'. Build dependentOptions = { nature: buildTypeNatureMap(categories), subCategory: buildCategorySubcategoryMap(categories) } and pass to TransactionsToolbar. Keep the existing flat natureOptions/typeOptions in filterOptions (the '' all-bucket inside the maps covers the no-parent case, but filterOptions still feeds the parent selects and the all fallback). Add 'subCategory' to hasActiveTransactionFilters keys and to buildTransactionTableKey filterKey so the table remounts on subcategory change. Note: transactions validations already parse nature/type; confirm subCategory is already parsed (parseTransactionFilters already reads input.subCategory → subCategoryId and getTransactions already applies subCategoryId) — reuse it, no transactions-validation change needed.

    Expenses validations (lib/validations/expense.ts): extend ParsedExpenseFilters with nature?: string, type?: string, subCategoryId?: number. In parseExpenseFilters parse them: reuse parseStatus(input.nature, NATURE_ALLOWED) and parseStatus(input.type, TYPE_ALLOWED) — define NATURE_ALLOWED/TYPE_ALLOWED locally mirroring lib/validations/transactions.ts (or import if exported; prefer a small local const to avoid coupling). Parse input.subCategory as a positive integer → subCategoryId (mirror the transactions logic). Add the parsed keys to the returned object (spread-when-present pattern already used in the file).

    Expenses DAL (lib/dal/expenses.ts): extend ExpenseFilters with nature?: string, type?: string, subCategoryId?: number. In getExpenses add conditions mirroring getTransactions Task-1(k2d) logic: nature 'unclassified' → or(isNull(expense.subCategoryId), isNull(subCategory.nature)); else eq(subCategory.nature, value cast). type 'unclassified' → isNull(category.type); else eq(category.type, value cast). subCategoryId → eq(subCategory.id, value). The subCategory + category left joins already exist in getExpenses — reuse them; import isNull/isNotNull from drizzle-orm if not already imported (isNull is needed). Apply the same conditions in getExpenseById ONLY if needed (it is single-row by id — skip; list filters belong in getExpenses).

    Expenses config (expenses.table.ts): add `category` already exists — add a `subCategory` select with dependsOn:'category', a `type` select, and a `nature` select with dependsOn:'type', all with toChip helpers (reuse TYPE_LABELS/NATURE_LABELS mapping like transactions.table.ts; import NATURE_LABELS). Order parents before children.

    Expenses toolbar (ExpensesToolbar.tsx): add a `dependentOptions` prop and forward it.

    Expenses page (page.tsx): build natureOptions + typeOptions (same shape as transactions page) and dependentOptions = { nature: buildTypeNatureMap(categories), subCategory: buildCategorySubcategoryMap(categories) }; pass filterOptions (category, platform, nature, type) + dependentOptions to ExpensesToolbar. Map parsed.nature/parsed.type/parsed.subCategoryId into the ExpenseListFilters object passed to getExpenses. Add nature/type/subCategory to hasActiveExpenseFilters keys and to buildExpenseTableKey filterKey.

    Update lib/validations/__tests__/expense.test.ts: add cases asserting nature/type/subCategory parse with valid values, drop invalid tokens, and omit when absent. Run yarn check:language on touched files (English code/comments; Italian only for the UI labels in the table configs).
  </action>
  <verify>
    <automated>cd /Users/andreabernardini/ai-projects/new-sparter-app && yarn test lib/validations/__tests__/expense.test.ts tests/expenses-dal.test.ts && npx tsc --noEmit && yarn check:language</automated>
  </verify>
  <done>Transactions show category→subcategory and type→nature cascades (k2d filters upgraded, no transactions-validation change); expenses expose type, nature and category→subcategory cascade filters parsed in validations and applied in getExpenses; expense validation tests pass; typecheck + language check pass.</done>
</task>

</tasks>

<verification>
- Display: no leading minus on transactions, expenses, or import list amounts/totals; color/dim direction preserved; stored values and Decimal write paths untouched (grep confirms `startsWith('-')` color logic still reads raw `transaction.amount`).
- Menu: categorized transaction rows render Ricategorizza only (no "Cerca su Google"); uncategorized rows unchanged.
- Cascade: with a parent unset both child selects show all options; selecting a type narrows nature; selecting a category narrows subcategory; clearing the parent restores all; an invalidated child param is cleared in the same URL write.
- Parity: expenses page has the same type/nature/category→subcategory cascade set as transactions, applied through validations + DAL.
- Quality gates: `yarn test` (touched specs), `npx tsc --noEmit`, `yarn check:language` all green.
- No schema change / no migration introduced (git diff shows no files under drizzle/migrations or lib/db/schema.ts).
</verification>

<success_criteria>
- All three tasks' automated verify commands pass.
- The four cascade behaviors hold on BOTH transactions and expenses.
- Amounts display without minus everywhere; menu trimmed for categorized rows.
- Zero schema/migration changes; the dedicated `nature` table remains deferred (noted, not built).
</success_criteria>

<output>
Create `.planning/quick/260609-lcp-filter-cascade-amount-sign-transaction-m/260609-lcp-SUMMARY.md` when done.
</output>
