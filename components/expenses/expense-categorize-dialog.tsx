'use client'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { SubcategoryPicker } from '@/components/categorization/subcategory-picker'
import { categorizeExpense } from '@/lib/actions/expenses'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import type { MostUsedSubcategory } from '@/lib/dal/subcategory-usage'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  expense: { id: string; title: string }
  categories: CategoryWithSubCategories[]
  mostUsed: MostUsedSubcategory[]
  onSuccess: (subCategoryId?: string) => void
}

export function ExpenseCategorizeDialog({
  open,
  onOpenChange,
  expense,
  categories,
  mostUsed,
  onSuccess,
}: Props) {
  const [, startTransition] = useTransition()

  function handleChange(subCategoryId: string) {
    const fd = new FormData()
    fd.set('id', expense.id)
    fd.set('subCategoryId', subCategoryId)

    startTransition(async () => {
      const result = await categorizeExpense({ error: null }, fd)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Spesa categorizzata.')
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
      allowedCategoryTypes={['in', 'out', 'transfer', 'system']}
      defaultType={null}
      onChange={handleChange}
    />
  )
}
