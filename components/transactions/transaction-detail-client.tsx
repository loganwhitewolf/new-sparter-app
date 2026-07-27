'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ExternalLink, Lock, Split, Tag, Trash2, X } from 'lucide-react'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { DetailPageShell } from '@/components/detail-pages/detail-page-shell'
import { TransactionAmountEdit } from '@/components/transactions/transaction-amount-edit'
import { TransactionDateEdit } from '@/components/transactions/transaction-date-edit'
import { TransactionTitleEdit } from '@/components/transactions/transaction-title-edit'
import { ReimbursementPanel, RefundMembershipCard } from '@/components/transactions/reimbursement-panel'
import { RefundPickerDialog } from '@/components/transactions/refund-picker-dialog'
import { DetachExpenseDialog } from '@/components/transactions/detach-expense-dialog'
import { ExpenseCategorizeDialog } from '@/components/expenses/expense-categorize-dialog'
import { deleteTransaction } from '@/lib/actions/transactions'
import { addTransactionTagAction, removeTransactionTagAction } from '@/lib/actions/transaction-tags'
import type { ReimbursementPanelData, RefundMembership } from '@/lib/dal/reimbursement'
import type { TransactionDetailRow } from '@/lib/dal/transactions'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import type { MostUsedSubcategory } from '@/lib/dal/subcategory-usage'
import type { TagRow } from '@/lib/dal/tags'
import { APP_ROUTES, expenseDetailHref, expenseGroupDetailHref, importFileDetailHref } from '@/lib/routes'
import { toDecimal } from '@/lib/utils/decimal'

type CurrentTag = { tagId: number; tagName: string; archived: boolean }

type Props = {
  transaction: TransactionDetailRow
  categories: CategoryWithSubCategories[]
  mostUsed: MostUsedSubcategory[]
  currentTags: CurrentTag[]
  allTags: TagRow[]
  /** D-02: the reimbursement panel's read model, resolved server-side (Plan 75-04). Only ever
   * populated for an outflow transaction (ADR 0018 — the anchor is always the outflow). */
  reimbursementPanelData: ReimbursementPanelData | undefined
  /** Fix 1 (Phase 75 Plan 04 gap-closure): populated when THIS transaction is an inflow that is
   * itself a linked refund — the read-only state ReimbursementPanel's CTA/manage-panel never
   * applies to. `undefined` for an outflow, or for an inflow that isn't a refund. */
  refundMembership: RefundMembership | undefined
}

export function TransactionDetailClient({
  transaction,
  categories,
  mostUsed,
  currentTags,
  allTags,
  reimbursementPanelData,
  refundMembership,
}: Props) {
  const router = useRouter()
  const [refundPickerOpen, setRefundPickerOpen] = useState(false)
  const [detachOpen, setDetachOpen] = useState(false)
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteLinkedExpenses, setDeleteLinkedExpenses] = useState(false)
  const [deletePending, setDeletePending] = useState(false)
  const [tags, setTags] = useState<CurrentTag[]>(currentTags)
  const [addTagId, setAddTagId] = useState<string>('')
  const [tagPending, setTagPending] = useState(false)

  const displayTitle =
    transaction.customTitle ??
    transaction.groupTitle ??
    transaction.expenseTitle ??
    transaction.description
  const isOneToOne =
    Boolean(transaction.expenseTitle) && transaction.expenseTransactionCount === 1
  // Fix 1 (Phase 75 Plan 04 gap-closure): ADR 0018 — the anchor is ALWAYS the outflow, an inflow
  // can never be one. Gates which reimbursement UI (if any) renders in collegamentiCard below.
  const isInflow = toDecimal(transaction.amount).isPositive()

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

  async function handleAddTag() {
    if (!addTagId) return
    const found = allTags.find((t) => t.id === Number(addTagId))
    if (!found) return

    setTagPending(true)
    const fd = new FormData()
    fd.set('transactionId', transaction.id)
    fd.set('tagId', addTagId)
    const result = await addTransactionTagAction({ error: null }, fd)
    setTagPending(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      setTags((prev) => [...prev, { tagId: found.id, tagName: found.name, archived: found.archived }])
      setAddTagId('')
      toast.success('Tag aggiunto.')
    }
  }

  async function handleRemoveTag(tagId: number) {
    setTagPending(true)
    const fd = new FormData()
    fd.set('transactionId', transaction.id)
    fd.set('tagId', String(tagId))
    const result = await removeTransactionTagAction({ error: null }, fd)
    setTagPending(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      setTags((prev) => prev.filter((t) => t.tagId !== tagId))
      toast.success('Tag rimosso.')
    }
  }

  const availableTags = allTags.filter((t) => !tags.some((current) => current.tagId === t.id))

  const tagSection = (
    <div className="mt-2 flex flex-col gap-3 rounded-md border bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tag</span>
        <div className="flex items-center gap-2">
          <Select value={addTagId} onValueChange={setAddTagId} disabled={tagPending}>
            <SelectTrigger size="sm" className="w-40">
              <SelectValue placeholder="Aggiungi tag" />
            </SelectTrigger>
            <SelectContent>
              {availableTags.length === 0 ? (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">Nessun tag disponibile</div>
              ) : (
                availableTags.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.name}
                    {t.archived ? ' (Archiviato)' : ''}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!addTagId || tagPending}
            onClick={() => void handleAddTag()}
          >
            Aggiungi
          </Button>
        </div>
      </div>
      {tags.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nessun tag assegnato.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <Badge key={t.tagId} variant="outline" className="flex items-center gap-1">
              {t.tagName}
              {t.archived ? <span className="text-muted-foreground">(Archiviato)</span> : null}
              <button
                type="button"
                aria-label={`Rimuovi tag ${t.tagName}`}
                disabled={tagPending}
                onClick={() => void handleRemoveTag(t.tagId)}
                className="ml-1 rounded-full hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )

  const searchQuery = transaction.customTitle?.trim() || transaction.description
  const searchHref = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`

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
          fallbackTitle={transaction.groupTitle ?? transaction.expenseTitle}
          onSuccess={() => router.refresh()}
          variant="detail"
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
      {/* Original bank description shown whenever the displayed title differs from the raw
          description (D-detail): a custom title, OR a group/expense title standing in for it
          (e.g. a grouped transaction shows the group title) — in all those cases the underlying
          transaction's own title would otherwise be invisible. Hidden only when the title already
          IS the raw description. Labelled "Descrizione originale". */}
      {displayTitle !== transaction.description ? (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Descrizione originale
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
      ) : null}
      {categoriaSection}
      {tagSection}
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
          {/* When the linked expense belongs to a group, point at the group (the meaningful
              aggregate the user manages), not the individual member expense. */}
          {transaction.groupId ? (
            <>
              <span className="text-sm text-muted-foreground">Gruppo collegato</span>
              <Link
                href={expenseGroupDetailHref(transaction.groupId)}
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                {transaction.groupTitle ?? 'Vedi gruppo'}
              </Link>
            </>
          ) : (
            <>
              <span className="text-sm text-muted-foreground">Spesa collegata</span>
              <Link
                href={expenseDetailHref(transaction.expenseId)}
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                {transaction.expenseTitle ?? 'Vedi spesa'}
              </Link>
            </>
          )}
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
      {isInflow ? (
        refundMembership ? (
          <RefundMembershipCard transactionId={transaction.id} membership={refundMembership} />
        ) : null
      ) : (
        <ReimbursementPanel
          anchor={{ transactionId: transaction.id }}
          data={reimbursementPanelData}
          onAddRefund={() => setRefundPickerOpen(true)}
          variant="summary"
        />
      )}
    </div>
  )

  return (
    <>
      {/* No header title/amount here (D-detail): the transaction title and total already live in
          the "Dati" card (un-truncated), so the shell shows only the back link — avoids the
          duplicated, ellipsis-clipped heading. */}
      <DetailPageShell
        backHref={APP_ROUTES.transactions}
        layout="two-column"
        datiCard={datiCard}
        collegamentiCard={collegamentiCard}
        azioniCard={azioniCard}
      />

      {!isInflow ? (
        <RefundPickerDialog
          open={refundPickerOpen}
          onOpenChange={setRefundPickerOpen}
          anchor={{
            transactionId: transaction.id,
            amount: transaction.amount,
            occurredAt: transaction.occurredAt,
          }}
          onLinked={() => router.refresh()}
        />
      ) : null}

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
