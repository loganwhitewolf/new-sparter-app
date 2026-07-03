'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, MoreHorizontal, Split, Tag, Unlink } from 'lucide-react'
import { formatAbsoluteAmount } from '@/lib/utils/format-amount'
import { toast } from 'sonner'
import { BulkDeleteTransactionsDialog } from '@/components/transactions/bulk-delete-transactions-dialog'
import { TransactionBulkActionBar } from '@/components/transactions/transaction-bulk-action-bar'
import { TransactionTitleEdit } from '@/components/transactions/transaction-title-edit'
import { CounterpartPickerDialog } from '@/components/transactions/counterpart-picker-dialog'
import { DetachExpenseDialog } from '@/components/transactions/detach-expense-dialog'
import { TransactionPairPopover } from '@/components/transactions/transaction-pair-popover'
import { ExpenseCategorizeDialog } from '@/components/expenses/expense-categorize-dialog'
import { BulkCategorizeDialog } from '@/components/expenses/bulk-categorize-dialog'
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
import { deleteTransactionPairAction } from '@/lib/actions/transaction-pairs'
import type { TransactionListRow } from '@/lib/dal/transactions'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import type { MostUsedSubcategory } from '@/lib/dal/subcategory-usage'
import type { TransactionSearchParams } from '@/lib/validations/transactions'
import { APP_ROUTES } from '@/lib/routes'
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


function transactionRowLabel(transaction: TransactionListRow) {
  const raw =
    transaction.customTitle?.trim() || transaction.expenseTitle?.trim() || transaction.description
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
  const [bulkCategorizeOpen, setBulkCategorizeOpen] = useState(false)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  const [categorizeTarget, setCategorizeTarget] = useState<{ id: string; title: string } | null>(null)
  // Pair target: set when "Collega rimborso" is selected (D-09, PAIR-01)
  const [pairTarget, setPairTarget] = useState<{ id: string; amount: string; occurredAt: Date } | null>(null)
  const [detachTarget, setDetachTarget] = useState<{
    transactionId: string
    defaultTitle: string
  } | null>(null)

  const { activeSort, activeDir, onSort } = useToolbarSort(route)

  const selectedExpenseIds = useMemo(() => {
    const idSet = new Set<string>()
    for (const transaction of loadedTransactions) {
      if (selectedIds.includes(transaction.id) && transaction.expenseId) {
        idSet.add(transaction.expenseId)
      }
    }
    return [...idSet]
  }, [loadedTransactions, selectedIds])

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

  /**
   * Unlink a pair by calling deleteTransactionPairAction for the given transaction.
   * On success, clears pairedWithId/pairedNetAmount/pairedDescription/pairedOccurredAt
   * on BOTH legs of the pair in the local list so the badge disappears immediately
   * without waiting for a server re-render (optimistic UI, PAIR-03 D-11).
   */
  async function handleUnpair(transactionId: string) {
    const tx = loadedTransactions.find((t) => t.id === transactionId)
    const partnerId = tx?.pairedWithId ?? null

    const fd = new FormData()
    fd.set('transactionId', transactionId)
    const result = await deleteTransactionPairAction({ error: null }, fd)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Collegamento rimosso.')
      // Optimistically clear pair fields on both legs of the pair.
      const idsToUnpair = new Set([transactionId, ...(partnerId ? [partnerId] : [])])
      setLoadedTransactions((prev) =>
        prev.map((t) =>
          idsToUnpair.has(t.id)
            ? { ...t, pairedWithId: null, pairedNetAmount: null, pairedDescription: null, pairedOccurredAt: null }
            : t,
        ),
      )
    }
  }

  function markExpenseDetached(
    transactionId: string,
    newExpense: { id: string; title: string },
  ) {
    setLoadedTransactions((prev) =>
      prev.map((t) =>
        t.id === transactionId
          ? {
              ...t,
              expenseId: newExpense.id,
              expenseTitle: newExpense.title,
              expenseStatus: '1' as const,
              expenseCategoryName: null,
              expenseSubCategoryName: null,
              expenseTransactionCount: 1,
            }
          : t,
      ),
    )
  }

  function markExpenseCategorized(transactionId: string, subCategoryId?: string) {
    const transaction = loadedTransactions.find((t) => t.id === transactionId)
    if (transaction?.expenseId) {
      markExpensesCategorized([transaction.expenseId], subCategoryId)
    }
  }

  function markExpensesCategorized(expenseIds: string[], subCategoryId?: string) {
    const expenseIdSet = new Set(expenseIds)
    const selectedSubCategory = subCategoryId
      ? categories
          .flatMap((category) =>
            category.subCategories.map((subCategory) => ({ category, subCategory })),
          )
          .find(({ subCategory }) => String(subCategory.id) === subCategoryId)
      : undefined

    setLoadedTransactions((prev) =>
      prev.map((t) =>
        t.expenseId && expenseIdSet.has(t.expenseId)
          ? {
              ...t,
              expenseStatus: '3' as const,
              expenseCategoryName: selectedSubCategory?.category.name ?? t.expenseCategoryName,
              expenseSubCategoryName: selectedSubCategory?.subCategory.name ?? t.expenseSubCategoryName,
            }
          : t,
      ),
    )
  }

  function openBulkCategorize() {
    if (selectedExpenseIds.length === 0) {
      toast.error('Nessuna delle transazioni selezionate ha una spesa collegata.')
      return
    }
    setBulkCategorizeOpen(true)
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

            // categoryType is a direction code from the nature→direction join (Plan 03)
            const isTransfer = transaction.categoryType === 'transfer'

            // Amount color derived from direction code; fall back to sign for uncategorized rows
            const amountColorClass =
              transaction.categoryType === 'in'
                ? 'text-total-in'
                : transaction.categoryType === 'out' ||
                    transaction.categoryType === 'allocation' ||
                    transaction.categoryType === 'transfer'
                  ? 'text-total-out'
                  : transaction.amount.trim().startsWith('-')
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
                <TableCell className="max-w-0 w-full">
                  <div className="flex flex-col gap-1">
                    <TransactionTitleEdit
                      id={transaction.id}
                      description={transaction.description}
                      customTitle={transaction.customTitle}
                      fallbackTitle={transaction.expenseTitle}
                      onSuccess={(newTitle) => updateTransactionTitle(transaction.id, newTitle)}
                    />
                    {/* Inline pair badge — shown when the row is paired (D-15, PAIR-02).
                        Rows stay in natural chronological order (no re-sort/grouping).
                        WR-05: gate on ALL required fields being non-null. Substituting
                        a fallback amount/date would render plausible-but-wrong financial
                        data; if any field is missing, hide the badge instead. */}
                    {transaction.pairedWithId &&
                      transaction.pairedNetAmount &&
                      transaction.pairedAmount &&
                      transaction.pairedOccurredAt && (
                        <TransactionPairPopover
                          pairedWithId={transaction.pairedWithId}
                          netAmount={transaction.pairedNetAmount}
                          pairedDescription={transaction.pairedDescription ?? ''}
                          pairedAmount={transaction.pairedAmount}
                          pairedOccurredAt={transaction.pairedOccurredAt}
                        />
                      )}
                  </div>
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
                      <Link
                        href={`${APP_ROUTES.import}?fileId=${encodeURIComponent(transaction.fileId)}`}
                        className="truncate text-xs text-muted-foreground hover:text-foreground hover:underline"
                        title={`Apri importazione: ${transaction.fileName ?? `Riga ${transaction.rowIndex + 1}`}`}
                      >
                        {transaction.fileName ?? `Riga ${transaction.rowIndex + 1}`}
                      </Link>
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
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm">
                          {transaction.expenseSubCategoryName?.trim() || transaction.expenseCategoryName?.trim() || 'Categorizzata'}
                        </span>
                        {transaction.expenseSubCategoryName?.trim() && transaction.expenseCategoryName?.trim() && (
                          <span className="text-xs text-muted-foreground">{transaction.expenseCategoryName.trim()}</span>
                        )}
                      </div>
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
                      {/* Pair actions (D-09, D-11, PAIR-01, PAIR-03) */}
                      {transaction.pairedWithId ? (
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault()
                            setOpenDropdownId(null)
                            void handleUnpair(transaction.id)
                          }}
                          className="flex items-center gap-2"
                        >
                          <Unlink className="h-4 w-4" />
                          Scollega
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault()
                            setPairTarget({
                              id: transaction.id,
                              amount: transaction.amount,
                              occurredAt: transaction.occurredAt,
                            })
                            setOpenDropdownId(null)
                          }}
                          className="flex items-center gap-2"
                        >
                          <Unlink className="h-4 w-4 rotate-45" />
                          Collega rimborso
                        </DropdownMenuItem>
                      )}
                      {transaction.expenseId && (
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault()
                            const prefill = (
                              transaction.customTitle?.trim() || transaction.description
                            ).slice(0, 120)
                            setDetachTarget({
                              transactionId: transaction.id,
                              defaultTitle: prefill,
                            })
                            setOpenDropdownId(null)
                          }}
                          className="flex items-center gap-2"
                        >
                          <Split className="h-4 w-4" />
                          Spesa a sé (non aggregare)
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DeleteTransactionMenuItem
                        transactionId={transaction.id}
                        label={rowLabel}
                        expenseTitle={transaction.expenseTitle}
                        expenseTransactionCount={transaction.expenseTransactionCount}
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
      canBulkCategorize={selectedExpenseIds.length > 0}
      onBulkCategorize={openBulkCategorize}
      onBulkDelete={() => setBulkDeleteOpen(true)}
    />

    <BulkCategorizeDialog
      open={bulkCategorizeOpen}
      onOpenChange={setBulkCategorizeOpen}
      selectedIds={selectedExpenseIds}
      categories={categories}
      mostUsed={mostUsed}
      successCount={selectedIds.length}
      successNoun="transazioni"
        onSuccess={(subCategoryId) => {
          markExpensesCategorized(selectedExpenseIds, subCategoryId)
          setSelectedIds([])
          setBulkCategorizeOpen(false)
        }}
    />

    <BulkDeleteTransactionsDialog
      open={bulkDeleteOpen}
      onOpenChange={setBulkDeleteOpen}
      selectedIds={selectedIds}
      oneToOneExpenseCount={
        new Set(
          loadedTransactions
            .filter(
              (transaction) =>
                selectedIds.includes(transaction.id) &&
                transaction.expenseId &&
                transaction.expenseTransactionCount === 1,
            )
            .map((transaction) => transaction.expenseId as string),
        ).size
      }
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

    {/* Counterpart picker dialog — opened by "Collega rimborso" row action (PAIR-01, D-09).
        key={pairTarget.id} remounts the dialog per transaction so its date-range state is
        re-initialised from this transaction's occurredAt — avoids a stale window carried
        over from a previously-opened row. */}
    <CounterpartPickerDialog
      key={pairTarget?.id ?? 'none'}
      open={pairTarget !== null}
      onOpenChange={(o) => { if (!o) setPairTarget(null) }}
      transactionId={pairTarget?.id ?? ''}
      transactionAmount={pairTarget?.amount ?? ''}
      transactionOccurredAt={pairTarget?.occurredAt ?? new Date()}
    />

    {detachTarget && (
      <DetachExpenseDialog
        open={Boolean(detachTarget)}
        onOpenChange={(open) => { if (!open) setDetachTarget(null) }}
        transactionId={detachTarget.transactionId}
        defaultTitle={detachTarget.defaultTitle}
        categories={categories}
        mostUsed={mostUsed}
        onSuccess={({ newExpenseId, newExpenseTitle, subCategoryId }) => {
          markExpenseDetached(detachTarget.transactionId, {
            id: newExpenseId,
            title: newExpenseTitle,
          })
          if (subCategoryId !== undefined) {
            markExpensesCategorized([newExpenseId], String(subCategoryId))
          }
          setDetachTarget(null)
        }}
      />
    )}
    </>
  )
}

function DeleteTransactionMenuItem({
  transactionId,
  label,
  expenseTitle,
  expenseTransactionCount,
  onDeleted,
}: {
  transactionId: string
  label: string
  expenseTitle: string | null
  expenseTransactionCount: number | null
  onDeleted: () => void
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [deleteLinkedExpenses, setDeleteLinkedExpenses] = useState(false)
  const isOneToOne = Boolean(expenseTitle) && expenseTransactionCount === 1

  useEffect(() => {
    if (!open) {
      setDeleteLinkedExpenses(false)
    }
  }, [open])

  async function handleDelete() {
    setPending(true)
    const fd = new FormData()
    fd.set('id', transactionId)
    fd.set('deleteLinkedExpenses', deleteLinkedExpenses ? 'true' : 'false')
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
            Conferma l&apos;eliminazione della transazione selezionata e, opzionalmente, della spesa
            collegata in rapporto 1:1.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Sei sicuro di voler eliminare questa transazione
          {label ? ` (“${label}”)` : ''}? Le spese aggregate collegate verranno aggiornate di
          conseguenza.
        </p>
        {isOneToOne ? (
          <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={deleteLinkedExpenses}
              onChange={(event) => setDeleteLinkedExpenses(event.target.checked)}
            />
            <span>
              Elimina anche la spesa collegata &ldquo;{expenseTitle}&rdquo;
            </span>
          </label>
        ) : null}
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
