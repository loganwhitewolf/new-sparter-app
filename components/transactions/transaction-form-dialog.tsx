'use client'
import { useActionState, useCallback, useEffect, useRef, useState } from 'react'
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
import { createTransaction } from '@/lib/actions/transactions'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'

type Props = {
  categories: CategoryWithSubCategories[]
}

export function TransactionFormDialog({ categories }: Props) {
  const [open, setOpen] = useState(false)
  const [categoryId, setCategoryId] = useState<string>('')
  const [subCategoryId, setSubCategoryId] = useState<string>('')

  const selectedCategory = categories.find((c) => String(c.id) === categoryId)

  const [state, formAction, isPending] = useActionState(createTransaction, { error: null })
  const submittedRef = useRef(false)

  useEffect(() => {
    if (submittedRef.current && state.error === null) {
      setOpen(false)
      toast.success('Transazione creata con successo.')
      submittedRef.current = false
    }
  }, [state])

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      setCategoryId('')
      setSubCategoryId('')
    }
  }

  function handleCategoryChange(value: string) {
    setCategoryId(value)
    setSubCategoryId('')
  }

  const todayISO = new Date().toISOString().slice(0, 10)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Nuova transazione
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuova transazione</DialogTitle>
          <DialogDescription className="sr-only">
            Inserisci i dettagli della nuova transazione manuale.
          </DialogDescription>
        </DialogHeader>

        <form
          action={(fd) => {
            submittedRef.current = true
            formAction(fd)
          }}
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="subCategoryId" value={subCategoryId} />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="tx-description">
              Descrizione <span className="text-destructive">*</span>
            </label>
            <Input
              id="tx-description"
              name="description"
              placeholder="es. Bolletta Enel, Stipendio..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="tx-amount">
                Importo <span className="text-destructive">*</span>
              </label>
              <Input
                id="tx-amount"
                name="amount"
                placeholder="es. -45,90"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="tx-date">
                Data <span className="text-destructive">*</span>
              </label>
              <Input
                id="tx-date"
                name="occurredAt"
                type="date"
                defaultValue={todayISO}
                required
              />
            </div>
          </div>

          <input type="hidden" name="currency" value="EUR" />

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
              Salva transazione
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
