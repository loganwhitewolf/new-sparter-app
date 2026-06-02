'use client'
import { useActionState, useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ClientMountIcon } from '@/components/ui/client-mount-icon'
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
import { Input } from '@/components/ui/input'
import { SubcategoryPicker } from '@/components/categorization/subcategory-picker'
import { createExpense, updateExpense } from '@/lib/actions/expenses'
import type { ExpenseRow } from '@/lib/dal/expenses'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import type { MostUsedSubcategory } from '@/lib/dal/subcategory-usage'

type Props =
  | {
      mode: 'create'
      categories: CategoryWithSubCategories[]
      mostUsed: MostUsedSubcategory[]
      expense?: never
      trigger?: never
      open?: never
      onOpenChange?: never
      description?: never
      onSuccess?: never
    }
  | {
      mode: 'edit'
      categories: CategoryWithSubCategories[]
      mostUsed: MostUsedSubcategory[]
      expense: ExpenseRow
      trigger?: React.ReactNode
      open?: boolean
      onOpenChange?: (open: boolean) => void
      description?: React.ReactNode
      onSuccess?: (updatedTitle: string) => void
    }

export function ExpenseFormDialog({
  mode,
  categories,
  mostUsed,
  expense,
  trigger,
  open: controlledOpen,
  onOpenChange,
  description,
  onSuccess,
}: Props) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen

  const [subCategoryId, setSubCategoryId] = useState<string>('')
  const [subCategoryLabel, setSubCategoryLabel] = useState<string>('')
  const [pickerOpen, setPickerOpen] = useState(false)

  const action = mode === 'create' ? createExpense : updateExpense
  const [state, formAction, isPending] = useActionState(action, { error: null })
  const submittedRef = useRef(false)
  const previousOpenRef = useRef(false)
  const pendingTitleRef = useRef('')

  const syncEditSelection = useCallback(() => {
    if (mode === 'edit' && expense.subCategoryId) {
      const subIdStr = String(expense.subCategoryId)
      setSubCategoryId(subIdStr)
      // Resolve display label from categories tree
      const parentCat = categories.find((c) =>
        c.subCategories.some((s) => s.id === expense.subCategoryId)
      )
      const subCat = parentCat?.subCategories.find((s) => s.id === expense.subCategoryId)
      const label = subCat ? (subCat.customName ?? subCat.name) : ''
      setSubCategoryLabel(label)
    }
  }, [categories, expense, mode])

  const resetSelection = useCallback(() => {
    setSubCategoryId('')
    setSubCategoryLabel('')
  }, [])

  const setDialogOpen = useCallback(
    (nextOpen: boolean) => {
      if (controlledOpen === undefined) {
        setUncontrolledOpen(nextOpen)
      }
      onOpenChange?.(nextOpen)
    },
    [controlledOpen, onOpenChange]
  )

  useEffect(() => {
    if (submittedRef.current && state.error === null) {
      setDialogOpen(false)
      toast.success(mode === 'create' ? 'Spesa creata con successo.' : 'Spesa aggiornata.')
      submittedRef.current = false
      onSuccess?.(pendingTitleRef.current)
    }
  }, [state, mode, onSuccess, setDialogOpen])

  useEffect(() => {
    if (open && !previousOpenRef.current) {
      syncEditSelection()
    } else if (!open && previousOpenRef.current) {
      resetSelection()
    }
    previousOpenRef.current = open
  }, [open, resetSelection, syncEditSelection])

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      syncEditSelection()
    } else {
      resetSelection()
    }
    setDialogOpen(nextOpen)
  }

  function handlePickerChange(selectedSubCategoryId: string) {
    setSubCategoryId(selectedSubCategoryId)
    // Resolve display label from categories tree
    const parentCat = categories.find((c) =>
      c.subCategories.some((s) => String(s.id) === selectedSubCategoryId)
    )
    const subCat = parentCat?.subCategories.find(
      (s) => String(s.id) === selectedSubCategoryId
    )
    const label = subCat ? (subCat.customName ?? subCat.name) : ''
    setSubCategoryLabel(label)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {(trigger || mode === 'create') && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button size="sm">
              <ClientMountIcon icon={Plus} ariaHidden className="mr-2 h-4 w-4" />
              Nuova spesa
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Nuova spesa' : 'Modifica spesa'}</DialogTitle>
          <DialogDescription className={description ? undefined : 'sr-only'}>
            {description ??
              (mode === 'create'
                ? 'Inserisci i dettagli della nuova spesa.'
                : 'Modifica i dettagli della spesa.')}
          </DialogDescription>
        </DialogHeader>

        <form
          action={(fd) => {
            submittedRef.current = true
            pendingTitleRef.current = (fd.get('title') as string) ?? ''
            formAction(fd)
          }}
          className="flex flex-col gap-4"
        >
          {mode === 'edit' && <input type="hidden" name="id" value={expense.id} />}
          <input type="hidden" name="subCategoryId" value={subCategoryId} />

          {/* Titolo */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="expense-title">
              Titolo <span className="text-destructive">*</span>
            </label>
            <Input
              id="expense-title"
              name="title"
              defaultValue={expense?.title ?? ''}
              placeholder="es. Netflix, Amazon Prime..."
              required
            />
          </div>

          {/* Sottocategoria */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Sottocategoria</label>
            <Button
              type="button"
              variant="outline"
              className="justify-start text-left font-normal"
              onClick={() => setPickerOpen(true)}
            >
              {subCategoryLabel || (
                <span className="text-muted-foreground">Categorizza…</span>
              )}
            </Button>
          </div>

          {/* Note */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="expense-notes">
              Note
            </label>
            <textarea
              id="expense-notes"
              name="notes"
              defaultValue={expense?.notes ?? ''}
              placeholder="Aggiungi una nota..."
              className="border-input bg-background rounded-md px-3 py-2 text-sm min-h-[80px] resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* Error */}
          {state.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Annulla
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending || !subCategoryId}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'create' ? 'Salva spesa' : 'Aggiorna spesa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <SubcategoryPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        categories={categories}
        mostUsed={mostUsed}
        allowedCategoryTypes={['in', 'out', 'transfer', 'system']}
        defaultType={null}
        onChange={handlePickerChange}
      />
    </Dialog>
  )
}
