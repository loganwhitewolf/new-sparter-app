import { Suspense } from 'react'
import {
  getTransactionPlatforms,
  getTransactions,
  mapParsedTransactionFiltersToDal,
} from '@/lib/dal/transactions'
import { getCategories } from '@/lib/dal/categories'
import { getMostUsedSubcategories } from '@/lib/dal/subcategory-usage'
import { getMonthsWithData } from '@/lib/dal/months-with-data'
import { verifySession } from '@/lib/dal/auth'
import { getTags } from '@/lib/dal/tags'
import { getTagsForTransactionIds } from '@/lib/dal/transaction-tags'
import {
  parseTransactionFilters,
  type TransactionSearchParams,
} from '@/lib/validations/transactions'
import { NATURE_LABELS, NATURE_ORDER } from '@/lib/utils/nature-labels'
import { buildDirectionNatureMap, buildCategorySubcategoryMap, buildDirectionCategoryMap } from '@/lib/utils/cascade-options'
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
      // Pairing fields (PAIR-02): remount the table when a pair is created/removed
      // so the badge appears/disappears without a manual reload — the table copies
      // `transactions` into local state, so prop updates only land on remount.
      transaction.pairedWithId ?? '',
      transaction.pairedNetAmount ?? '',
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
    params.direction ?? params.type ?? '',
  ].join(':')

  return `${filterKey}:${dataKey}`
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<TransactionSearchParams>
}) {
  const { userId } = await verifySession()
  const params = await searchParams
  const filters = mapParsedTransactionFiltersToDal(parseTransactionFilters(params))
  const [transactions, platforms, categories, mostUsed, monthsWithData] = await Promise.all([
    getTransactions(filters),
    getTransactionPlatforms(),
    getCategories(),
    getMostUsedSubcategories(['in', 'out', 'transfer', 'allocation']),
    getMonthsWithData('transactions'),
  ])

  // Tag data (TAG-02): getTagsForTransactionIds performs no ownership check of its own —
  // it is only ever called here with ids sourced from the already-userId-scoped
  // getTransactions(filters) call above, per the threat model's trust-boundary note.
  const [tags, transactionTagRows] = await Promise.all([
    getTags(userId),
    getTagsForTransactionIds(transactions.map((t) => t.id)),
  ])
  const tagsByTransactionId = transactionTagRows.reduce(
    (acc, row) => {
      ;(acc[row.transactionId] ??= []).push({
        tagId: row.tagId,
        tagName: row.tagName,
        archived: row.archived,
      })
      return acc
    },
    {} as Record<string, { tagId: number; tagName: string; archived: boolean }[]>,
  )

  const platformOptions = platforms.map((p) => ({ value: p.slug, label: p.name }))
  const categoryOptions = categories
    .map((c) => ({ value: c.slug, label: c.name }))

  // Nature filter options: nine FlowNature values in canonical order + 'Non classificato'
  const natureOptions = [
    ...NATURE_ORDER.filter((n): n is NonNullable<typeof n> => n !== null).map((n) => ({
      value: n,
      label: NATURE_LABELS[n],
    })),
    { value: 'unclassified', label: NATURE_LABELS.unclassified },
  ]

  // Direction filter options: In/Out/Accantonamenti/Trasferimenti + 'Non classificato' (D-08)
  const directionOptions = [
    { value: 'in', label: 'Entrate' },
    { value: 'out', label: 'Uscite' },
    { value: 'allocation', label: 'Accantonamenti' },
    { value: 'transfer', label: 'Trasferimenti' },
    { value: 'unclassified', label: 'Non classificato' },
  ]

  // Cascade-derived option maps: direction→nature, direction→category, category→subcategory
  const dependentOptions = {
    nature: buildDirectionNatureMap(categories),
    category: buildDirectionCategoryMap(categories),
    subCategory: buildCategorySubcategoryMap(categories),
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Transazioni</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Consulta le tue transazioni.
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
            direction: directionOptions,
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
          tags={tags}
          tagsByTransactionId={tagsByTransactionId}
        />
      )}
    </div>
  )
}
