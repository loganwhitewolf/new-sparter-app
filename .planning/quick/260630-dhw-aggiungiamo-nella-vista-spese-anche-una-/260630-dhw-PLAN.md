---
phase: quick-260630-dhw
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/dal/expenses.ts
  - components/expenses/expense-uncategorized-cta.tsx
  - app/(app)/expenses/page.tsx
  - app/(app)/expenses/expenses.table.ts
  - tests/expense-uncategorized-cta.test.tsx
  - tests/expenses-dal.test.ts
autonomous: true
---

<objective>
CTA pill "Da categorizzare (N)" nella header row della vista Spese; rimuovere filtro status dalla toolbar.
</objective>

<tasks>

<task type="auto">
  <name>Task 1: DAL count + CTA component</name>
  <files>lib/dal/expenses.ts, components/expenses/expense-uncategorized-cta.tsx</files>
  <action>
    - Aggiungere `getUncategorizedExpenseCount()` in expenses DAL (userId-scoped, status in ['1','4'])
    - Creare client component `ExpenseUncategorizedCta` con useTableUrl, toggle status, pill amber con count
  </action>
  <verify>yarn vitest run tests/expense-uncategorized-cta.test.tsx tests/expenses-dal.test.ts</verify>
  <done>Count DAL e CTA testati</done>
</task>

<task type="auto">
  <name>Task 2: Wire page + rimuovi filtro</name>
  <files>app/(app)/expenses/page.tsx, app/(app)/expenses/expenses.table.ts</files>
  <action>
    - Fetch count in page, render CTA in header row (Suspense wrapper)
    - Rimuovere entry `status` da expensesTableConfig.filters
  </action>
  <verify>yarn vitest run tests/expense-uncategorized-cta.test.tsx && yarn check:language</verify>
  <done>Page wired, filtro rimosso dalla toolbar</done>
</task>

</tasks>
