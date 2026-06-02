'use client'
import { useActionState, useEffect, useRef, useState } from 'react'
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
import { createTransaction } from '@/lib/actions/transactions'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import type { MostUsedSubcategory } from '@/lib/dal/subcategory-usage'

type Props = {
  categories: CategoryWithSubCategories[]
  mostUsed: MostUsedSubcategory[]
}

export function TransactionFormDialog({ categories, mostUsed }: Props) {
  const [open, setOpen] = useState(false)
  const [subCategoryId, setSubCategoryId] = useState<string>('')
  const [subCategoryLabel, setSubCategoryLabel] = useState<string>('')
  const [pickerOpen, setPickerOpen] = useState(false)

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
      setSubCategoryId('')
      setSubCategoryLabel('')
    }
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
    // sub.name already reflects the override (DAL bakes customName into name at row-map time)
    const label = subCat ? subCat.name : ''
    setSubCategoryLabel(label)
  }

  const todayISO = new Date().toISOString().slice(0, 10)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <ClientMountIcon icon={Plus} className="mr-2 h-4 w-4" />
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
