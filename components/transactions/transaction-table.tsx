'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { BulkDeleteTransactionsDialog } from '@/components/transactions/bulk-delete-transactions-dialog'
import { TransactionBulkActionBar } from '@/components/transactions/transaction-bulk-action-bar'
import { TransactionTitleEdit } from '@/components/transactions/transaction-title-edit'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { deleteTransaction, loadMoreTransactions } from '@/lib/actions/transactions'
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

function transactionRowLabel(transaction: TransactionListRow) {
  const raw = transaction.customTitle?.trim() || transaction.description
  return raw.length > 80 ? `${raw.slice(0, 77)}…` : raw
}

export function TransactionTable({ transactions, filters, searchParams }: Props) {
  const [loadedTransactions, setLoadedTransactions] = useState(transactions)
  const [hasMore, setHasMore] = useState(transactions.length === PAGE_SIZE)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const isLoadingMoreRef = useRef(false)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)

  const allSelected =
    loadedTransactions.length > 0 && selectedIds.length === loadedTransactions.length
  const someSelected =
    selectedIds.length > 0 && selectedIds.length < loadedTransactions.length

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

  function toggleAll() {
    setSelectedIds(allSelected ? [] : loadedTransactions.map((t) => t.id))
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function removeTransactionsFromList(ids: string[]) {
    const idSet = new Set(ids)
    setLoadedTransactions((prev) => prev.filter((t) => !idSet.has(t.id)))
    setSelectedIds((prev) => prev.filter((id) => !idSet.has(id)))
  }

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
    <>
    <div className="rounded-xl border bg-card shadow-sm">
      <Table>
        <TableCaption className="sr-only">
          Elenco transazioni importate con importo, data, sorgente ed eventuale
          spesa collegata.
        </TableCaption>
        <TableHeader>
          <TableRow className="bg-secondary/70">
            <TableHead className="w-10 text-center">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected
                }}
                onChange={toggleAll}
                className="h-4 w-4 cursor-pointer"
                aria-label="Seleziona tutte le transazioni"
              />
            </TableHead>
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
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loadedTransactions.map((transaction) => {
            const expenseStatus = getExpenseStatusLabel(transaction.expenseStatus)
            const hasExpense = Boolean(transaction.expenseId)
            const isSelected = selectedIds.includes(transaction.id)
            const rowLabel = transactionRowLabel(transaction)

            return (
              <TableRow
                key={transaction.id}
                className={cn(
                  'group hover:bg-muted/50',
                  isSelected && 'bg-primary/5',
                )}
              >
                <TableCell className="w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleRow(transaction.id)}
                    className="h-4 w-4 cursor-pointer"
                    aria-label={`Seleziona ${rowLabel}`}
                  />
                </TableCell>
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
                <TableCell className="w-10 text-center">
                  <DropdownMenu
                    open={openDropdownId === transaction.id}
                    onOpenChange={(o) => setOpenDropdownId(o ? transaction.id : null)}
                  >
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={`Azioni per ${rowLabel}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DeleteTransactionMenuItem
                        transactionId={transaction.id}
                        label={rowLabel}
                        onDeleted={() => {
                          removeTransactionsFromList([transaction.id])
                          setOpenDropdownId(null)
                        }}
                      />
                    </DropdownMenuContent>
                  </DropdownMenu>
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

    <TransactionBulkActionBar
      selectedIds={selectedIds}
      onBulkDelete={() => setBulkDeleteOpen(true)}
    />

    <BulkDeleteTransactionsDialog
      open={bulkDeleteOpen}
      onOpenChange={setBulkDeleteOpen}
      selectedIds={selectedIds}
      onSuccess={() => {
        removeTransactionsFromList(selectedIds)
        setBulkDeleteOpen(false)
      }}
    />
    </>
  )
}

function DeleteTransactionMenuItem({
  transactionId,
  label,
  onDeleted,
}: {
  transactionId: string
  label: string
  onDeleted: () => void
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  async function handleDelete() {
    setPending(true)
    const fd = new FormData()
    fd.set('id', transactionId)
    const result = await deleteTransaction({ error: null }, fd)
    setPending(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Transazione eliminata.')
      onDeleted()
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem
          onSelect={(e) => e.preventDefault()}
          className="text-destructive focus:text-destructive"
        >
          Elimina
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Elimina transazione</DialogTitle>
          <DialogDescription className="sr-only">
            Conferma l&apos;eliminazione della transazione selezionata.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Sei sicuro di voler eliminare questa transazione
          {label ? ` (“${label}”)` : ''}? Le spese collegate verranno aggiornate di conseguenza.
        </p>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Annulla
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={pending}>
            Elimina
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
