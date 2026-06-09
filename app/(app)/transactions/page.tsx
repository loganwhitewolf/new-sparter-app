import { Suspense } from 'react'
import {
  getTransactionPlatforms,
  getTransactions,
} from '@/lib/dal/transactions'
import { getCategories } from '@/lib/dal/categories'
import { getMostUsedSubcategories } from '@/lib/dal/subcategory-usage'
import { getMonthsWithData } from '@/lib/dal/months-with-data'
import {
  parseTransactionFilters,
  type TransactionSearchParams,
} from '@/lib/validations/transactions'
import { NATURE_LABELS, NATURE_ORDER } from '@/lib/utils/nature-labels'
import { buildTypeNatureMap, buildCategorySubcategoryMap } from '@/lib/utils/cascade-options'
import { EmptyState } from '@/components/data-table/EmptyState'
import { TransactionFormDialog } from '@/components/transactions/transaction-form-dialog'
import { TransactionTable } from '@/components/transactions/transaction-table'
import { TransactionsToolbar } from '@/app/(app)/transactions/TransactionsToolbar'
import { APP_ROUTES } from '@/lib/routes'

/** Returns true when any filter param that narrows results is active */
function hasActiveTransactionFilters(params: TransactionSearchParams): boolean {
  const keys = ['q', 'name', 'months', 'amountMin', 'amountMax', 'platform', 'category', 'subCategory', 'status', 'nature', 'type']
  return keys.some((k) => {
    const v = params[k]
    return Array.isArray(v) ? v.length > 0 : Boolean(v)
  })
}

function buildTransactionTableKey(
  params: TransactionSearchParams,
  transactions: Awaited<ReturnType<typeof getTransactions>>,
) {
  const dataKey = transactions
    .map((transaction) => [
      transaction.id,
      transaction.customTitle ?? '',
      transaction.expenseId ?? '',
      transaction.expenseStatus ?? '',
      transaction.expenseCategoryName ?? '',
      transaction.expenseSubCategoryName ?? '',
    ].join(':'))
    .join('|')

  // Include Wave 4+ filter keys so the table remounts when filters change (D-04)
  const filterKey = [
    params.q ?? '',
    params.sort ?? '',
    params.dir ?? '',
    params.platform ?? '',
    params.category ?? '',
    params.subCategory ?? '',
    params.months ?? '',
    params.amountMin ?? '',
    params.amountMax ?? '',
    params.status ?? '',
    params.nature ?? '',
    params.type ?? '',
  ].join(':')

  return `${filterKey}:${dataKey}`
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<TransactionSearchParams>
}) {
  const params = await searchParams
  const filters = parseTransactionFilters(params)
  const [transactions, platforms, categories, mostUsed, monthsWithData] = await Promise.all([
    getTransactions(filters),
    getTransactionPlatforms(),
    getCategories(),
    getMostUsedSubcategories(['in', 'out', 'transfer', 'system']),
    getMonthsWithData('transactions'),
  ])

  const platformOptions = platforms.map((p) => ({ value: p.slug, label: p.name }))
  const categoryOptions = categories
    .filter((c) => c.type !== 'system')
    .map((c) => ({ value: c.slug, label: c.name }))

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
    nature: buildTypeNatureMap(categories),
    subCategory: buildCategorySubcategoryMap(categories),
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Transazioni</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Consulta i movimenti importati, filtra per periodo o piattaforma e
            ordina la lista senza modificare i dati originali.
          </p>
        </div>
        <TransactionFormDialog categories={categories} mostUsed={mostUsed} />
      </div>

      <Suspense
        fallback={<div className="h-24 rounded-xl bg-muted animate-pulse" />}
      >
        <TransactionsToolbar
          route={APP_ROUTES.transactions}
          monthsWithData={monthsWithData}
          filterOptions={{
            platform: platformOptions,
            category: categoryOptions,
            nature: natureOptions,
            type: typeOptions,
          }}
          dependentOptions={dependentOptions}
        />
      </Suspense>

      {transactions.length === 0 ? (
        <EmptyState
          variant={hasActiveTransactionFilters(params) ? 'no-result' : 'no-data'}
          message={
            hasActiveTransactionFilters(params)
              ? 'Nessuna transazione trovata'
              : 'Nessuna transazione'
          }
          hint={
            hasActiveTransactionFilters(params)
              ? 'Nessun movimento corrisponde ai filtri attivi. Prova a modificare periodo, piattaforma o altri filtri.'
              : 'Non ci sono ancora movimenti importati. Importa un file bancario per iniziare.'
          }
        />
      ) : (
        <TransactionTable
          key={buildTransactionTableKey(params, transactions)}
          transactions={transactions}
          route={APP_ROUTES.transactions}
          searchParams={params}
          categories={categories}
          mostUsed={mostUsed}
        />
      )}
    </div>
  )
}
