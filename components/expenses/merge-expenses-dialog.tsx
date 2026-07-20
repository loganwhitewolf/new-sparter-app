'use client'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { SubcategoryPicker } from '@/components/categorization/subcategory-picker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { addExpensesToGroupAction, bulkCategorize, mergeExpenses } from '@/lib/actions/expenses'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import type { MostUsedSubcategory } from '@/lib/dal/subcategory-usage'

export type MergeSelectedExpense = { id: string; subCategoryId: number | null }

type Step = 'title' | 'categorize' | 'confirm'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedExpenses: MergeSelectedExpense[]
  categories: CategoryWithSubCategories[]
  mostUsed: MostUsedSubcategory[]
  targetGroup?: { id: number; title: string; subCategoryId: number } | null
  onSuccess: () => void
}

/** GRP-02 title gate: the primary title-step button is disabled below 2 trimmed chars. */
export function isGroupTitleValid(title: string): boolean {
  return title.trim().length >= 2
}

/** Scopes bulkCategorize to only the uncategorized ids in the current selection. */
export function getUncategorizedIds(selectedExpenses: MergeSelectedExpense[]): string[] {
  return selectedExpenses
    .filter((expense) => expense.subCategoryId === null)
    .map((expense) => expense.id)
}

/**
 * GRP-02 categorize-first routing: any uncategorized expense in the selection
 * (including the all-uncategorized case) forces the categorize step first;
 * an already-fully-categorized-and-matching selection skips straight to confirm.
 */
export function nextStepAfterTitle(selectedExpenses: MergeSelectedExpense[]): Step {
  return selectedExpenses.some((expense) => expense.subCategoryId === null)
    ? 'categorize'
    : 'confirm'
}

/**
 * WR-01: the subCategoryId already shared by the selection's categorized members,
 * or null when the selection is fully uncategorized (nothing to conflict with yet).
 * Used to reject a categorize-step pick that would guarantee mergeExpenses' own
 * "same category" server check fails.
 */
export function getSharedSubCategoryId(selectedExpenses: MergeSelectedExpense[]): number | null {
  const ids = new Set(
    selectedExpenses
      .map((expense) => expense.subCategoryId)
      .filter((id): id is number => id !== null),
  )
  return ids.size === 1 ? [...ids][0] : null
}

/**
 * Thin async wrapper around bulkCategorize, scoped to only the uncategorized
 * ids in the selection (D-02: merge itself never assigns a category).
 */
export async function runCategorizeStep({
  selectedExpenses,
  subCategoryId,
}: {
  selectedExpenses: MergeSelectedExpense[]
  subCategoryId: string
}): Promise<{ error: string | null }> {
  const fd = new FormData()
  fd.set('ids', JSON.stringify(getUncategorizedIds(selectedExpenses)))
  fd.set('subCategoryId', subCategoryId)
  return bulkCategorize({ error: null }, fd)
}

/**
 * Thin async wrapper around mergeExpenses, always called with the FULL
 * original selection — even ids just categorized by runCategorizeStep above.
 */
export async function runMergeStep({
  selectedExpenses,
  groupTitle,
}: {
  selectedExpenses: MergeSelectedExpense[]
  groupTitle: string
}): Promise<{ error: string | null }> {
  const fd = new FormData()
  fd.set('selectedExpenseIds', JSON.stringify(selectedExpenses.map((expense) => expense.id)))
  fd.set('groupTitle', groupTitle)
  return mergeExpenses({ error: null }, fd)
}

/**
 * GRP-06 add-to-group: scopes any uncategorized selection to the group's fixed
 * subcategory first (D-05: the target subcategory is not user-chosen), then
 * always adds the FULL original selectedExpenses id set (mirrors runMergeStep's
 * "always full original set" rule).
 */
export async function runAddToGroupStep({
  selectedExpenses,
  targetGroupId,
  targetSubCategoryId,
}: {
  selectedExpenses: MergeSelectedExpense[]
  targetGroupId: number
  targetSubCategoryId: number
}): Promise<{ error: string | null }> {
  if (getUncategorizedIds(selectedExpenses).length > 0) {
    const categorizeFd = new FormData()
    categorizeFd.set('ids', JSON.stringify(getUncategorizedIds(selectedExpenses)))
    categorizeFd.set('subCategoryId', String(targetSubCategoryId))
    const categorizeResult = await bulkCategorize({ error: null }, categorizeFd)
    if (categorizeResult.error) {
      return categorizeResult
    }
  }

  const addFd = new FormData()
  addFd.set('groupId', String(targetGroupId))
  addFd.set('expenseIds', JSON.stringify(selectedExpenses.map((expense) => expense.id)))
  return addExpensesToGroupAction({ error: null }, addFd)
}

export function MergeExpensesDialog({
  open,
  onOpenChange,
  selectedExpenses,
  categories,
  mostUsed,
  targetGroup,
  onSuccess,
}: Props) {
  const [step, setStep] = useState<Step>(() => (targetGroup ? 'confirm' : 'title'))
  const [groupTitle, setGroupTitle] = useState('')
  const [isPending, startTransition] = useTransition()

  function resetAndClose() {
    setStep(targetGroup ? 'confirm' : 'title')
    setGroupTitle('')
    onOpenChange(false)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setStep(targetGroup ? 'confirm' : 'title')
      setGroupTitle('')
    }
    onOpenChange(nextOpen)
  }

  function handleTitleContinue() {
    setStep(nextStepAfterTitle(selectedExpenses))
  }

  function handleCategorizeChange(subCategoryId: string) {
    // WR-01: block picks that mergeExpenses is guaranteed to reject server-side —
    // a subcategory that differs from the one already shared by the selection's
    // categorized members. Surfacing this now (instead of after a wasted
    // bulkCategorize + confirm round trip) avoids the confusing dead end.
    const sharedSubCategoryId = getSharedSubCategoryId(selectedExpenses)
    if (sharedSubCategoryId !== null && sharedSubCategoryId !== Number(subCategoryId)) {
      toast.error(
        'La categoria scelta non corrisponde a quella già assegnata alle altre spese selezionate.',
      )
      return
    }

    startTransition(async () => {
      const result = await runCategorizeStep({ selectedExpenses, subCategoryId })
      if (result.error) {
        toast.error(result.error)
        return
      }
      setStep('confirm')
    })
  }

  function handleConfirmMerge() {
    startTransition(async () => {
      const result = await runMergeStep({ selectedExpenses, groupTitle })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Spese unite.')
      onSuccess()
      resetAndClose()
    })
  }

  function handleConfirmAddToGroup() {
    if (!targetGroup) return
    startTransition(async () => {
      const result = await runAddToGroupStep({
        selectedExpenses,
        targetGroupId: targetGroup.id,
        targetSubCategoryId: targetGroup.subCategoryId,
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Spese aggiunte al gruppo.')
      onSuccess()
      resetAndClose()
    })
  }

  return (
    <>
      <Dialog open={open && step !== 'categorize'} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unisci spese</DialogTitle>
            <DialogDescription>
              {targetGroup
                ? `Aggiungi spese al gruppo "${targetGroup.title}".`
                : step === 'title'
                  ? 'Assegna un titolo al gruppo di spese unite.'
                  : 'Conferma per unire le spese selezionate in un unico gruppo.'}
            </DialogDescription>
          </DialogHeader>

          {!targetGroup && step === 'title' ? (
            <Input
              value={groupTitle}
              onChange={(event) => setGroupTitle(event.target.value)}
              placeholder="Titolo del gruppo"
              aria-label="Titolo del gruppo"
            />
          ) : null}

          {targetGroup ? (
            <p className="text-sm text-muted-foreground">
              Stai per aggiungere <strong>{selectedExpenses.length} spese</strong> al gruppo
              &ldquo;{targetGroup.title}&rdquo;.
              {getUncategorizedIds(selectedExpenses).length > 0 ? (
                <>
                  {' '}
                  Le spese non categorizzate verranno assegnate automaticamente alla categoria del
                  gruppo.
                </>
              ) : null}
            </p>
          ) : step === 'confirm' ? (
            <p className="text-sm text-muted-foreground">
              Stai per unire <strong>{selectedExpenses.length} spese</strong> nel gruppo
              &ldquo;{groupTitle}&rdquo;.
            </p>
          ) : null}

          <DialogFooter>
            {!targetGroup && step === 'title' ? (
              <Button
                type="button"
                disabled={!isGroupTitleValid(groupTitle)}
                onClick={handleTitleContinue}
              >
                Continua
              </Button>
            ) : null}
            {targetGroup ? (
              <Button type="button" disabled={isPending} onClick={handleConfirmAddToGroup}>
                Aggiungi
              </Button>
            ) : step === 'confirm' ? (
              <Button type="button" disabled={isPending} onClick={handleConfirmMerge}>
                Unisci
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SubcategoryPicker
        open={open && step === 'categorize'}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) handleOpenChange(false)
        }}
        categories={categories}
        mostUsed={mostUsed}
        allowedCategoryTypes={['in', 'out', 'transfer', 'allocation']}
        defaultType={null}
        onChange={handleCategorizeChange}
        pending={isPending}
      />
    </>
  )
}
