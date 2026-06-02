import { Suspense } from 'react'
import {
  getTransactionPlatforms,
  getTransactions,
} from '@/lib/dal/transactions'
import { getCategories } from '@/lib/dal/categories'
import { getMostUsedSubcategories } from '@/lib/dal/subcategory-usage'
import {
  parseTransactionFilters,
  type TransactionSearchParams,
} from '@/lib/validations/transactions'
import { TransactionFilters } from '@/components/transactions/transaction-filters'
import { TransactionFormDialog } from '@/components/transactions/transaction-form-dialog'
import { TransactionTable } from '@/components/transactions/transaction-table'

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

  return `${JSON.stringify(params)}:${dataKey}`
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<TransactionSearchParams>
}) {
  const params = await searchParams
  const filters = parseTransactionFilters(params)
  const [transactions, platforms, categories, mostUsed] = await Promise.all([
    getTransactions(filters),
    getTransactionPlatforms(),
    getCategories(),
    getMostUsedSubcategories(['in', 'out', 'transfer', 'system']),
  ])

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
        <TransactionFormDialog categories={categories} />
      </div>

      <Suspense
        fallback={<div className="h-24 rounded-xl bg-muted animate-pulse" />}
      >
        <TransactionFilters filters={filters} platforms={platforms} categories={categories} />
      </Suspense>

      <TransactionTable
        key={buildTransactionTableKey(params, transactions)}
        transactions={transactions}
        filters={filters}
        searchParams={params}
        categories={categories}
        mostUsed={mostUsed}
      />
    </div>
  )
}
