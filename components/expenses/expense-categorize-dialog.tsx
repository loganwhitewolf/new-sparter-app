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
import { categorizeExpense } from '@/lib/actions/expenses'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  expense: { id: string; title: string }
  categories: CategoryWithSubCategories[]
  onSuccess: () => void
}

export function ExpenseCategorizeDialog({
  open,
  onOpenChange,
  expense,
  categories,
  onSuccess,
}: Props) {
  const [categoryId, setCategoryId] = useState<string>('')
  const [subCategoryId, setSubCategoryId] = useState<string>('')
  const [state, formAction, isPending] = useActionState(categorizeExpense, { error: null })
  const submittedRef = useRef(false)

  const selectedCategory = categories.find((c) => String(c.id) === categoryId)

  useEffect(() => {
    if (submittedRef.current && state.error === null) {
      toast.success('Spesa categorizzata.')
      setCategoryId('')
      setSubCategoryId('')
      submittedRef.current = false
      onSuccess()
      onOpenChange(false)
    }
  }, [state, onSuccess, onOpenChange])

  function handleCategoryChange(value: string) {
    setCategoryId(value)
    setSubCategoryId('')
  }

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
            <strong className="font-medium text-foreground truncate">{expense.title}</strong>.
          </p>

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
