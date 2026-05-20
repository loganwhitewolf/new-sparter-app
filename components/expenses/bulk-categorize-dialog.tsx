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
import { bulkCategorize } from '@/lib/actions/expenses'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedIds: string[]
  categories: CategoryWithSubCategories[]
  onSuccess: () => void
}

export function BulkCategorizeDialog({
  open,
  onOpenChange,
  selectedIds,
  categories,
  onSuccess,
}: Props) {
  const [subCategoryId, setSubCategoryId] = useState<string>('')
  const [state, formAction, isPending] = useActionState(bulkCategorize, { error: null })
  const submittedRef = useRef(false)

  useEffect(() => {
    if (submittedRef.current && state.error === null) {
      toast.success(`${selectedIds.length} spese categorizzate.`)
      setSubCategoryId('')
      submittedRef.current = false
      onSuccess()
    }
  }, [state, selectedIds.length, onSuccess])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Assegna categoria</DialogTitle>
          <DialogDescription className="sr-only">
            Seleziona una categoria e una sottocategoria da assegnare alle spese selezionate.
          </DialogDescription>
        </DialogHeader>

        <form
          action={(fd) => {
            submittedRef.current = true
            formAction(fd)
          }}
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="ids" value={JSON.stringify(selectedIds)} />
          <input type="hidden" name="subCategoryId" value={subCategoryId} />

          <p className="text-sm text-muted-foreground">
            Assegna una categoria a{' '}
            <strong>{selectedIds.length} spese</strong> selezionate.
          </p>

          <CategoryCombobox
            categories={categories}
            value={subCategoryId}
            onChange={setSubCategoryId}
            placeholder="Cerca sottocategoria…"
            allowedCategoryTypes={['in', 'out', 'system']}
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
