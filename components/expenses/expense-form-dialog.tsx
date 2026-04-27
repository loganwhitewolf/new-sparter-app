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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
    }
  | {
      mode: 'edit'
      categories: CategoryWithSubCategories[]
      expense: ExpenseRow
      trigger: React.ReactNode
    }

export function ExpenseFormDialog({ mode, categories, expense, trigger }: Props) {
  const [open, setOpen] = useState(false)
  const [subCategoryId, setSubCategoryId] = useState<string>(
    expense?.subCategoryId ? String(expense.subCategoryId) : ''
  )
  const action = mode === 'create' ? createExpense : updateExpense
  const [state, formAction, isPending] = useActionState(action, { error: null })
  const submittedRef = useRef(false)

  useEffect(() => {
    if (submittedRef.current && state.error === null) {
      setOpen(false)
      setSubCategoryId('')
      toast.success(mode === 'create' ? 'Spesa creata con successo.' : 'Spesa aggiornata.')
      submittedRef.current = false
    }
  }, [state, mode])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
        </DialogHeader>

        <form
          action={(fd) => {
            submittedRef.current = true
            formAction(fd)
          }}
          className="flex flex-col gap-4"
        >
          {mode === 'edit' && <input type="hidden" name="id" value={expense.id} />}

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

          {/* Categoria / Subcategoria */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Categoria</label>
            <input type="hidden" name="subCategoryId" value={subCategoryId} />
            <Select value={subCategoryId} onValueChange={setSubCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona una categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectGroup key={cat.id}>
                    <SelectLabel>{cat.name}</SelectLabel>
                    {cat.subCategories.map((sub) => (
                      <SelectItem key={sub.id} value={String(sub.id)}>
                        {sub.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
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
