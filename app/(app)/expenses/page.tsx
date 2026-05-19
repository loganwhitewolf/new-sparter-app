import { Suspense } from 'react'
import { getExpenses, type ExpenseFilters as ExpenseListFilters } from '@/lib/dal/expenses'
import { getCategories } from '@/lib/dal/categories'
import { ExpenseFilters } from '@/components/expenses/expense-filters'
import { ExpenseTable } from '@/components/expenses/expense-table'
import { ExpenseFormDialog } from '@/components/expenses/expense-form-dialog'

function buildExpenseTableKey(filters: ExpenseListFilters, expenses: Awaited<ReturnType<typeof getExpenses>>) {
  const filterKey = [
    filters.categorySlug ?? '',
    filters.status ?? '',
    filters.period ?? '',
    filters.name ?? '',
    filters.sort ?? '',
    filters.dir ?? '',
  ].join(':')
  const dataKey = expenses
    .map((expense) => [
      expense.id,
      expense.status,
      expense.subCategoryId ?? '',
      expense.categorySlug ?? '',
    ].join(':'))
    .join('|')

  return `${filterKey}:${dataKey}`
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string
    status?: string
    period?: string
    name?: string
    sort?: string
    dir?: string
  }>
}) {
  const params = await searchParams
  const rawName = params.name?.trim()
  const filters: ExpenseListFilters = {
    categorySlug: params.category,
    status: params.status as 'uncategorized' | 'categorized' | undefined,
    period: params.period as
      | 'this-month'
      | 'last-3-months'
      | 'last-6-months'
      | 'this-year'
      | 'last-year'
      | undefined,
    name: rawName && rawName.length <= 200 ? rawName : undefined,
    sort: params.sort === 'totalAmount' ? 'totalAmount' : undefined,
    dir: params.dir === 'asc' ? 'asc' : undefined,
  }

  const [expenses, categories] = await Promise.all([
    getExpenses(filters),
    getCategories(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Spese</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestisci le tue spese
          </p>
        </div>
        <ExpenseFormDialog categories={categories} mode="create" />
      </div>

      <Suspense fallback={<div className="h-10 rounded-md bg-muted animate-pulse" />}>
        <ExpenseFilters categories={categories} />
      </Suspense>

      <ExpenseTable
        key={buildExpenseTableKey(filters, expenses)}
        expenses={expenses}
        categories={categories}
        filters={filters}
      />
    </div>
  )
}
