import { Suspense } from 'react'
import {
  getTransactionPlatforms,
  getTransactions,
} from '@/lib/dal/transactions'
import {
  parseTransactionFilters,
  type TransactionSearchParams,
} from '@/lib/validations/transactions'
import { TransactionFilters } from '@/components/transactions/transaction-filters'
import { TransactionTable } from '@/components/transactions/transaction-table'

export default async function TransazioniPage({
  searchParams,
}: {
  searchParams: Promise<TransactionSearchParams>
}) {
  const params = await searchParams
  const filters = parseTransactionFilters(params)
  const [transactions, platforms] = await Promise.all([
    getTransactions(filters),
    getTransactionPlatforms(),
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
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {transactions.length === 1
            ? '1 transazione visualizzata'
            : `${transactions.length} transazioni visualizzate`}
        </p>
      </div>

      <Suspense
        fallback={<div className="h-24 rounded-xl bg-muted animate-pulse" />}
      >
        <TransactionFilters filters={filters} platforms={platforms} />
      </Suspense>

      <TransactionTable transactions={transactions} filters={filters} />
    </div>
  )
}
