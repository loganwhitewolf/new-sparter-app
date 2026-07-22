'use client'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { SubcategoryPicker } from '@/components/categorization/subcategory-picker'
import { categorizeExpenseGroup } from '@/lib/actions/expenses'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import type { MostUsedSubcategory } from '@/lib/dal/subcategory-usage'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  group: { id: number; title: string }
  categories: CategoryWithSubCategories[]
  mostUsed: MostUsedSubcategory[]
  onSuccess: (subCategoryId?: string) => void
}

/**
 * GRP-05/D-01b: the group row's own recategorize control. Mirrors
 * ExpenseCategorizeDialog exactly, but always targets the whole group via
 * categorizeExpenseGroup — recategorizing a group propagates to every member
 * (D-09), never a single expense id.
 */
export function GroupCategorizeDialog({
  open,
  onOpenChange,
  group,
  categories,
  mostUsed,
  onSuccess,
}: Props) {
  const [isPending, startTransition] = useTransition()

  function handleChange(subCategoryId: string) {
    const fd = new FormData()
    fd.set('groupId', String(group.id))
    fd.set('subCategoryId', subCategoryId)

    startTransition(async () => {
      const result = await categorizeExpenseGroup({ error: null }, fd)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Gruppo categorizzato.')
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
