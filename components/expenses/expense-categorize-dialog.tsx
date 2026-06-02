'use client'
import { useActionState, useRef, useTransition } from 'react'
import { AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
  const [state, formAction] = useActionState(categorizeExpense, { error: null })
  const [isPending, startTransition] = useTransition()

  // Ref to track error state across renders (avoids stale closures)
  const lastErrorRef = useRef<string | null | undefined>(undefined)

  function handleChange(subCategoryId: string) {
    const fd = new FormData()
    fd.set('id', expense.id)
    fd.set('subCategoryId', subCategoryId)

    startTransition(async () => {
      const result = await categorizeExpense({ error: null }, fd)
      if (result.error) {
        // Keep picker open to show error — but toast is sufficient here
        toast.error(result.error)
      } else {
        toast.success('Spesa categorizzata.')
        onSuccess(subCategoryId)
        onOpenChange(false)
      }
    })
  }

  return (
    <>
      <SubcategoryPicker
        open={open}
        onOpenChange={onOpenChange}
        categories={categories}
        mostUsed={mostUsed}
        allowedCategoryTypes={['in', 'out', 'transfer', 'system']}
        defaultType={null}
        onChange={handleChange}
      />
      {/* Error display for screen-reader accessibility — toasts already surfaced above */}
      {state.error && !isPending && (
        <div className="sr-only" role="alert">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        </div>
      )}
    </>
  )
}
