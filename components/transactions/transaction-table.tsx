'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ExternalLink, MoreHorizontal, Tag } from 'lucide-react'
import { formatAbsoluteAmount } from '@/lib/utils/format-amount'
import { toast } from 'sonner'
import { BulkDeleteTransactionsDialog } from '@/components/transactions/bulk-delete-transactions-dialog'
import { TransactionBulkActionBar } from '@/components/transactions/transaction-bulk-action-bar'
import { TransactionTitleEdit } from '@/components/transactions/transaction-title-edit'
import { ExpenseCategorizeDialog } from '@/components/expenses/expense-categorize-dialog'
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
  DropdownMenuSeparator,
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
import { useToolbarSort } from '@/components/data-table/DataTableToolbar'
import { HeaderSortButton } from '@/components/data-table/HeaderSortButton'
import { deleteTransaction, loadMoreTransactions } from '@/lib/actions/transactions'
import type { TransactionListRow } from '@/lib/dal/transactions'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import type { MostUsedSubcategory } from '@/lib/dal/subcategory-usage'
import type { TransactionSearchParams } from '@/lib/validations/transactions'
import { cn } from '@/lib/utils'

type Props = {
  transactions: TransactionListRow[]
  route: string
  searchParams: TransactionSearchParams
  categories: CategoryWithSubCategories[]
  mostUsed: MostUsedSubcategory[]
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

/**
 * Local wrapper — delegates to the shared display-only formatter (display-only; never
 * use for values written back to the DB).
 * The amountFormatterCache and getAmountFormatter above are kept to avoid breaking
 * any possible future references; this function is the only active call site.
 */
function formatAmount(amount: string, currency: string) {
  return formatAbsoluteAmount(amount, currency)
}

function formatDate(date: Date) {
  return dateFormatter.format(new Date(date))
}

function isExpenseCategorized(status: TransactionListRow['expenseStatus']) {
  return status === '2' || status === '3'
}

function getLinkedExpenseCategoryLabel(transaction: TransactionListRow) {
  const parts = [
    transaction.expenseCategoryName?.trim(),
    transaction.expenseSubCategoryName?.trim(),
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(' → ') : 'Categorizzata'
}

function transactionRowLabel(transaction: TransactionListRow) {
  const raw = transaction.customTitle?.trim() || transaction.description
  return raw.length > 80 ? `${raw.slice(0, 77)}…` : raw
}

export function TransactionTable({ transactions, route, searchParams, categories, mostUsed }: Props) {
  const [loadedTransactions, setLoadedTransactions] = useState(transactions)
  const [hasMore, setHasMore] = useState(transactions.length === PAGE_SIZE)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const isLoadingMoreRef = useRef(false)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  const [categorizeTarget, setCategorizeTarget] = useState<{ id: string; title: string } | null>(null)

  const { activeSort, activeDir, onSort } = useToolbarSort(route)

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

  function updateTransactionTitle(id: string, newTitle: string) {
    setLoadedTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, customTitle: newTitle || null } : t))
    )
  }

  function markExpenseCategorized(transactionId: string, subCategoryId?: string) {
    const selectedSubCategory = subCategoryId
      ? categories
          .flatMap((category) =>
            category.subCategories.map((subCategory) => ({ category, subCategory })),
          )
          .find(({ subCategory }) => String(subCategory.id) === subCategoryId)
      : undefined

    setLoadedTransactions((prev) =>
      prev.map((t) =>
        t.id === transactionId
          ? {
              ...t,
              expenseStatus: '2' as const,
              expenseCategoryName: selectedSubCategory?.category.name ?? t.expenseCategoryName,
              expenseSubCategoryName: selectedSubCategory?.subCategory.name ?? t.expenseSubCategoryName,
            }
          : t,
      ),
    )
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
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <Table className="table-fixed w-full">
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
            <HeaderSortButton
              column={{ key: 'description', label: 'Transazione' }}
              activeSort={activeSort}
              activeDir={activeDir}
              onSort={onSort}
              className="text-xs font-normal uppercase tracking-wide text-muted-foreground"
            />
            <HeaderSortButton
              column={{ key: 'amount', label: 'Importo' }}
              activeSort={activeSort}
              activeDir={activeDir}
              align="right"
              onSort={onSort}
              className="w-32 text-xs font-normal uppercase tracking-wide text-muted-foreground"
            />
            <HeaderSortButton
              column={{ key: 'occurredAt', label: 'Data' }}
              activeSort={activeSort}
              activeDir={activeDir}
              align="right"
              onSort={onSort}
              className="w-28 text-xs font-normal uppercase tracking-wide text-muted-foreground"
            />
            <HeaderSortButton
              column={{ key: 'platform', label: 'Sorgente' }}
              activeSort={activeSort}
              activeDir={activeDir}
              onSort={onSort}
              className="w-40 text-xs font-normal uppercase tracking-wide text-muted-foreground"
            />
            <HeaderSortButton
              column={{ key: 'category', label: 'Spesa collegata' }}
              activeSort={activeSort}
              activeDir={activeDir}
              onSort={onSort}
              className="w-48 text-xs font-normal uppercase tracking-wide text-muted-foreground"
            />
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loadedTransactions.map((transaction) => {
            const isCategorized = isExpenseCategorized(transaction.expenseStatus)
            const hasExpense = Boolean(transaction.expenseId)
            const isSelected = selectedIds.includes(transaction.id)
            const rowLabel = transactionRowLabel(transaction)

            // TODO(Phase 49): categoryType is a placeholder (number | null) — direction semantics not yet wired
            // Phase 46: categoryType comparison against string literals removed; use amount sign fallback
            const isTransfer = false // TODO(Phase 49): restore transfer detection via nature→direction join

            // Amount color: fall back to amount sign until direction join is available (Phase 49)
            const amountColorClass = transaction.amount.trim().startsWith('-')
              ? 'text-total-out'
              : 'text-total-in'

            return (
              <TableRow
                key={transaction.id}
                className={cn(
                  'group hover:bg-muted/50',
                  isSelected && 'bg-primary/5',
                  isTransfer && 'opacity-60',
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
                <TableCell className="overflow-hidden">
                  <TransactionTitleEdit
                    id={transaction.id}
                    description={transaction.description}
                    customTitle={transaction.customTitle}
                    onSuccess={(newTitle) => updateTransactionTitle(transaction.id, newTitle)}
                  />
                </TableCell>
                <TableCell
                  className={cn(
                    'text-right font-mono tabular-nums',
                    amountColorClass,
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
                    isCategorized ? (
                      <span
                        className="block truncate text-sm"
                        title={getLinkedExpenseCategoryLabel(transaction)}
                      >
                        {getLinkedExpenseCategoryLabel(transaction)}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setCategorizeTarget({
                            id: transaction.expenseId!,
                            title: transaction.expenseTitle ?? rowLabel,
                          })
                        }
                        className="w-fit"
                      >
                        <Badge
                          variant="outline"
                          className="border-0 bg-amber-100 text-amber-700 cursor-pointer hover:bg-amber-200 transition-colors"
                        >
                          Da categorizzare
                        </Badge>
                      </button>
                    )
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
                      {/* Categorized rows: show only Ricategorizza (no Google search) */}
                      {isCategorized ? (
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault()
                            setCategorizeTarget({
                              id: transaction.expenseId!,
                              title: transaction.expenseTitle ?? rowLabel,
                            })
                            setOpenDropdownId(null)
                          }}
                          className="flex items-center gap-2"
                        >
                          <Tag className="h-4 w-4" />
                          Ricategorizza
                        </DropdownMenuItem>
                      ) : (
                        <>
                          <DropdownMenuItem asChild>
                            <a
                              href={`https://www.google.com/search?q=${encodeURIComponent(transaction.customTitle?.trim() || transaction.description)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2"
                            >
                              <ExternalLink className="h-4 w-4" />
                              Cerca su Google
                            </a>
                          </DropdownMenuItem>
                          {transaction.expenseId && transaction.expenseStatus === '1' && (
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault()
                                setCategorizeTarget({
                                  id: transaction.expenseId!,
                                  title: transaction.expenseTitle ?? rowLabel,
                                })
                                setOpenDropdownId(null)
                              }}
                              className="flex items-center gap-2"
                            >
                              <Tag className="h-4 w-4" />
                              Categorizza spesa
                            </DropdownMenuItem>
                          )}
                        </>
                      )}
                      <DropdownMenuSeparator />
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

    {categorizeTarget && (
      <ExpenseCategorizeDialog
        open={Boolean(categorizeTarget)}
        onOpenChange={(open) => { if (!open) setCategorizeTarget(null) }}
        expense={categorizeTarget}
        categories={categories}
        mostUsed={mostUsed}
        onSuccess={(subCategoryId) => {
          const txId = loadedTransactions.find((t) => t.expenseId === categorizeTarget.id)?.id
          if (txId) markExpenseCategorized(txId, subCategoryId)
          setCategorizeTarget(null)
        }}
      />
    )}
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
