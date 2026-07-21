'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MoreHorizontal } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { SubcategoryPicker } from '@/components/categorization/subcategory-picker'
import { DetailPageShell } from '@/components/detail-pages/detail-page-shell'
import { GroupTitleEdit } from '@/components/expenses/group-title-edit'
import { RemoveGroupMemberButton } from '@/components/expenses/remove-group-member-button'
import { categorizeExpenseGroup, dissolveExpenseGroupAction } from '@/lib/actions/expenses'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import type { ExpenseGroupDetailRow } from '@/lib/dal/expenses'
import type { MostUsedSubcategory } from '@/lib/dal/subcategory-usage'
import { APP_ROUTES, expenseDetailHref, transactionDetailHref } from '@/lib/routes'
import { amountToneClass } from '@/lib/utils/amount-tone'
import { toDecimal } from '@/lib/utils/decimal'
import { cn } from '@/lib/utils'

type Props = {
  group: ExpenseGroupDetailRow
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

function formatPeriodo(first: Date | null, last: Date | null): string {
  if (!first) return '—'
  if (!last || last.getTime() === first.getTime()) return formatDate(first)
  return `${formatDate(first)} – ${formatDate(last)}`
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
  try {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency,
    }).format(Number(toDecimal(amount)))
  } catch {
    return amount
  }
}

export function GroupDetailClient({ group, categories, mostUsed }: Props) {
  const router = useRouter()
  const [categorizeOpen, setCategorizeOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [dissolveDialogOpen, setDissolveDialogOpen] = useState(false)
  const [dissolvePending, setDissolvePending] = useState(false)

  const amountClass = amountToneClass(group.totalAmount, group.categoryType)
  const previewTransactions = group.transactions.slice(0, LINKED_TRANSACTIONS_PREVIEW_LIMIT)
  const hiddenTransactionsCount = Math.max(
    0,
    group.transactions.length - LINKED_TRANSACTIONS_PREVIEW_LIMIT,
  )
  // ExpenseGroupDetailRow has no firstTransactionAt/lastTransactionAt of its
  // own — derive the period from the member transactions' occurredAt dates
  // (do not rely on the array's DESC sort order; compute min/max explicitly).
  const [firstTransactionAt, lastTransactionAt] = group.transactions.reduce<
    [Date | null, Date | null]
  >(
    ([min, max], tx) => [
      !min || tx.occurredAt < min ? tx.occurredAt : min,
      !max || tx.occurredAt > max ? tx.occurredAt : max,
    ],
    [null, null],
  )

  function handleCategorizeChange(subCategoryId: string) {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('groupId', String(group.id))
      fd.set('subCategoryId', subCategoryId)
      const result = await categorizeExpenseGroup({ error: null }, fd)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Gruppo categorizzato.')
      setCategorizeOpen(false)
      router.refresh()
    })
  }

  async function handleDissolve() {
    setDissolvePending(true)
    const fd = new FormData()
    fd.set('groupId', String(group.id))
    const result = await dissolveExpenseGroupAction({ error: null }, fd)
    setDissolvePending(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Gruppo sciolto.')
    router.push(APP_ROUTES.expenses)
  }

  const dissolveControl = (
    <Dialog open={dissolveDialogOpen} onOpenChange={setDissolveDialogOpen}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label="Azioni gruppo">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={(e) => {
              e.preventDefault()
              setDissolveDialogOpen(true)
            }}
          >
            Scomponi gruppo
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sciogliere il gruppo?</DialogTitle>
          <DialogDescription>
            Il gruppo verrà sciolto e le spese torneranno indipendenti, mantenendo la categoria
            attuale.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Annulla</Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleDissolve} disabled={dissolvePending}>
            Scomponi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  const categoriaSection = (
    <div className="mt-2 flex flex-col gap-1 rounded-md border bg-muted/30 p-4">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Categoria
      </span>
      {group.subCategoryName ? (
        <div className="flex flex-col gap-1">
          <span className="text-base font-semibold">{group.subCategoryName}</span>
          {group.categoryName ? (
            <span className="text-sm text-muted-foreground">{group.categoryName}</span>
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
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2 w-fit"
        aria-label="Cambia categoria"
        onClick={() => setCategorizeOpen(true)}
      >
        Cambia categoria
      </Button>
      <SubcategoryPicker
        open={categorizeOpen}
        onOpenChange={setCategorizeOpen}
        categories={categories}
        mostUsed={mostUsed}
        allowedCategoryTypes={['in', 'out', 'transfer', 'allocation']}
        defaultType={null}
        onChange={handleCategorizeChange}
        pending={isPending}
      />
    </div>
  )

  const datiCard = (
    <div className="flex flex-col gap-4">
      <div className="group flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Titolo
        </span>
        <GroupTitleEdit groupId={group.id} title={group.title} onSuccess={() => router.refresh()} />
      </div>
      {categoriaSection}
    </div>
  )

  const collegamentiCard = (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Membri
      </span>
      {group.members.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nessuna spesa collegata.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {group.members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm hover:bg-muted/50"
            >
              <Link href={expenseDetailHref(member.id)} className="min-w-0 flex-1 truncate">
                {member.title}
              </Link>
              <span className="shrink-0 font-mono tabular-nums">
                {formatSignedAmount(member.totalAmount)}
              </span>
              <RemoveGroupMemberButton
                groupId={group.id}
                expenseId={member.id}
                expenseTitle={member.title}
                onSuccess={(autoDissolved) => {
                  // WR-01: an auto-dissolved group no longer exists — redirect
                  // instead of router.refresh(), which would re-run this RSC
                  // page, get undefined from getExpenseGroupForDetail, and hit
                  // notFound() right after the success toast. Mirrors
                  // handleDissolve's redirect for the equivalent terminal state.
                  if (autoDissolved) {
                    router.push(APP_ROUTES.expenses)
                    return
                  }
                  router.refresh()
                }}
              />
            </div>
          ))}
        </div>
      )}
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
          {formatSignedAmount(group.totalAmount)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">Transazioni</span>
        <span className="text-sm">{group.transactionCount}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">Creato il</span>
        <span className="text-sm">{formatDate(group.createdAt)}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">Periodo</span>
        <span className="text-sm">{formatPeriodo(firstTransactionAt, lastTransactionAt)}</span>
      </div>
    </div>
  )

  const transactionsCard = (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Transazioni
      </span>
      {group.transactions.length === 0 ? (
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
          Mostrate {LINKED_TRANSACTIONS_PREVIEW_LIMIT} di {group.transactions.length} transazioni
          collegate.
        </p>
      ) : null}
    </div>
  )

  return (
    <DetailPageShell
      backHref={APP_ROUTES.expenses}
      title={group.title}
      amount={formatSignedAmount(group.totalAmount)}
      amountInline
      amountToneClassName={amountClass}
      overflowMenu={dissolveControl}
      layout="two-column"
      datiCard={datiCard}
      collegamentiCard={collegamentiCard}
      riepilogoCard={riepilogoCard}
      transactionsCard={transactionsCard}
      bottomCardsSideBySide
    />
  )
}
