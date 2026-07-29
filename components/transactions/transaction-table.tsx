'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarClock, ExternalLink, MoreHorizontal, Split, Tag, Trash2, Unlink } from 'lucide-react'
import { formatAbsoluteAmount } from '@/lib/utils/format-amount'
import { toDecimal } from '@/lib/utils/decimal'
import { toast } from 'sonner'
import { BulkDeleteTransactionsDialog } from '@/components/transactions/bulk-delete-transactions-dialog'
import { TransactionBulkActionBar } from '@/components/transactions/transaction-bulk-action-bar'
import { TransactionTitleEdit } from '@/components/transactions/transaction-title-edit'
import { CounterpartPickerDialog } from '@/components/transactions/counterpart-picker-dialog'
import { DetachExpenseDialog } from '@/components/transactions/detach-expense-dialog'
import { ActivateAmortizationDialog } from '@/components/transactions/activate-amortization-dialog'
import { RemoveAmortizationDialog } from '@/components/transactions/remove-amortization-dialog'
import { CloseAmortizationDialog } from '@/components/transactions/close-amortization-dialog'
import { ReimbursementRowIndicator } from '@/components/transactions/reimbursement-row-indicator'
import { ExpenseCategorizeDialog } from '@/components/expenses/expense-categorize-dialog'
import { BulkCategorizeDialog } from '@/components/expenses/bulk-categorize-dialog'
import { BulkAssignTagsDialog } from '@/components/tags/bulk-assign-tags-dialog'
import { TransactionTagsChip } from '@/components/transactions/transaction-tags-chip'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useToolbarSort } from '@/components/data-table/DataTableToolbar'
import { TableRestoreSkeleton } from '@/components/data-table/table-restore-skeleton'
import { HeaderSortButton } from '@/components/data-table/HeaderSortButton'
import { deleteTransaction, loadMoreTransactions } from '@/lib/actions/transactions'
import { deleteTransactionPairAction } from '@/lib/actions/transaction-pairs'
import type { TransactionListRow } from '@/lib/dal/transactions'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import type { MostUsedSubcategory } from '@/lib/dal/subcategory-usage'
import type { TagRow } from '@/lib/dal/tags'
import type { TransactionSearchParams } from '@/lib/validations/transactions'
import { importFileDetailHref, transactionDetailHref } from '@/lib/routes'
import { amountToneClass } from '@/lib/utils/amount-tone'
import { cn } from '@/lib/utils'
import { minimumTwoMonthInstalment, validateMonthsForAmount } from '@/lib/services/amortization-math'
import {
  amortizationGuardMessage,
  type AmortizationGuardFailure,
} from '@/lib/utils/amortization-guard-messages'

type Props = {
  transactions: TransactionListRow[]
  route: string
  searchParams: TransactionSearchParams
  categories: CategoryWithSubCategories[]
  mostUsed: MostUsedSubcategory[]
  tags: TagRow[]
  tagsByTransactionId: Record<string, { tagId: number; tagName: string; archived: boolean }[]>
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

type AmortizationEligibility = { eligible: true } | ({ eligible: false } & AmortizationGuardFailure)

/**
 * Client-side mirror of getAmortizationEligibility (Phase 77, D-04..D-07 + outflow-only) —
 * derived synchronously from fields transactionListSelect already exposes (reimbursementId,
 * amortizationPlanId, groupId, amount), so there is no loading flash to guard against (D-08) for
 * this entry point. The server action independently re-checks every guard before any write.
 */
function computeAmortizationEligibility(transaction: TransactionListRow): AmortizationEligibility {
  if (transaction.reimbursementId != null) {
    return { eligible: false, reason: 'reimbursement' }
  }
  if (transaction.amortizationPlanId != null) {
    return { eligible: false, reason: 'already-amortized' }
  }
  if (transaction.groupId != null) {
    return { eligible: false, reason: 'expense-group' }
  }
  if (!toDecimal(transaction.amount).isNegative()) {
    return { eligible: false, reason: 'not-outflow' }
  }
  const validation = validateMonthsForAmount(transaction.amount, 2)
  if (!validation.valid) {
    return {
      eligible: false,
      reason: 'too-small',
      requiredPerMonth: minimumTwoMonthInstalment(transaction.amount),
    }
  }
  return { eligible: true }
}


/**
 * Resolves whether this row is the ANCHOR (outflow) or the COUNTERPART (inflow) of a pairing,
 * purely from fields transactionListSelect already exposes — pairedWithId and the sign of the
 * row's own amount. Safe with zero DAL change: assertOutflowAnchorAmount/assertInflowRefundAmount
 * (lib/services/reimbursement-invariant.ts) already guarantee, at write time, that every
 * reimbursement anchor is negative and every linked refund/counterpart is positive — for BOTH
 * amortization-sale realization and v2.8 reimbursements, which flow through the same
 * createPairTx path (D-N1). There is no separate branch to add here.
 */
function resolvePairRole(transaction: TransactionListRow): 'anchor' | 'counterpart' | null {
  if (transaction.pairedWithId === null) {
    return null
  }
  return toDecimal(transaction.amount).isNegative() ? 'anchor' : 'counterpart'
}

function transactionRowLabel(transaction: TransactionListRow) {
  const raw =
    transaction.customTitle?.trim() ||
    transaction.groupTitle?.trim() ||
    transaction.expenseTitle?.trim() ||
    transaction.description
  return raw.length > 80 ? `${raw.slice(0, 77)}…` : raw
}

export function TransactionTable({
  transactions,
  route,
  searchParams,
  categories,
  mostUsed,
  tags,
  tagsByTransactionId,
}: Props) {
  const [loadedTransactions, setLoadedTransactions] = useState(transactions)
  const [hasMore, setHasMore] = useState(transactions.length === PAGE_SIZE)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const isLoadingMoreRef = useRef(false)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkCategorizeOpen, setBulkCategorizeOpen] = useState(false)
  const [bulkAssignTagsOpen, setBulkAssignTagsOpen] = useState(false)
  const [tagsByTx, setTagsByTx] = useState(tagsByTransactionId)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  const [categorizeTarget, setCategorizeTarget] = useState<{ id: string; title: string } | null>(null)
  // Pair target: set when "Collega rimborso" is selected (D-09, PAIR-01).
  // `description` is carried alongside id/amount/occurredAt (CR-03) so a
  // successful pairing can optimistically set the *counterpart's* pairing fields
  // (pairedDescription) on this row without waiting for a reload.
  const [pairTarget, setPairTarget] = useState<{
    id: string
    amount: string
    description: string
    occurredAt: Date
  } | null>(null)
  const [detachTarget, setDetachTarget] = useState<{
    transactionId: string
    defaultTitle: string
  } | null>(null)
  // Amortization row-action target (Phase 77, D-01 tracer). Eligibility (D-04..D-07 +
  // outflow-only) is server-gated inside createAmortizationPlan; this entry point's own gate is
  // widened in the eligibility-guards task to reflect the row's own guard fields.
  const [amortizeTarget, setAmortizeTarget] = useState<{
    transactionId: string
    amount: string
    occurredAt: Date
  } | null>(null)
  // Undo (D-09) row-action target: set when "Rimuovi ammortamento" is selected.
  const [removeAmortizeTarget, setRemoveAmortizeTarget] = useState<{
    planId: string
    transactionId: string
  } | null>(null)
  // Close (D-01, Phase 78) row-action target: set when "Chiudi ammortamento" is selected.
  const [closeAmortizeTarget, setCloseAmortizeTarget] = useState<{
    planId: string
    transactionId: string
  } | null>(null)

  const router = useRouter()
  const { activeSort, activeDir, onSort, isRestoring } = useToolbarSort(route)

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
   * On success, clears pairedWithId/pairedNetAmount/pairedDescription/pairedOccurredAt/
   * reimbursementId on BOTH legs of the pair in the local list so the badge disappears
   * immediately without waiting for a server re-render (optimistic UI, PAIR-03 D-11).
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
            ? {
                ...t,
                pairedWithId: null,
                pairedNetAmount: null,
                pairedDescription: null,
                pairedOccurredAt: null,
                reimbursementId: null,
              }
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

  /**
   * Optimistically reflects the activation's forced detach (D-03) in the local list: the
   * transaction now points at a new Standalone Expense, same shape as markExpenseDetached.
   */
  function markTransactionAmortized(transactionId: string, newExpense: { id: string }) {
    setLoadedTransactions((prev) =>
      prev.map((t) =>
        t.id === transactionId
          ? {
              ...t,
              expenseId: newExpense.id,
              expenseStatus: '1' as const,
              expenseCategoryName: null,
              expenseSubCategoryName: null,
              expenseTransactionCount: 1,
            }
          : t,
      ),
    )
  }

  /**
   * Optimistically clears the row's amortization gate (D-09 undo) so the menu flips back to
   * "Ammortizza" immediately. The re-attached expense's title/category/status are refreshed via
   * router.refresh() (called alongside this) rather than guessed locally — removeAmortizationPlan
   * intentionally returns no expense payload, since the target may be a brand-new OR an existing
   * shared Expense.
   */
  function markAmortizationRemoved(transactionId: string) {
    setLoadedTransactions((prev) =>
      prev.map((t) => (t.id === transactionId ? { ...t, amortizationPlanId: null } : t)),
    )
  }

  /**
   * Optimistically flips the row's amortization plan status to 'closed' (D-01) so the "Chiudi
   * ammortamento" entry disappears immediately without waiting for a reload; "Rimuovi
   * ammortamento" stays available unchanged (gated only on amortizationPlanId, not status).
   */
  function markAmortizationClosed(transactionId: string) {
    setLoadedTransactions((prev) =>
      prev.map((t) => (t.id === transactionId ? { ...t, amortizationPlanStatus: 'closed' } : t)),
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

  // Gate both the unfiltered rows and the empty state while a saved filter
  // set is being restored into the URL — either would be a wrong flash.
  if (isRestoring) {
    return <TableRestoreSkeleton />
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
              className="w-28 text-xs font-normal uppercase tracking-wide text-muted-foreground"
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
            const amortizationEligibility = hasExpense
              ? computeAmortizationEligibility(transaction)
              : null

            // categoryType is a direction code from the nature→direction join (Plan 03)
            const isTransfer = transaction.categoryType === 'transfer'

            // Keep transfer rows neutral regardless of sign; all other rows follow sign.
            const amountColorClass = amountToneClass(transaction.amount, transaction.categoryType)
            const pairRole = resolvePairRole(transaction)

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
                  <div className="flex min-w-0 flex-col gap-1">
                    {/* Title + inline indicators on ONE line: the title owns the flexible space
                        and truncates ("…"); the tags chip and the reimbursement indicator are
                        shrink-0 so they stay visible right after the ellipsis. */}
                    <div className="flex min-w-0 items-center gap-1.5">
                      <div className="min-w-0 flex-1">
                        <TransactionTitleEdit
                          id={transaction.id}
                          description={transaction.description}
                          customTitle={transaction.customTitle}
                          fallbackTitle={transaction.groupTitle ?? transaction.expenseTitle}
                          onSuccess={(newTitle) => updateTransactionTitle(transaction.id, newTitle)}
                        />
                      </div>
                      <TransactionTagsChip tags={tagsByTx[transaction.id] ?? []} />
                      {/* Reimbursement indicator — links to /reimbursements/[id] (D-06, Phase 76
                          Plan 03). `reimbursementId` is non-null iff the row belongs to a
                          reimbursement (as anchor or refund), resolved via
                          pairedReimbursementIdExpr(); the full net/residual/refund breakdown
                          lives on that dedicated page. */}
                      {transaction.reimbursementId != null && (
                        <ReimbursementRowIndicator reimbursementId={transaction.reimbursementId} />
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {pairRole === 'anchor' && transaction.pairedNetAmount ? (
                    <div className="flex flex-col items-end leading-tight">
                      <span className={amountToneClass(transaction.pairedNetAmount, transaction.categoryType)}>
                        {formatAmount(transaction.pairedNetAmount, transaction.currency)}
                      </span>
                      <span className="text-xs text-muted-foreground line-through opacity-60">
                        {formatAmount(transaction.amount, transaction.currency)}
                      </span>
                    </div>
                  ) : (
                    <span className={amountColorClass}>
                      {formatAmount(transaction.amount, transaction.currency)}
                    </span>
                  )}
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
                        href={importFileDetailHref(transaction.fileId)}
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
                      <DropdownMenuItem asChild>
                        <Link href={transactionDetailHref(transaction.id)}>Dettagli</Link>
                      </DropdownMenuItem>
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
                              description: transaction.description,
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
                      {/* Amortization row action (Phase 77, D-01/D-04..D-08). Entry shown only
                          when an expense is linked (mirrors "Spesa a sé"'s own gate); within
                          that, eligibility is derived synchronously from row fields already
                          loaded (no loading flash, D-08) — ineligible renders disabled with a
                          Tooltip carrying the one specific guard reason. The server action
                          independently re-checks every guard before any write. */}
                      {amortizationEligibility &&
                        (amortizationEligibility.eligible ? (
                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault()
                              setAmortizeTarget({
                                transactionId: transaction.id,
                                amount: transaction.amount,
                                occurredAt: transaction.occurredAt,
                              })
                              setOpenDropdownId(null)
                            }}
                            className="flex items-center gap-2"
                          >
                            <CalendarClock className="h-4 w-4" />
                            Ammortizza
                          </DropdownMenuItem>
                        ) : (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="block">
                                  <DropdownMenuItem
                                    disabled
                                    onSelect={(e) => e.preventDefault()}
                                    className="flex items-center gap-2"
                                  >
                                    <CalendarClock className="h-4 w-4" />
                                    Ammortizza
                                  </DropdownMenuItem>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {amortizationGuardMessage(amortizationEligibility)}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ))}
                      {/* Close entry (D-01, Phase 78, AMORT-04): shown only while the plan is
                          still open — a closed plan has nothing left to collapse. */}
                      {transaction.amortizationPlanId != null &&
                        transaction.amortizationPlanStatus === 'open' && (
                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault()
                              setCloseAmortizeTarget({
                                planId: transaction.amortizationPlanId!,
                                transactionId: transaction.id,
                              })
                              setOpenDropdownId(null)
                            }}
                            className="flex items-center gap-2"
                          >
                            <CalendarClock className="h-4 w-4" />
                            Chiudi ammortamento
                          </DropdownMenuItem>
                        )}
                      {/* Undo entry (D-09, Entry Point Visibility Matrix: "Active plan exists" ->
                          Undo shown). Shown only when an active plan exists on this transaction. */}
                      {transaction.amortizationPlanId != null && (
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault()
                            setRemoveAmortizeTarget({
                              planId: transaction.amortizationPlanId!,
                              transactionId: transaction.id,
                            })
                            setOpenDropdownId(null)
                          }}
                          className="flex items-center gap-2 text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          Rimuovi ammortamento
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
      onBulkAssignTags={() => setBulkAssignTagsOpen(true)}
      onBulkDelete={() => setBulkDeleteOpen(true)}
    />

    <BulkAssignTagsDialog
      open={bulkAssignTagsOpen}
      onOpenChange={setBulkAssignTagsOpen}
      transactionIds={selectedIds}
      tags={tags}
      onSuccess={({ mode, tagIds }) => {
        setTagsByTx((prev) => {
          const next = { ...prev }
          for (const txId of selectedIds) {
            const current = next[txId] ?? []
            if (mode === 'assign') {
              const toAdd = tagIds
                .filter((id) => !current.some((c) => c.tagId === id))
                .map((id) => ({
                  tagId: id,
                  tagName: tags.find((t) => t.id === id)?.name ?? '',
                  archived: tags.find((t) => t.id === id)?.archived ?? false,
                }))
              next[txId] = [...current, ...toAdd]
            } else {
              next[txId] = current.filter((c) => !tagIds.includes(c.tagId))
            }
          }
          return next
        })
        setSelectedIds([])
      }}
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
      onPaired={({ secondaryTransactionId, subCategoryId, counterpart }) => {
        // Repaint the refund (secondary) row as categorized when the server
        // inherited the spend's subcategory (decision 2). When subCategoryId is
        // undefined the refund was left untouched — nothing to repaint.
        if (subCategoryId !== undefined) {
          markExpenseCategorized(secondaryTransactionId, String(subCategoryId))
        }

        // CR-03: mirror handleUnpair's optimistic-update pattern for pair *creation* —
        // set the pairing fields on BOTH legs of the new pair in local state so the
        // TransactionPairPopover badge appears immediately, without a manual reload.
        // `counterpart` is the selected counterpart's own data (its id may or may not
        // be `secondaryTransactionId` — the server independently resolves which leg
        // is "primary"/"secondary" by amount — but the pairing fields are symmetric
        // regardless of that designation).
        if (pairTarget && counterpart) {
          const netAmount = toDecimal(pairTarget.amount).plus(counterpart.amount).toString()
          const primaryId = pairTarget.id

          setLoadedTransactions((prev) =>
            prev.map((t) => {
              if (t.id === primaryId) {
                return {
                  ...t,
                  pairedWithId: counterpart.id,
                  pairedNetAmount: netAmount,
                  pairedAmount: counterpart.amount,
                  pairedDescription: counterpart.description,
                  pairedOccurredAt: counterpart.occurredAt,
                }
              }
              if (t.id === counterpart.id) {
                return {
                  ...t,
                  pairedWithId: primaryId,
                  pairedNetAmount: netAmount,
                  pairedAmount: pairTarget.amount,
                  pairedDescription: pairTarget.description,
                  pairedOccurredAt: pairTarget.occurredAt,
                }
              }
              return t
            }),
          )
        }
      }}
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

    {amortizeTarget && (
      <ActivateAmortizationDialog
        open={Boolean(amortizeTarget)}
        onOpenChange={(open) => { if (!open) setAmortizeTarget(null) }}
        transactionId={amortizeTarget.transactionId}
        amount={amortizeTarget.amount}
        occurredAt={amortizeTarget.occurredAt}
        onSuccess={({ expenseId }) => {
          markTransactionAmortized(amortizeTarget.transactionId, { id: expenseId })
          setAmortizeTarget(null)
        }}
      />
    )}

    {removeAmortizeTarget && (
      <RemoveAmortizationDialog
        open={Boolean(removeAmortizeTarget)}
        onOpenChange={(open) => { if (!open) setRemoveAmortizeTarget(null) }}
        planId={removeAmortizeTarget.planId}
        onSuccess={() => {
          markAmortizationRemoved(removeAmortizeTarget.transactionId)
          setRemoveAmortizeTarget(null)
          router.refresh()
        }}
      />
    )}

    {closeAmortizeTarget && (
      <CloseAmortizationDialog
        open={Boolean(closeAmortizeTarget)}
        onOpenChange={(open) => { if (!open) setCloseAmortizeTarget(null) }}
        planId={closeAmortizeTarget.planId}
        onSuccess={() => {
          markAmortizationClosed(closeAmortizeTarget.transactionId)
          setCloseAmortizeTarget(null)
          router.refresh()
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
