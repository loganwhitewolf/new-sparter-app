'use client'
import { useActionState, useEffect, useRef, useState } from 'react'
import { AlertCircle, Loader2, Plus } from 'lucide-react'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createExpense, updateExpense } from '@/lib/actions/expenses'
import type { ExpenseRow } from '@/lib/dal/expenses'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'

type Props =
  | {
      mode: 'create'
      categories: CategoryWithSubCategories[]
      expense?: never
      trigger?: never
      onSuccess?: never
    }
  | {
      mode: 'edit'
      categories: CategoryWithSubCategories[]
      expense: ExpenseRow
      trigger: React.ReactNode
      onSuccess?: () => void
    }

export function ExpenseFormDialog({ mode, categories, expense, trigger, onSuccess }: Props) {
  const [open, setOpen] = useState(false)

  const [categoryId, setCategoryId] = useState<string>('')
  const [subCategoryId, setSubCategoryId] = useState<string>('')

  const selectedCategory = categories.find((c) => String(c.id) === categoryId)

  const action = mode === 'create' ? createExpense : updateExpense
  const [state, formAction, isPending] = useActionState(action, { error: null })
  const submittedRef = useRef(false)

  useEffect(() => {
    if (submittedRef.current && state.error === null) {
      setOpen(false)
      toast.success(mode === 'create' ? 'Spesa creata con successo.' : 'Spesa aggiornata.')
      submittedRef.current = false
      onSuccess?.()
    }
  }, [state, mode, onSuccess])

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen && mode === 'edit' && expense.subCategoryId) {
      const catId = String(
        categories.find((c) => c.subCategories.some((s) => s.id === expense.subCategoryId))?.id ?? ''
      )
      setCategoryId(catId)
      setSubCategoryId(String(expense.subCategoryId))
    } else if (!nextOpen) {
      setCategoryId('')
      setSubCategoryId('')
    }
    setOpen(nextOpen)
  }

  function handleCategoryChange(value: string) {
    setCategoryId(value)
    setSubCategoryId('')
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Nuova spesa
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Nuova spesa' : 'Modifica spesa'}</DialogTitle>
          <DialogDescription className="sr-only">
            {mode === 'create' ? 'Inserisci i dettagli della nuova spesa.' : 'Modifica i dettagli della spesa.'}
          </DialogDescription>
        </DialogHeader>

        <form
          action={(fd) => {
            submittedRef.current = true
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

          {/* Categoria */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Categoria</label>
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
          </div>

          {/* Sottocategoria */}
          {selectedCategory && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Sottocategoria</label>
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
            </div>
          )}

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
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'create' ? 'Salva spesa' : 'Aggiorna spesa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
