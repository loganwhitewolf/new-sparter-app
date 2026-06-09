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
  onSuccess: () => void
}

export function BulkCategorizeDialog({
  open,
  onOpenChange,
  selectedIds,
  categories,
  mostUsed,
  onSuccess,
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
        toast.success(`${selectedIds.length} spese categorizzate.`)
        onSuccess()
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
      allowedCategoryTypes={['in', 'out', 'transfer', 'system']}
      defaultType={null}
      onChange={handleChange}
      pending={isPending}
    />
  )
}
