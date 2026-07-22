---
phase: quick-260721-o5t
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/dal/dashboard.ts
  - components/dashboard/category-top-transactions.tsx
  - tests/dashboard-dal.test.ts
autonomous: true
requirements: [GRP-08]

must_haves:
  truths:
    - "A grouped expense's transaction appears in the dashboard category-detail Top 5 movimenti panel with its Expense Group title, not its raw bank description"
  artifacts:
    - "lib/dal/dashboard.ts topTransactionRows query leftJoins expenseGroupMembership + expenseGroup and selects groupTitle"
    - "CategoryDetailTopTransactionRow type includes groupTitle: string | null"
  key_links:
    - "buildCategoryDetailData title composition: row.customTitle ?? row.groupTitle ?? row.description"
---

<objective>
Close the GRP-08 milestone-audit gap: the dashboard category-detail "Top 5 movimenti" panel shows a grouped transaction's raw bank description instead of its Expense Group title. This was a documented scope exclusion in Phase 65-03. Every other transaction-list surface in the app (lib/dal/transactions.ts) already resolves and displays the group title via a leftJoin — this plan mirrors that exact pattern into `getCategoryDetail`'s `topTransactionRows` query.

Purpose: Consistency — a user viewing the dashboard category drill-down should see the same title for a grouped expense as they see everywhere else (transactions list, expense list, detail pages).
Output: `topTransactionRows` query joins expenseGroup; `CategoryDetailTopTransactionRow` carries `groupTitle`; `buildCategoryDetailData` composes title with `customTitle ?? groupTitle ?? description` precedence; test coverage for the new precedence; full suite + language check green.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Join expenseGroup into topTransactionRows and fix title composition</name>
  <files>lib/dal/dashboard.ts</files>
  <read_first>
    lib/dal/dashboard.ts (imports at top ~lines 18-26; CategoryDetailTopTransactionRow type ~lines 262-271; topTransactionRows query ~lines 1367-1410; title composition in buildCategoryDetailData ~lines 908-916)
    lib/dal/transactions.ts (reference pattern: expenseGroup/expenseGroupMembership imported ~lines 13-14; leftJoin(expenseGroupMembership, eq(expense.id, expenseGroupMembership.expenseId)) then leftJoin(expenseGroup, eq(expenseGroupMembership.groupId, expenseGroup.id)) ~lines 390-391; groupTitle: expenseGroup.title in the select ~line 106)
  </read_first>
  <action>
    In lib/dal/dashboard.ts:
    1. Add `expenseGroup` and `expenseGroupMembership` to the existing `@/lib/db/schema` import block (alongside `category, direction, expense, nature, subCategory, transaction as transactionTable, userSubcategoryOverride`).
    2. In the `topTransactionRows` query builder (the `db.select({...}).from(transactionTable).innerJoin(expense, ...)...` chain that currently ends `.limit(5)`), add `groupTitle: expenseGroup.title` to the `.select({...})` object (alongside `id, categoryId, categorySlug, categoryType, description, customTitle, amount, occurredAt`).
    3. Add two leftJoins to that same query chain, positioned after `.innerJoin(expense, eq(transactionTable.expenseId, expense.id))` and before `.innerJoin(subCategory, ...)`: `.leftJoin(expenseGroupMembership, eq(expense.id, expenseGroupMembership.expenseId))` then `.leftJoin(expenseGroup, eq(expenseGroupMembership.groupId, expenseGroup.id))` — mirror the exact join order used in lib/dal/transactions.ts. Do not alter the query's WHERE clause, orderBy, or `.limit(5)`. `expenseGroupMembership` has a UNIQUE constraint on `expenseId` (at most one group per expense — D-04), so these leftJoins cannot fan out rows or change row counts.
    4. In the `CategoryDetailTopTransactionRow` type (~lines 262-271), add `groupTitle: string | null` after `customTitle: string | null`.
    5. In `buildCategoryDetailData`'s topTransactions composition (~line 911), change `title: row.customTitle ?? row.description` to `title: row.customTitle ?? row.groupTitle ?? row.description`.
    Do not touch the `trendRows` or `subcategoryRows` queries in this same function — only the `topTransactionRows` query and its row type and composition.
  </action>
  <verify>
    <automated>cd /Users/andreabernardini/ai-projects/new-sparter-app && node_modules/.bin/tsc --noEmit -p tsconfig.json 2>&1 | grep -i "dashboard.ts" || echo "no dashboard.ts type errors"</automated>
  </verify>
  <done>
    topTransactionRows query selects groupTitle via leftJoin(expenseGroupMembership).leftJoin(expenseGroup); CategoryDetailTopTransactionRow has groupTitle: string | null; buildCategoryDetailData title composition is `row.customTitle ?? row.groupTitle ?? row.description`; typecheck passes with no new errors in dashboard.ts.
  </done>
</task>

<task type="auto">
  <name>Task 2: Verify component, extend test coverage, run full suite + language check</name>
  <files>components/dashboard/category-top-transactions.tsx, tests/dashboard-dal.test.ts</files>
  <read_first>
    components/dashboard/category-top-transactions.tsx (displayTitle() at ~lines 28-32 reads `transaction.title` — the pre-composed field from CategoryDetailTopTransaction, produced by buildCategoryDetailData in Task 1; component does not re-resolve title from description/customTitle itself)
    tests/dashboard-dal.test.ts (existing buildCategoryDetailData test "builds category detail data with zero-filled trends..." ~lines 525-595, specifically the topTransactionRows mock rows ~lines 556-577 and the topTransactions assertion ~lines 591-594)
  </read_first>
  <action>
    Step 1 — Confirm component needs no change: components/dashboard/category-top-transactions.tsx's `displayTitle()` reads `transaction.title` directly (the field composed in Task 1's `buildCategoryDetailData`); it does not independently resolve customTitle/description. No edit needed to this file — this task's file list includes it only for the read-verify; state explicitly in the SUMMARY that no change was required here and why.
    Step 2 — Extend the test: in tests/dashboard-dal.test.ts, in the existing `buildCategoryDetailData` test (~line 525), add a `groupTitle` field to each mock row in `topTransactionRows` (~lines 556-577): set `groupTitle: 'Abbonamenti condivisi'` on one row (e.g. the 'tx-1'/'Power bill' row, which has `customTitle: null`) and `groupTitle: null` on the other (the 'tx-2'/'Rent custom' row, which has `customTitle: 'Rent custom'`, to prove customTitle still wins over groupTitle). Update the `detail.topTransactions` assertion (~lines 591-594) so the row with `customTitle: null, groupTitle: 'Abbonamenti condivisi'` expects `title: 'Abbonamenti condivisi'` (group title wins over raw description), and the row with `customTitle: 'Rent custom'` still expects `title: 'Rent custom'` (customTitle precedence unchanged).
    Step 3 — Run the full test suite and the language check per CLAUDE.md.
  </action>
  <verify>
    <automated>cd /Users/andreabernardini/ai-projects/new-sparter-app && node_modules/.bin/vitest run tests/dashboard-dal.test.ts && yarn check:language</automated>
  </verify>
  <done>
    Component confirmed to need no change (reads pre-composed title, documented in SUMMARY); dashboard-dal.test.ts topTransactionRows mock rows carry groupTitle covering both precedence branches (customTitle wins; groupTitle wins over description); test assertions updated to match; `node_modules/.bin/vitest run tests/dashboard-dal.test.ts` passes; `yarn check:language` reports no violations.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| DB row -> dashboard display | Server-composed title (customTitle/groupTitle/description) rendered read-only in category-top-transactions.tsx; no new user input surface introduced |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-quick260721o5t-01 | Information Disclosure | topTransactionRows leftJoin(expenseGroup) | low | accept | Query is already userId-scoped via dateScopedTransactions/expense ownership chain (unchanged in this plan); the added leftJoin only reaches expenseGroup rows already reachable through the user's own expense, so no cross-user data can surface |
</threat_model>

<verification>
- `node_modules/.bin/tsc --noEmit` shows no new errors in lib/dal/dashboard.ts
- `node_modules/.bin/vitest run tests/dashboard-dal.test.ts` passes, including the extended groupTitle precedence assertions
- `yarn check:language` is clean
- Manual smoke (optional, not required for done): dashboard category-detail page for a category containing a grouped expense shows the group title in Top 5 movimenti
</verification>

<success_criteria>
`getCategoryDetail`'s `topTransactionRows` query leftJoins `expenseGroupMembership` + `expenseGroup` and selects `groupTitle`; `CategoryDetailTopTransactionRow` includes `groupTitle: string | null`; `buildCategoryDetailData` composes `title: row.customTitle ?? row.groupTitle ?? row.description`; test coverage proves both precedence branches; full test file and language check pass. GRP-08 milestone-audit gap closed.
</success_criteria>

<output>
Create `.planning/quick/260721-o5t-show-expense-group-title-in-dashboard-ca/SUMMARY.md` when done
</output>
