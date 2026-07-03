'use client'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { formatAbsoluteAmount } from '@/lib/utils/format-amount'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { useToolbarSort } from '@/components/data-table/DataTableToolbar'
import { HeaderSortButton } from '@/components/data-table/HeaderSortButton'
import { deleteExpense, ignoreExpense, loadMoreExpenses } from '@/lib/actions/expenses'
import { BulkActionBar } from './bulk-action-bar'
import { BulkCategorizeDialog } from './bulk-categorize-dialog'
import { BulkDeleteExpensesDialog } from './bulk-delete-expenses-dialog'
import { ExpenseCategorizeDialog } from './expense-categorize-dialog'
import { ExpenseFormDialog } from './expense-form-dialog'
import { ExpenseTitleEdit } from './expense-title-edit'
import { ExpenseTransactionsDialog } from './expense-transactions-dialog'
import type { ExpenseFilters, ExpenseRow } from '@/lib/dal/expenses'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import type { MostUsedSubcategory } from '@/lib/dal/subcategory-usage'
import { cn } from '@/lib/utils'

type Props = {
  expenses: ExpenseRow[]
  route: string
  categories: CategoryWithSubCategories[]
  mostUsed: MostUsedSubcategory[]
  filters: ExpenseFilters
}

const PAGE_SIZE = 50

function dedupeExpenseRows(rows: ExpenseRow[]): ExpenseRow[] {
  const seen = new Set<string>()
  const unique: ExpenseRow[] = []
  for (const row of rows) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    unique.push(row)
  }
  return unique
}

export function ExpenseTable({ expenses, route, categories, mostUsed, filters }: Props) {
  const [loadedExpenses, setLoadedExpenses] = useState(() => dedupeExpenseRows(expenses))
  const [hasMore, setHasMore] = useState(expenses.length === PAGE_SIZE)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const isLoadingMoreRef = useRef(false)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  const [categorizeDialogExpense, setCategorizeDialogExpense] = useState<{
    id: string
    title: string
  } | null>(null)
  const [transactionsDialogExpense, setTransactionsDialogExpense] = useState<{
    id: string
    title: string
  } | null>(null)

  const { activeSort, activeDir, onSort } = useToolbarSort(route)

  const allSelected = loadedExpenses.length > 0 && selectedIds.length === loadedExpenses.length
  const someSelected = selectedIds.length > 0 && selectedIds.length < loadedExpenses.length

  const loadNextPage = useCallback(async () => {
    if (isLoadingMoreRef.current || !hasMore) {
      return
    }

    isLoadingMoreRef.current = true
    setIsLoadingMore(true)
    setLoadError(null)

    try {
      const result = await loadMoreExpenses({
        filters,
        offset: loadedExpenses.length,
      })

      if (result.error) {
        setLoadError(result.error)
        toast.error(result.error)
        return
      }

      setLoadedExpenses((current) =>
        dedupeExpenseRows([...current, ...result.expenses]),
      )
      setHasMore(result.hasMore)
    } catch {
      const error = 'Non è stato possibile caricare altre spese. Riprova.'
      setLoadError(error)
      toast.error(error)
    } finally {
      isLoadingMoreRef.current = false
      setIsLoadingMore(false)
    }
  }, [filters, hasMore, loadedExpenses.length])

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
    setSelectedIds(allSelected ? [] : loadedExpenses.map((e) => e.id))
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function formatDate(date: Date): string {
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(date))
  }

  // Display-only; never use for values written back to the DB.
  function formatAmount(amount: string): string {
    return formatAbsoluteAmount(amount)
  }

  if (loadedExpenses.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
          <p className="text-base font-medium text-foreground">Nessuna spesa trovata</p>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Non hai ancora aggiunto spese. Clicca su &ldquo;Nuova spesa&rdquo; per iniziare.
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
            Elenco spese con categoria, stato, totale e data.
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
                  aria-label="Seleziona tutte le spese"
                />
              </TableHead>
              <HeaderSortButton
                column={{ key: 'title', label: 'Spese' }}
                activeSort={activeSort}
                activeDir={activeDir}
                onSort={onSort}
                className="text-xs uppercase tracking-wide text-muted-foreground font-normal"
              />
              <HeaderSortButton
                column={{ key: 'totalAmount', label: 'Totale' }}
                activeSort={activeSort}
                activeDir={activeDir}
                align="right"
                onSort={onSort}
                className="w-32 text-xs uppercase tracking-wide text-muted-foreground font-normal"
              />
              <HeaderSortButton
                column={{ key: 'createdAt', label: 'Data' }}
                activeSort={activeSort}
                activeDir={activeDir}
                align="right"
                onSort={onSort}
                className="w-24 text-xs uppercase tracking-wide text-muted-foreground font-normal"
              />
              <TableHead className="w-36 text-xs uppercase tracking-wide text-muted-foreground font-normal">
                Piattaforma
              </TableHead>
              <HeaderSortButton
                column={{ key: 'category', label: 'Categoria' }}
                activeSort={activeSort}
                activeDir={activeDir}
                onSort={onSort}
                className="w-44 text-xs uppercase tracking-wide text-muted-foreground font-normal"
              />
              <TableHead className="w-36 text-center text-xs uppercase tracking-wide text-muted-foreground font-normal">
                Stato
              </TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadedExpenses.map((exp) => {
              const isSelected = selectedIds.includes(exp.id)
              const isCategorized = exp.status === '2' || exp.status === '3'
              const isIgnored = exp.status === '4'

              return (
                <TableRow
                  key={exp.id}
                  className={cn(
                    'group hover:bg-muted/50',
                    isSelected && 'bg-primary/5'
                  )}
                >
                  <TableCell className="w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRow(exp.id)}
                      className="h-4 w-4 cursor-pointer"
                      aria-label={`Seleziona ${exp.title}`}
                    />
                  </TableCell>
                  <TableCell className="max-w-0 w-full">
                    <ExpenseTitleEdit
                      id={exp.id}
                      title={exp.title}
                      onSuccess={(updatedTitle) => {
                        setLoadedExpenses((prev) =>
                          prev.map((e) =>
                            e.id === exp.id ? { ...e, title: updatedTitle } : e
                          )
                        )
                      }}
                    />
                  </TableCell>
                  <TableCell className={cn('text-right font-mono tabular-nums text-sm', exp.totalAmount.trim().startsWith('-') ? 'text-total-out' : 'text-total-in')}>
                    {formatAmount(exp.totalAmount)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-sm">
                    {formatDate(exp.createdAt)}
                  </TableCell>
                  <TableCell className="truncate text-sm">{exp.platformName ?? '—'}</TableCell>
                  <TableCell>
                    {exp.subCategoryName ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm">{exp.subCategoryName}</span>
                        {exp.categoryName && (
                          <span className="text-xs text-muted-foreground">{exp.categoryName}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {!isCategorized && !isIgnored ? (
                      <button
                        type="button"
                        className="inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border-0 bg-amber-100 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-amber-700 transition-[color,box-shadow] hover:bg-amber-200 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        onClick={() =>
                          setCategorizeDialogExpense({ id: exp.id, title: exp.title })
                        }
                        aria-label={`Categorizza ${exp.title}`}
                        title="Categorizza questa spesa"
                      >
                        Da categorizzare
                      </button>
                    ) : (
                      <Badge
                        variant="outline"
                        className={cn(
                          'border-0',
                          isCategorized
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {isCategorized ? 'Categorizzata' : 'Ignorata'}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="w-10 text-center">
                    <DropdownMenu
                      open={openDropdownId === exp.id}
                      onOpenChange={(o) => setOpenDropdownId(o ? exp.id : null)}
                    >
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label={`Azioni per ${exp.title}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => {
                            setTransactionsDialogExpense({ id: exp.id, title: exp.title })
                            setOpenDropdownId(null)
                          }}
                        >
                          Dettagli
                        </DropdownMenuItem>
                        <ExpenseFormDialog
                          categories={categories}
                          mostUsed={mostUsed}
                          mode="edit"
                          expense={exp}
                          onSuccess={(updatedTitle) => {
                            setLoadedExpenses((prev) =>
                              prev.map((e) =>
                                e.id === exp.id ? { ...e, title: updatedTitle } : e
                              )
                            )
                            setOpenDropdownId(null)
                          }}
                          trigger={
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                              Modifica
                            </DropdownMenuItem>
                          }
                        />
                        <IgnoreExpenseMenuItem
                          expense={exp}
                          onIgnored={() => setOpenDropdownId(null)}
                        />
                        <DeleteExpenseMenuItem
                          expense={exp}
                          onDeleted={() => {
                            setSelectedIds((prev) => prev.filter((id) => id !== exp.id))
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
            <p className="text-sm text-muted-foreground">Caricamento altre spese…</p>
          ) : hasMore ? (
            <Button type="button" variant="ghost" size="sm" onClick={loadNextPage}>
              Carica altre 50 spese
            </Button>
          ) : loadedExpenses.length > 0 ? (
            <p className="text-sm text-muted-foreground">Tutte le spese disponibili sono caricate.</p>
          ) : null}
        </div>
        {loadError ? (
          <p className="border-t px-4 py-3 text-center text-sm text-destructive" role="alert">
            {loadError}
          </p>
        ) : null}
      </div>

      <BulkActionBar
        selectedIds={selectedIds}
        onBulkCategorize={() => setBulkDialogOpen(true)}
        onBulkDelete={() => setBulkDeleteOpen(true)}
      />

      <BulkDeleteExpensesDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        selectedIds={selectedIds}
        linkedTransactionCount={loadedExpenses
          .filter((expense) => selectedIds.includes(expense.id))
          .reduce((sum, expense) => sum + expense.transactionCount, 0)}
        onSuccess={() => {
          const idSet = new Set(selectedIds)
          setLoadedExpenses((prev) => prev.filter((e) => !idSet.has(e.id)))
          setSelectedIds([])
          setBulkDeleteOpen(false)
        }}
      />

      <BulkCategorizeDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        selectedIds={selectedIds}
        categories={categories}
        mostUsed={mostUsed}
        onSuccess={() => {
          setSelectedIds([])
          setBulkDialogOpen(false)
        }}
      />

      <ExpenseCategorizeDialog
        open={categorizeDialogExpense !== null}
        onOpenChange={(o) => {
          if (!o) setCategorizeDialogExpense(null)
        }}
        expense={categorizeDialogExpense ?? { id: '', title: '' }}
        categories={categories}
        mostUsed={mostUsed}
        onSuccess={() => setCategorizeDialogExpense(null)}
      />

      <ExpenseTransactionsDialog
        open={transactionsDialogExpense !== null}
        onOpenChange={(o) => {
          if (!o) setTransactionsDialogExpense(null)
        }}
        expense={transactionsDialogExpense ?? { id: '', title: '' }}
      />
    </>
  )
}

function IgnoreExpenseMenuItem({
  expense,
  onIgnored,
}: {
  expense: ExpenseRow
  onIgnored: () => void
}) {
  const [isPending, startTransition] = useTransition()

  function handleIgnore() {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('id', expense.id)
      const result = await ignoreExpense({ error: null }, fd)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Spesa ignorata.')
        onIgnored()
      }
    })
  }

  return (
    <DropdownMenuItem
      onSelect={(e) => {
        e.preventDefault()
        handleIgnore()
      }}
      disabled={isPending}
    >
      {isPending ? 'Attendere…' : 'Ignora'}
    </DropdownMenuItem>
  )
}

function DeleteExpenseMenuItem({
  expense,
  onDeleted,
}: {
  expense: ExpenseRow
  onDeleted: () => void
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [deleteLinkedTransactions, setDeleteLinkedTransactions] = useState(false)

  useEffect(() => {
    if (!open) {
      setDeleteLinkedTransactions(false)
    }
  }, [open])

  async function handleDelete() {
    setPending(true)
    const fd = new FormData()
    fd.set('id', expense.id)
    fd.set('deleteLinkedTransactions', deleteLinkedTransactions ? 'true' : 'false')
    const result = await deleteExpense({ error: null }, fd)
    setPending(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Spesa eliminata.')
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
          <DialogTitle>Elimina spesa</DialogTitle>
          <DialogDescription className="sr-only">
            Conferma l&apos;eliminazione della spesa selezionata e, opzionalmente, delle transazioni
            collegate.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Sei sicuro di voler eliminare &ldquo;{expense.title}&rdquo;? Questa azione non può essere
          annullata.
        </p>
        {expense.transactionCount > 0 ? (
          <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={deleteLinkedTransactions}
              onChange={(event) => setDeleteLinkedTransactions(event.target.checked)}
            />
            <span>
              Elimina anche{' '}
              <strong>
                {expense.transactionCount}{' '}
                {expense.transactionCount === 1 ? 'transazione collegata' : 'transazioni collegate'}
              </strong>
            </span>
          </label>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Annulla</Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleDelete} disabled={pending}>
            Elimina
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
