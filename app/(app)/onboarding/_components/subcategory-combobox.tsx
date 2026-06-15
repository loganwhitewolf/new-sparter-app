'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { CheckCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SubcategoryPicker } from '@/components/categorization/subcategory-picker'
import { onboardingCategorizeExpense } from '@/lib/actions/onboarding'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import type { MostUsedSubcategory } from '@/lib/dal/subcategory-usage'
import { toDecimal } from '@/lib/utils/decimal'

type SubcategoryComboboxProps = {
  expenseId: string
  expenseTitle: string
  expenseAmount: string
  categories: CategoryWithSubCategories[]
  mostUsed: MostUsedSubcategory[]
}

const amountFormatter = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function buildOnboardingCategorizeFormData(
  expenseId: string,
  subCategoryId: number,
): FormData {
  const formData = new FormData()
  formData.append('id', expenseId)
  formData.append('subCategoryId', String(subCategoryId))
  return formData
}

function formatAmount(amount: string) {
  const decimal = toDecimal(amount)
  const sign = decimal.isNegative() ? '−' : '+'
  return `${sign}${amountFormatter.format(decimal.abs().toNumber())} €`
}

function amountClassName(amount: string) {
  return toDecimal(amount).isNegative() ? 'text-destructive' : 'text-success'
}

/** Derive defaultType for the picker from the expense amount sign (D-03). */
function deriveDefaultType(amount: string): 'out' | 'in' | null {
  try {
    const decimal = toDecimal(amount)
    if (decimal.isNegative()) return 'out'
    if (decimal.isPositive()) return 'in'
    return null
  } catch {
    return null
  }
}

export function SubcategoryCombobox({
  expenseId,
  expenseTitle,
  expenseAmount,
  categories,
  mostUsed,
}: SubcategoryComboboxProps) {
  const [open, setOpen] = useState(false)
  const [isCategorized, setIsCategorized] = useState(false)
  const [isTransitionPending, startTransition] = useTransition()
  const [state, formAction, isActionPending] = useActionState(
    onboardingCategorizeExpense,
    { error: null },
  )
  const submittedRef = useRef(false)

  useEffect(() => {
    if (submittedRef.current && state.error === null) {
      setIsCategorized(true)
      submittedRef.current = false
    }
  }, [state])

  if (isCategorized) {
    return (
      <div className="rounded-2xl bg-success/10 border border-success/20 p-4 flex items-center gap-3">
        <CheckCircle className="h-4 w-4 text-success shrink-0" aria-hidden="true" />
        <p className="text-sm text-foreground/60 flex-1 min-w-0 truncate">{expenseTitle}</p>
        <p className="text-sm shrink-0 text-foreground/50">{formatAmount(expenseAmount)}</p>
      </div>
    )
  }

  const isPending = isActionPending || isTransitionPending

  function handleSelect(subCategoryId: string) {
    submittedRef.current = true
    setOpen(false)

    const formData = buildOnboardingCategorizeFormData(expenseId, Number(subCategoryId))
    startTransition(() => {
      formAction(formData)
    })
  }

  return (
    <div className="rounded-2xl bg-foreground/10 border border-foreground/10 p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-sm font-semibold text-card-foreground break-words">
          {expenseTitle}
        </p>
        <p className={`text-sm font-bold shrink-0 ${amountClassName(expenseAmount)}`}>
          {formatAmount(expenseAmount)}
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        disabled={isPending}
        className="w-full justify-start font-normal"
        onClick={() => setOpen(true)}
      >
        {isPending ? (
          <Loader2 className="mr-2 size-4 shrink-0 animate-spin opacity-70" />
        ) : null}
        <span className="truncate text-muted-foreground">
          {isPending ? 'Salvataggio…' : 'Seleziona categoria...'}
        </span>
      </Button>

      {state.error && (
        <p className="mt-2 text-xs text-destructive" aria-live="polite">
          {state.error}
        </p>
      )}

      <SubcategoryPicker
        open={open}
        onOpenChange={setOpen}
        categories={categories}
        mostUsed={mostUsed}
        allowedCategoryTypes={['in', 'out', 'transfer', 'allocation']}
        defaultType={deriveDefaultType(expenseAmount)}
        onChange={handleSelect}
      />
    </div>
  )
}
