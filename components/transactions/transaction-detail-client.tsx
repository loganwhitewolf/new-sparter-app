'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ExternalLink, Link2, Lock, Split, Tag, Trash2, Unlink } from 'lucide-react'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { DetailPageShell } from '@/components/detail-pages/detail-page-shell'
import { TransactionAmountEdit } from '@/components/transactions/transaction-amount-edit'
import { TransactionDateEdit } from '@/components/transactions/transaction-date-edit'
import { TransactionTitleEdit } from '@/components/transactions/transaction-title-edit'
import { CounterpartPickerDialog } from '@/components/transactions/counterpart-picker-dialog'
import { DetachExpenseDialog } from '@/components/transactions/detach-expense-dialog'
import { ExpenseCategorizeDialog } from '@/components/expenses/expense-categorize-dialog'
import { deleteTransaction } from '@/lib/actions/transactions'
import { deleteTransactionPairAction } from '@/lib/actions/transaction-pairs'
import type { TransactionDetailRow } from '@/lib/dal/transactions'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import type { MostUsedSubcategory } from '@/lib/dal/subcategory-usage'
import { APP_ROUTES, expenseDetailHref, importFileDetailHref, transactionDetailHref } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { amountToneClass } from '@/lib/utils/amount-tone'
import { toDecimal } from '@/lib/utils/decimal'
import { formatAbsoluteAmount } from '@/lib/utils/format-amount'

type Props = {
  transaction: TransactionDetailRow
  categories: CategoryWithSubCategories[]
  mostUsed: MostUsedSubcategory[]
}

const dateFormatter = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function formatSignedAmount(amount: string, currency: string): string {
  try {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: currency || 'EUR',
    }).format(Number(toDecimal(amount)))
  } catch {
    return amount
  }
}

function formatAbsoluteSigned(amount: string, currency: string): string {
  const d = toDecimal(amount)
  const sign = d.isNegative() ? '-' : '+'
  return `${sign}${formatAbsoluteAmount(amount, currency)}`
}

function formatDate(date: Date): string {
  return dateFormatter.format(new Date(date))
}

export function TransactionDetailClient({ transaction, categories, mostUsed }: Props) {
  const router = useRouter()
  const [pairPickerOpen, setPairPickerOpen] = useState(false)
  const [detachOpen, setDetachOpen] = useState(false)
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteLinkedExpenses, setDeleteLinkedExpenses] = useState(false)
  const [deletePending, setDeletePending] = useState(false)
  const [unpairPending, setUnpairPending] = useState(false)

  const displayTitle =
    transaction.customTitle ?? transaction.expenseTitle ?? transaction.description
  const isOneToOne =
    Boolean(transaction.expenseTitle) && transaction.expenseTransactionCount === 1

  async function handleUnpair() {
    setUnpairPending(true)
    const fd = new FormData()
    fd.set('transactionId', transaction.id)
    const result = await deleteTransactionPairAction({ error: null }, fd)
    setUnpairPending(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Collegamento rimosso.')
      router.refresh()
    }
  }

  async function handleDelete() {
    setDeletePending(true)
    const fd = new FormData()
    fd.set('id', transaction.id)
    fd.set('deleteLinkedExpenses', deleteLinkedExpenses ? 'true' : 'false')
    const result = await deleteTransaction({ error: null }, fd)
    setDeletePending(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Transazione eliminata.')
      router.push(APP_ROUTES.transactions)
    }
  }

  const searchQuery = transaction.customTitle?.trim() || transaction.description
  const searchHref = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`
  const headerAmount = formatSignedAmount(transaction.amount, transaction.currency)
  const headerAmountClass = amountToneClass(transaction.amount, transaction.categoryType)

  const categoriaSection = transaction.expenseId ? (
    <div className="mt-2 flex flex-col gap-3 rounded-md border bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Categoria
        </span>
        <Button type="button" variant="outline" size="sm" onClick={() => setCategoryPickerOpen(true)}>
          <Tag className="h-4 w-4" />
          {transaction.subCategoryName ? 'Cambia categoria' : 'Assegna categoria'}
        </Button>
      </div>
      {transaction.subCategoryName ? (
        <div className="flex flex-col gap-1">
          <span className="text-base font-semibold">{transaction.subCategoryName}</span>
          {transaction.categoryName ? (
            <span className="text-sm text-muted-foreground">{transaction.categoryName}</span>
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
      {transaction.expenseTransactionCount && transaction.expenseTransactionCount > 1 ? (
        <p className="text-xs text-muted-foreground">
          La categoria è assegnata alla spesa aggregata. Modificarla qui modifica la spesa per
          tutte le transazioni collegate.
        </p>
      ) : null}
    </div>
  ) : null

  const datiCard = (
    <div className="flex flex-col gap-4">
      <div className="group flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Titolo
        </span>
        <TransactionTitleEdit
          id={transaction.id}
          description={transaction.description}
          customTitle={transaction.customTitle}
          fallbackTitle={transaction.expenseTitle}
          onSuccess={() => router.refresh()}
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Importo
        </span>
        <TransactionAmountEdit
          id={transaction.id}
          amount={transaction.amount}
          currency={transaction.currency}
          onSuccess={() => router.refresh()}
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Data
        </span>
        <TransactionDateEdit
          id={transaction.id}
          occurredAt={transaction.occurredAt}
          onSuccess={() => router.refresh()}
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Descrizione bancaria
        </span>
        <TooltipProvider>
          <div className="flex items-center gap-2 rounded bg-muted p-3">
            <span className="flex-1 text-sm text-muted-foreground">{transaction.description}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>chiave di riconciliazione bancaria — non modificabile</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
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
        {transaction.pairedWithId ? (
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
            disabled={unpairPending}
            onClick={() => void handleUnpair()}
          >
            <Unlink className="h-4 w-4" />
            Scollega rimborso
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
            onClick={() => setPairPickerOpen(true)}
          >
            <Unlink className="h-4 w-4 rotate-45" />
            Collega rimborso
          </Button>
        )}
        {transaction.expenseId ? (
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
            onClick={() => setDetachOpen(true)}
          >
            <Split className="h-4 w-4" />
            Spesa a sé (non aggregare)
          </Button>
        ) : null}
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
      {transaction.expenseId ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">Spesa collegata</span>
          <Link
            href={expenseDetailHref(transaction.expenseId)}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            {transaction.expenseTitle ?? 'Vedi spesa'}
          </Link>
        </div>
      ) : null}
      {transaction.fileId ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">File di origine</span>
          <Link
            href={importFileDetailHref(transaction.fileId)}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            {transaction.fileName ?? 'Apri importazione'}
          </Link>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">File di origine</span>
          <Badge variant="outline">Manuale</Badge>
        </div>
      )}
      {transaction.pairedWithId &&
      transaction.pairedNetAmount &&
      transaction.pairedAmount &&
      transaction.pairedOccurredAt ? (
        <div className="flex flex-col gap-2 rounded-md border p-3">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-blue-700" />
            <span className="text-sm font-medium">Rimborso collegato</span>
          </div>
          <p className="truncate text-sm text-muted-foreground" title={transaction.pairedDescription ?? ''}>
            {transaction.pairedDescription}
          </p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Importo</span>
            <span className="font-mono tabular-nums">
              {formatAbsoluteSigned(transaction.pairedAmount, transaction.currency)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Data</span>
            <span className="font-mono">{formatDate(transaction.pairedOccurredAt)}</span>
          </div>
          <div className="flex items-center justify-between border-t pt-1 text-sm font-medium">
            <span>Netto</span>
            <span className="font-mono tabular-nums">
              {formatAbsoluteSigned(transaction.pairedNetAmount, transaction.currency)}
            </span>
          </div>
          <Link
            href={transactionDetailHref(transaction.pairedWithId)}
            className="text-xs text-primary underline-offset-4 hover:underline"
          >
            Vai alla transazione collegata
          </Link>
        </div>
      ) : null}
    </div>
  )

  return (
    <>
      <DetailPageShell
        backHref={APP_ROUTES.transactions}
        title={displayTitle}
        amount={headerAmount}
        amountInline
        amountToneClassName={cn(headerAmountClass)}
        layout="two-column"
        datiCard={datiCard}
        collegamentiCard={collegamentiCard}
        azioniCard={azioniCard}
      />

      <CounterpartPickerDialog
        open={pairPickerOpen}
        onOpenChange={setPairPickerOpen}
        transactionId={transaction.id}
        transactionAmount={transaction.amount}
        transactionOccurredAt={transaction.occurredAt}
        onPaired={() => {
          setPairPickerOpen(false)
          router.refresh()
        }}
      />

      {transaction.expenseId ? (
        <DetachExpenseDialog
          open={detachOpen}
          onOpenChange={setDetachOpen}
          transactionId={transaction.id}
          defaultTitle={(transaction.customTitle?.trim() || transaction.description).slice(0, 120)}
          categories={categories}
          mostUsed={mostUsed}
          onSuccess={() => {
            setDetachOpen(false)
            router.refresh()
          }}
        />
      ) : null}

      {transaction.expenseId ? (
        <ExpenseCategorizeDialog
          open={categoryPickerOpen}
          onOpenChange={setCategoryPickerOpen}
          expense={{ id: transaction.expenseId, title: transaction.expenseTitle ?? displayTitle }}
          categories={categories}
          mostUsed={mostUsed}
          onSuccess={() => {
            setCategoryPickerOpen(false)
            router.refresh()
          }}
        />
      ) : null}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina transazione</DialogTitle>
            <DialogDescription className="sr-only">
              Conferma l&apos;eliminazione della transazione e, opzionalmente, della spesa
              collegata in rapporto 1:1.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Sei sicuro di voler eliminare questa transazione
            {displayTitle ? ` (“${displayTitle}”)` : ''}? Le spese aggregate collegate verranno
            aggiornate di conseguenza.
          </p>
          {isOneToOne ? (
            <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={deleteLinkedExpenses}
                onChange={(event) => setDeleteLinkedExpenses(event.target.checked)}
              />
              <span>Elimina anche la spesa collegata &ldquo;{transaction.expenseTitle}&rdquo;</span>
            </label>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Annulla
              </Button>
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
