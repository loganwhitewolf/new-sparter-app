'use client'
import { useActionState, useEffect, useRef, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { CategoryCombobox } from '@/components/expenses/category-combobox'
import { categorizeExpense } from '@/lib/actions/expenses'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  expense: { id: string; title: string }
  categories: CategoryWithSubCategories[]
  onSuccess: (subCategoryId?: string) => void
}

export function ExpenseCategorizeDialog({
  open,
  onOpenChange,
  expense,
  categories,
  onSuccess,
}: Props) {
  const [subCategoryId, setSubCategoryId] = useState<string>('')
  const [state, formAction, isPending] = useActionState(categorizeExpense, { error: null })
  const submittedRef = useRef(false)

  useEffect(() => {
    if (submittedRef.current && state.error === null) {
      toast.success('Spesa categorizzata.')
      setSubCategoryId('')
      submittedRef.current = false
      onSuccess(subCategoryId)
      onOpenChange(false)
    }
  }, [state, subCategoryId, onSuccess, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Categorizza spesa</DialogTitle>
          <DialogDescription className="sr-only">
            Seleziona una categoria e una sottocategoria da assegnare alla spesa.
          </DialogDescription>
        </DialogHeader>

        <form
          action={(fd) => {
            submittedRef.current = true
            formAction(fd)
          }}
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="id" value={expense.id} />
          <input type="hidden" name="subCategoryId" value={subCategoryId} />

          <p className="text-sm text-muted-foreground">
            Assegna una categoria a{' '}
            <strong className="font-medium text-foreground break-words">{expense.title}</strong>.
          </p>

          <CategoryCombobox
            categories={categories}
            value={subCategoryId}
            onChange={setSubCategoryId}
            placeholder="Cerca sottocategoria…"
            allowedCategoryTypes={['in', 'out', 'system', 'transfer']}
          />

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
              Conferma
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
