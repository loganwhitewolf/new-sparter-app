'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ExternalLink, Tag, Trash2 } from 'lucide-react'
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
import { APP_ROUTES, expenseGroupDetailHref, importFileDetailHref, transactionDetailHref } from '@/lib/routes'
import { amountToneClass } from '@/lib/utils/amount-tone'
import { toDecimal } from '@/lib/utils/decimal'
import { cn } from '@/lib/utils'

type Props = {
  expense: ExpenseDetailRow
  categories: CategoryWithSubCategories[]
  mostUsed: MostUsedSubcategory[]
}

const LINKED_TRANSACTIONS_PREVIEW_LIMIT = 8

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

  const amountClass = amountToneClass(expense.totalAmount, expense.categoryType)

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
  const previewTransactions = expense.transactions.slice(0, LINKED_TRANSACTIONS_PREVIEW_LIMIT)
  const hiddenTransactionsCount = Math.max(0, expense.transactions.length - LINKED_TRANSACTIONS_PREVIEW_LIMIT)

  const categoriaSection = (
    <div className="mt-2 flex flex-col gap-3 rounded-md border bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Categoria
        </span>
        {expense.groupId === null ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setCategoryPickerOpen(true)}>
            <Tag className="h-4 w-4" />
            {expense.subCategoryName ? 'Cambia categoria' : 'Assegna categoria'}
          </Button>
        ) : null}
      </div>
      {expense.subCategoryName ? (
        <div className="flex flex-col gap-1">
          <span className="text-base font-semibold">{expense.subCategoryName}</span>
          {expense.categoryName ? (
            <span className="text-sm text-muted-foreground">{expense.categoryName}</span>
          ) : null}
        </div>
      ) : (
        <Badge
          variant="outline"
          className="w-fit border-0 bg-amber-100 text-amber-700 transition-colors"
        >
          Non assegnata
        </Badge>
      )}
    </div>
  )

  const datiCard = (
    <div className="flex flex-col gap-4">
      <div className="group flex flex-col gap-1">
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
      {categoriaSection}
    </div>
  )

  const azioniCard = (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Azioni
      </span>
      <div className="flex flex-col gap-2">
        <Button variant="outline" className="w-full justify-start" asChild>
          <a href={searchHref} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
            Cerca su internet
          </a>
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start text-destructive hover:text-destructive"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="h-4 w-4" />
          Elimina
        </Button>
      </div>
    </div>
  )

  const collegamentiCard = (
    <div className="flex flex-col gap-4">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Collegamenti
      </span>
      {expense.groupId !== null ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">Parte di</span>
          <Link
            href={expenseGroupDetailHref(expense.groupId)}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            {expense.groupTitle}
          </Link>
        </div>
      ) : null}
      {expense.sourceFile ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">File di origine</span>
          <Link
            href={importFileDetailHref(expense.sourceFile.id)}
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
            amountClass,
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
              {previewTransactions.map((tx, index) => (
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
      {hiddenTransactionsCount > 0 ? (
        <p className="text-xs text-muted-foreground">
          Mostrate {LINKED_TRANSACTIONS_PREVIEW_LIMIT} di {expense.transactions.length} transazioni
          collegate.
        </p>
      ) : null}
    </div>
  )

  return (
    <>
      <DetailPageShell
        backHref={APP_ROUTES.expenses}
        title={expense.title}
        amount={formatSignedAmount(expense.totalAmount)}
        amountInline
        amountToneClassName={amountClass}
        layout="two-column"
        datiCard={datiCard}
        collegamentiCard={collegamentiCard}
        azioniCard={azioniCard}
        riepilogoCard={riepilogoCard}
        transactionsCard={transactionsCard}
        bottomCardsSideBySide
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
