import { Suspense } from 'react'
import { getExpenses } from '@/lib/dal/expenses'
import { getCategories } from '@/lib/dal/categories'
import { getTransactionPlatforms } from '@/lib/dal/transactions'
import { getMostUsedSubcategories } from '@/lib/dal/subcategory-usage'
import { parseExpenseFilters, type ExpenseSearchParams } from '@/lib/validations/expense'
import type { ExpenseFilters as ExpenseListFilters } from '@/lib/dal/expenses'
import { NATURE_LABELS, NATURE_ORDER } from '@/lib/utils/nature-labels'
import { buildDirectionNatureMap, buildCategorySubcategoryMap } from '@/lib/utils/cascade-options'
import { EmptyState } from '@/components/data-table/EmptyState'
import { ExpenseTable } from '@/components/expenses/expense-table'
import { ExpenseFormDialog } from '@/components/expenses/expense-form-dialog'
import { ExpensesToolbar } from '@/app/(app)/expenses/ExpensesToolbar'
import { APP_ROUTES } from '@/lib/routes'

/** Returns true when any filter param that narrows results is active */
function hasActiveExpenseFilters(params: ExpenseSearchParams): boolean {
  const keys = ['q', 'category', 'subCategory', 'platform', 'status', 'amountMin', 'amountMax', 'nature', 'type']
  return keys.some((k) => {
    const v = params[k]
    return Array.isArray(v) ? v.length > 0 : Boolean(v)
  })
}

function buildExpenseTableKey(filters: ExpenseListFilters, expenses: Awaited<ReturnType<typeof getExpenses>>) {
  const filterKey = [
    filters.q ?? '',
    filters.categorySlug ?? '',
    filters.status ?? '',
    filters.platform ?? '',
    filters.amountMin ?? '',
    filters.amountMax ?? '',
    filters.sort ?? '',
    filters.dir ?? '',
    filters.nature ?? '',
    filters.direction ?? '',
    filters.subCategoryId ?? '',
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
  searchParams: Promise<ExpenseSearchParams>
}) {
  const params = await searchParams
  const parsed = parseExpenseFilters(params)

  // Map parsed filters to DAL ExpenseFilters shape (including cascade filters lcp-01)
  const filters: ExpenseListFilters = {
    q: parsed.q,
    name: parsed.q,
    categorySlug: parsed.categorySlug,
    platform: parsed.platform,
    status: parsed.status,
    amountMin: parsed.amountMin,
    amountMax: parsed.amountMax,
    sort: parsed.sort,
    dir: parsed.dir,
    // No period — D-05: default view is all-time
    nature: parsed.nature,
    direction: parsed.type,
    subCategoryId: parsed.subCategoryId,
  }

  const [expenses, categories, platforms, mostUsed] = await Promise.all([
    getExpenses(filters),
    getCategories(),
    getTransactionPlatforms(),
    getMostUsedSubcategories(['in', 'out', 'transfer', 'allocation']),
  ])

  const categoryOptions = categories
    .map((c) => ({ value: c.slug, label: c.name }))
  const platformOptions = platforms.map((p) => ({ value: p.slug, label: p.name }))

  // Nature filter options: nine FlowNature values in canonical order + 'Non classificato'
  const natureOptions = [
    ...NATURE_ORDER.filter((n): n is NonNullable<typeof n> => n !== null).map((n) => ({
      value: n,
      label: NATURE_LABELS[n],
    })),
    { value: 'unclassified', label: NATURE_LABELS.unclassified },
  ]

  // Type filter options: In/Out/Transfer + 'Non classificato'
  const typeOptions = [
    { value: 'in', label: 'Entrate' },
    { value: 'out', label: 'Uscite' },
    { value: 'transfer', label: 'Trasferimenti' },
    { value: 'unclassified', label: 'Non classificato' },
  ]

  // Cascade-derived option maps: type→nature and category→subcategory
  const dependentOptions = {
    nature: buildDirectionNatureMap(categories),
    subCategory: buildCategorySubcategoryMap(categories),
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Spese</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestisci le tue spese
          </p>
        </div>
        <ExpenseFormDialog categories={categories} mostUsed={mostUsed} mode="create" />
      </div>

      <Suspense fallback={<div className="h-10 rounded-md bg-muted animate-pulse" />}>
        <ExpensesToolbar
          route={APP_ROUTES.expenses}
          filterOptions={{
            category: categoryOptions,
            platform: platformOptions,
            nature: natureOptions,
            type: typeOptions,
          }}
          dependentOptions={dependentOptions}
        />
      </Suspense>

      {expenses.length === 0 ? (
        <EmptyState
          variant={hasActiveExpenseFilters(params) ? 'no-result' : 'no-data'}
          message={
            hasActiveExpenseFilters(params)
              ? 'Nessuna spesa trovata'
              : 'Nessuna spesa'
          }
          hint={
            hasActiveExpenseFilters(params)
              ? 'Nessuna spesa corrisponde ai filtri attivi. Prova a modificare categoria, piattaforma o altri filtri.'
              : 'Non hai ancora aggiunto spese. Clicca su "Nuova spesa" per iniziare.'
          }
        />
      ) : (
        <ExpenseTable
          key={buildExpenseTableKey(filters, expenses)}
          expenses={expenses}
          route={APP_ROUTES.expenses}
          categories={categories}
          mostUsed={mostUsed}
          filters={filters}
        />
      )}
    </div>
  )
}
