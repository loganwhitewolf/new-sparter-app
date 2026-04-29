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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  const [categoryId, setCategoryId] = useState<string>('')
  const [subCategoryId, setSubCategoryId] = useState<string>('')
  const [state, formAction, isPending] = useActionState(bulkCategorize, { error: null })
  const submittedRef = useRef(false)

  const selectedCategory = categories.find((c) => String(c.id) === categoryId)

  useEffect(() => {
    if (submittedRef.current && state.error === null) {
      toast.success(`${selectedIds.length} spese categorizzate.`)
      setCategoryId('')
      setSubCategoryId('')
      submittedRef.current = false
      onSuccess()
    }
  }, [state, selectedIds.length, onSuccess])

  function handleCategoryChange(value: string) {
    setCategoryId(value)
    setSubCategoryId('')
  }

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

          {/* Categoria */}
          <Select value={categoryId} onValueChange={handleCategoryChange}>
            <SelectTrigger>
              <SelectValue placeholder="Seleziona una categoria" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={String(cat.id)}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sottocategoria */}
          {selectedCategory && (
            <Select value={subCategoryId} onValueChange={setSubCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona una sottocategoria" />
              </SelectTrigger>
              <SelectContent>
                {selectedCategory.subCategories.map((sub) => (
                  <SelectItem key={sub.id} value={String(sub.id)}>
                    {sub.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

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
