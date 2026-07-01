'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
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
import { Input } from '@/components/ui/input'
import { SubcategoryPicker } from '@/components/categorization/subcategory-picker'
import { detachTransaction } from '@/lib/actions/transactions'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import type { MostUsedSubcategory } from '@/lib/dal/subcategory-usage'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  transactionId: string
  defaultTitle: string
  categories: CategoryWithSubCategories[]
  mostUsed: MostUsedSubcategory[]
  onSuccess: (result: {
    newExpenseId: string
    newExpenseTitle: string
    subCategoryId?: number
  }) => void
}

export function DetachExpenseDialog({
  open,
  onOpenChange,
  transactionId,
  defaultTitle,
  categories,
  mostUsed,
  onSuccess,
}: Props) {
  const [title, setTitle] = useState(defaultTitle)
  const [pending, setPending] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle(defaultTitle)
      setPickerOpen(false)
    }
  }, [open, defaultTitle])

  function openPicker() {
    const trimmed = title.trim()
    if (!trimmed) {
      toast.error('Il titolo della spesa è obbligatorio.')
      return
    }
    setPickerOpen(true)
  }

  async function handleSubcategorySelected(subCategoryIdRaw: string) {
    const trimmed = title.trim()
    if (!trimmed) {
      toast.error('Il titolo della spesa è obbligatorio.')
      return
    }

    const subCategoryId = Number(subCategoryIdRaw)

    setPending(true)
    const result = await detachTransaction({ transactionId, title: trimmed, subCategoryId })
    setPending(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success('Spesa a sé creata e categorizzata.')
    onOpenChange(false)
    onSuccess({
      newExpenseId: result.newExpenseId,
      newExpenseTitle: result.newExpenseTitle,
      subCategoryId,
    })
  }

  return (
    <>
      <Dialog open={open && !pickerOpen} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Spesa a sé (non aggregare)</DialogTitle>
            <DialogDescription>
              Isola questa transazione in una spesa dedicata, così non si aggrega con le
              altre transazioni con la stessa descrizione. Scegli un titolo, poi la
              sottocategoria.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="detach-expense-title">
              Titolo spesa
            </label>
            <Input
              id="detach-expense-title"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              disabled={pending}
              autoFocus
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={pending}>
                Annulla
              </Button>
            </DialogClose>
            <Button type="button" onClick={openPicker} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Scegli sottocategoria'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SubcategoryPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        categories={categories}
        mostUsed={mostUsed}
        allowedCategoryTypes={['in', 'out', 'transfer', 'allocation']}
        defaultType={null}
        onChange={(subCategoryId) => void handleSubcategorySelected(subCategoryId)}
        pending={pending}
      />
    </>
  )
}
