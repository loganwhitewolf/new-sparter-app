'use client'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { SubcategoryPicker } from '@/components/categorization/subcategory-picker'
import { bulkCategorize } from '@/lib/actions/expenses'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import type { MostUsedSubcategory } from '@/lib/dal/subcategory-usage'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedIds: string[]
  categories: CategoryWithSubCategories[]
  mostUsed: MostUsedSubcategory[]
  onSuccess: (subCategoryId: string) => void
  /** Toast count — defaults to selectedIds.length */
  successCount?: number
  /** Toast noun — defaults to "spese" */
  successNoun?: string
}

export function BulkCategorizeDialog({
  open,
  onOpenChange,
  selectedIds,
  categories,
  mostUsed,
  onSuccess,
  successCount,
  successNoun = 'spese',
}: Props) {
  const [isPending, startTransition] = useTransition()

  function handleChange(subCategoryId: string) {
    const fd = new FormData()
    fd.set('ids', JSON.stringify(selectedIds))
    fd.set('subCategoryId', subCategoryId)

    startTransition(async () => {
      const result = await bulkCategorize({ error: null }, fd)
      if (result.error) {
        toast.error(result.error)
      } else {
        const count = successCount ?? selectedIds.length
        toast.success(`${count} ${successNoun} categorizzate.`)
        onSuccess(subCategoryId)
        onOpenChange(false)
      }
    })
  }

  return (
    <SubcategoryPicker
      open={open}
      onOpenChange={onOpenChange}
      categories={categories}
      mostUsed={mostUsed}
      allowedCategoryTypes={['in', 'out', 'transfer', 'allocation']}
      defaultType={null}
      onChange={handleChange}
      pending={isPending}
    />
  )
}
