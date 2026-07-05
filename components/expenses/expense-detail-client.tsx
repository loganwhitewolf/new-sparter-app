'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ExternalLink, MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SubcategoryPicker } from '@/components/categorization/subcategory-picker'
import { DetailPageShell } from '@/components/detail-pages/detail-page-shell'
import { ExpenseTitleEdit } from '@/components/expenses/expense-title-edit'
import { ExpenseNotesEdit } from '@/components/expenses/expense-notes-edit'
import { categorizeExpense, deleteExpense } from '@/lib/actions/expenses'
import type { ExpenseDetailRow } from '@/lib/dal/expenses'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import type { MostUsedSubcategory } from '@/lib/dal/subcategory-usage'
import { APP_ROUTES, transactionDetailHref } from '@/lib/routes'
import { toDecimal } from '@/lib/utils/decimal'
import { cn } from '@/lib/utils'

type Props = {
  expense: ExpenseDetailRow
  categories: CategoryWithSubCategories[]
  mostUsed: MostUsedSubcategory[]
}

const dateFormatter = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function formatDate(date: Date): string {
  return dateFormatter.format(new Date(date))
}

function formatSignedAmount(amount: string, currency = 'EUR'): string {
  try {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: currency || 'EUR',
    }).format(Number(toDecimal(amount)))
  } catch {
    return amount
  }
}

function formatTransactionAmount(amount: string, currency: string): string {
  const num = parseFloat(amount)
  if (!Number.isFinite(num)) return amount
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency,
  }).format(num)
}

export function ExpenseDetailClient({ expense, categories, mostUsed }: Props) {
  const router = useRouter()
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteLinkedTransactions, setDeleteLinkedTransactions] = useState(false)
  const [deletePending, setDeletePending] = useState(false)
  const [categoryPending, setCategoryPending] = useState(false)

  const isNegative = expense.totalAmount.trim().startsWith('-')

  function handleCategoryChange(subCategoryId: string) {
    const fd = new FormData()
    fd.set('id', expense.id)
    fd.set('subCategoryId', subCategoryId)

    setCategoryPending(true)
    categorizeExpense({ error: null }, fd).then((result) => {
      setCategoryPending(false)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Spesa categorizzata.')
        setCategoryPickerOpen(false)
        router.refresh()
      }
    })
  }

  async function handleDelete() {
    setDeletePending(true)
    const fd = new FormData()
    fd.set('id', expense.id)
    fd.set('deleteLinkedTransactions', deleteLinkedTransactions ? 'true' : 'false')
    const result = await deleteExpense({ error: null }, fd)
    setDeletePending(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Spesa eliminata.')
      router.push(APP_ROUTES.expenses)
    }
  }

  const searchQuery = expense.title
  const searchHref = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`

  const datiCard = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Titolo
        </span>
        <ExpenseTitleEdit id={expense.id} title={expense.title} onSuccess={() => router.refresh()} />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Note
        </span>
        <ExpenseNotesEdit
          id={expense.id}
          title={expense.title}
          notes={expense.notes}
          onSuccess={() => router.refresh()}
        />
      </div>
    </div>
  )

  const categoriaCard = (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Categoria
      </span>
      {expense.subCategoryName ? (
        <button
          type="button"
          className="w-fit text-left"
          onClick={() => setCategoryPickerOpen(true)}
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{expense.subCategoryName}</span>
            {expense.categoryName ? (
              <span className="text-xs text-muted-foreground">{expense.categoryName}</span>
            ) : null}
          </div>
        </button>
      ) : (
        <button type="button" className="w-fit" onClick={() => setCategoryPickerOpen(true)}>
          <Badge
            variant="outline"
            className="border-0 bg-amber-100 text-amber-700 cursor-pointer hover:bg-amber-200 transition-colors"
          >
            Categorizza
          </Badge>
        </button>
      )}
    </div>
  )

  const collegamentiCard = (
    <div className="flex flex-col gap-4">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Collegamenti
      </span>
      {expense.sourceFile ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">File di origine</span>
          <Link
            href={`${APP_ROUTES.import}?fileId=${encodeURIComponent(expense.sourceFile.id)}`}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            {expense.sourceFile.name}
          </Link>
        </div>
      ) : null}
      {expense.platformName ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">Piattaforma</span>
          <span className="text-sm">{expense.platformName}</span>
        </div>
      ) : null}
    </div>
  )

  const riepilogoCard = (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Riepilogo
      </span>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">Totale</span>
        <span
          className={cn(
            'font-mono text-sm font-medium tabular-nums',
            isNegative ? 'text-total-out' : 'text-total-in',
          )}
        >
          {formatSignedAmount(expense.totalAmount)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">Transazioni</span>
        <span className="text-sm">{expense.transactionCount}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">Creata il</span>
        <span className="text-sm">{formatDate(expense.createdAt)}</span>
      </div>
    </div>
  )

  const transactionsCard = (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Transazioni
      </span>
      {expense.transactions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nessuna transazione collegata.</p>
      ) : (
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/70">
                <TableHead className="w-10 text-xs uppercase tracking-wide text-muted-foreground font-normal">
                  #
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wide text-muted-foreground font-normal">
                  Descrizione
                </TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground font-normal">
                  Importo
                </TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground font-normal">
                  Data
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expense.transactions.map((tx, index) => (
                <TableRow key={tx.id}>
                  <TableCell className="text-sm text-muted-foreground align-top">
                    {index + 1}
                  </TableCell>
                  <TableCell className="text-sm whitespace-normal break-words align-top">
                    <Link
                      href={transactionDetailHref(tx.id)}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {tx.customTitle ?? tx.description}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-sm whitespace-nowrap align-top">
                    {formatTransactionAmount(tx.amount, tx.currency)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-sm whitespace-nowrap align-top">
                    {formatDate(tx.occurredAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )

  return (
    <>
      <DetailPageShell
        backHref={APP_ROUTES.expenses}
        title={expense.title}
        amount={
          <span className={cn('font-mono', isNegative ? 'text-total-out' : 'text-total-in')}>
            {formatSignedAmount(expense.totalAmount)}
          </span>
        }
        primaryAction={
          <Button variant="outline" size="sm" asChild>
            <a href={searchHref} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Cerca su internet
            </a>
          </Button>
        }
        overflowMenu={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Altre azioni">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  setDeleteOpen(true)
                }}
                className="text-destructive focus:text-destructive"
              >
                Elimina
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
        datiCard={datiCard}
        categoriaCard={categoriaCard}
        collegamentiCard={collegamentiCard}
        riepilogoCard={riepilogoCard}
        transactionsCard={transactionsCard}
      />

      <SubcategoryPicker
        open={categoryPickerOpen}
        onOpenChange={setCategoryPickerOpen}
        categories={categories}
        mostUsed={mostUsed}
        allowedCategoryTypes={['in', 'out', 'transfer', 'allocation']}
        defaultType={null}
        onChange={handleCategoryChange}
        pending={categoryPending}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina spesa</DialogTitle>
            <DialogDescription className="sr-only">
              Conferma l&apos;eliminazione della spesa selezionata e, opzionalmente, delle
              transazioni collegate.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Sei sicuro di voler eliminare &ldquo;{expense.title}&rdquo;? Questa azione non può
            essere annullata.
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
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deletePending}
            >
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
