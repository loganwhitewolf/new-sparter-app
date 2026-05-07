'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { TransactionTitleEdit } from '@/components/transactions/transaction-title-edit'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { loadMoreTransactions } from '@/lib/actions/transactions'
import type { TransactionListRow } from '@/lib/dal/transactions'
import type {
  ParsedTransactionFilters,
  TransactionSearchParams,
} from '@/lib/validations/transactions'
import { cn } from '@/lib/utils'

type Props = {
  transactions: TransactionListRow[]
  filters: Pick<ParsedTransactionFilters, 'sort' | 'dir'>
  searchParams: TransactionSearchParams
}

const PAGE_SIZE = 50

const amountFormatterCache = new Map<string, Intl.NumberFormat>()
const dateFormatter = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function getAmountFormatter(currency: string) {
  const normalizedCurrency = currency || 'EUR'
  const cached = amountFormatterCache.get(normalizedCurrency)

  if (cached) {
    return cached
  }

  const formatter = new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: normalizedCurrency,
  })
  amountFormatterCache.set(normalizedCurrency, formatter)
  return formatter
}

function formatAmount(amount: string, currency: string) {
  const numericAmount = Number(amount)

  if (!Number.isFinite(numericAmount)) {
    return `${amount} ${currency || 'EUR'}`
  }

  return getAmountFormatter(currency).format(numericAmount)
}

function formatDate(date: Date) {
  return dateFormatter.format(new Date(date))
}

function getExpenseStatusLabel(status: TransactionListRow['expenseStatus']) {
  switch (status) {
    case '2':
    case '3':
      return 'Categorizzata'
    case '1':
    default:
      return 'Da categorizzare'
  }
}

function getSortDirection(
  filters: Pick<ParsedTransactionFilters, 'sort' | 'dir'>,
  column: 'amount' | 'occurredAt',
): 'ascending' | 'descending' | 'none' {
  if (filters.sort !== column) {
    return 'none'
  }

  return filters.dir === 'asc' ? 'ascending' : 'descending'
}

export function TransactionTable({ transactions, filters, searchParams }: Props) {
  const [loadedTransactions, setLoadedTransactions] = useState(transactions)
  const [hasMore, setHasMore] = useState(transactions.length === PAGE_SIZE)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const isLoadingMoreRef = useRef(false)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const loadNextPage = useCallback(async () => {
    if (isLoadingMoreRef.current || !hasMore) {
      return
    }

    isLoadingMoreRef.current = true
    setIsLoadingMore(true)
    setLoadError(null)

    try {
      const result = await loadMoreTransactions({
        filters: searchParams,
        offset: loadedTransactions.length,
      })

      if (result.error) {
        setLoadError(result.error)
        toast.error(result.error)
        return
      }

      setLoadedTransactions((current) => [...current, ...result.transactions])
      setHasMore(result.hasMore)
    } catch {
      const error = 'Non è stato possibile caricare altre transazioni. Riprova.'
      setLoadError(error)
      toast.error(error)
    } finally {
      isLoadingMoreRef.current = false
      setIsLoadingMore(false)
    }
  }, [hasMore, loadedTransactions.length, searchParams])

  useEffect(() => {
    const target = loadMoreRef.current

    if (!target || !hasMore) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadNextPage()
        }
      },
      { rootMargin: '320px 0px' },
    )

    observer.observe(target)

    return () => observer.disconnect()
  }, [hasMore, loadNextPage])

  if (loadedTransactions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
          <p className="text-base font-medium text-foreground">
            Nessuna transazione trovata
          </p>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Non ci sono movimenti importati per i filtri selezionati. Modifica
            periodo o piattaforma, oppure importa un file per iniziare.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <Table>
        <TableCaption className="sr-only">
          Elenco transazioni importate con importo, data, sorgente ed eventuale
          spesa collegata.
        </TableCaption>
        <TableHeader>
          <TableRow className="bg-secondary/70">
            <TableHead className="min-w-[18rem] text-xs font-normal uppercase tracking-wide text-muted-foreground">
              Transazione
            </TableHead>
            <TableHead
              className="w-36 text-right text-xs font-normal uppercase tracking-wide text-muted-foreground"
              aria-sort={getSortDirection(filters, 'amount')}
            >
              Importo
            </TableHead>
            <TableHead
              className="w-36 text-right text-xs font-normal uppercase tracking-wide text-muted-foreground"
              aria-sort={getSortDirection(filters, 'occurredAt')}
            >
              Data
            </TableHead>
            <TableHead className="min-w-[13rem] text-xs font-normal uppercase tracking-wide text-muted-foreground">
              Sorgente
            </TableHead>
            <TableHead className="min-w-[13rem] text-xs font-normal uppercase tracking-wide text-muted-foreground">
              Spesa collegata
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loadedTransactions.map((transaction) => {
            const expenseStatus = getExpenseStatusLabel(transaction.expenseStatus)
            const hasExpense = Boolean(transaction.expenseId)

            return (
              <TableRow key={transaction.id} className="group hover:bg-muted/50">
                <TableCell className="max-w-[24rem]">
                  <TransactionTitleEdit
                    id={transaction.id}
                    description={transaction.description}
                    customTitle={transaction.customTitle}
                  />
                </TableCell>
                <TableCell
                  className={cn(
                    'text-right font-mono tabular-nums',
                    transaction.amount.trim().startsWith('-')
                      ? 'text-emerald-700'
                      : 'text-foreground',
                  )}
                >
                  {formatAmount(transaction.amount, transaction.currency)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">
                  {formatDate(transaction.occurredAt)}
                </TableCell>
                <TableCell>
                  {transaction.fileId ? (
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="truncate text-sm">
                        {transaction.platformName ?? 'Piattaforma non disponibile'}
                      </span>
                      <span
                        className="truncate text-xs text-muted-foreground"
                        title={transaction.fileName ?? undefined}
                      >
                        {transaction.fileName ?? `Riga ${transaction.rowIndex + 1}`}
                      </span>
                    </div>
                  ) : (
                    <Badge variant="outline" className="w-fit">
                      Manuale
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {hasExpense ? (
                    <div className="flex min-w-0 flex-col gap-1">
                      <span
                        className="truncate text-sm"
                        title={transaction.expenseTitle ?? undefined}
                      >
                        {transaction.expenseTitle ?? 'Spesa senza titolo'}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          'w-fit border-0',
                          expenseStatus === 'Categorizzata'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700',
                        )}
                      >
                        {expenseStatus}
                      </Badge>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Nessuna spesa collegata
                    </span>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <div
        ref={loadMoreRef}
        className="flex min-h-14 items-center justify-center border-t px-4 py-3"
        aria-live="polite"
      >
        {isLoadingMore ? (
          <p className="text-sm text-muted-foreground">Caricamento altre transazioni…</p>
        ) : hasMore ? (
          <Button type="button" variant="ghost" size="sm" onClick={loadNextPage}>
            Carica altre 50 transazioni
          </Button>
        ) : loadedTransactions.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Tutte le transazioni disponibili sono caricate.
          </p>
        ) : null}
      </div>
      {loadError ? (
        <p className="border-t px-4 py-3 text-center text-sm text-destructive" role="alert">
          {loadError}
        </p>
      ) : null}
    </div>
  )
}
