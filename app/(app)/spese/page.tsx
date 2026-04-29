import { Suspense } from 'react'
import { getExpenses } from '@/lib/dal/expenses'
import { getCategories } from '@/lib/dal/categories'
import { ExpenseFilters } from '@/components/expenses/expense-filters'
import { ExpenseTable } from '@/components/expenses/expense-table'
import { ExpenseFormDialog } from '@/components/expenses/expense-form-dialog'

export default async function SpesePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; status?: string; period?: string }>
}) {
  const params = await searchParams
  const filters = {
    categorySlug: params.category,
    status: params.status as 'uncategorized' | 'categorized' | undefined,
    period: params.period as
      | 'this-month'
      | 'last-3-months'
      | 'last-6-months'
      | 'this-year'
      | 'last-year'
      | undefined,
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

      <ExpenseTable expenses={expenses} categories={categories} />
    </div>
  )
}
