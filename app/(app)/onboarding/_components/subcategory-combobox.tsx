'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { ChevronsUpDownIcon, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { onboardingCategorizeExpense } from '@/lib/actions/onboarding'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import { NATURE_LABELS } from '@/lib/utils/nature-labels'
import { toDecimal } from '@/lib/utils/decimal'

type SubcategoryComboboxProps = {
  expenseId: string
  expenseTitle: string
  expenseAmount: string
  categories: CategoryWithSubCategories[]
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
  return `${sign}€${amountFormatter.format(decimal.abs().toNumber())}`
}

function amountClassName(amount: string) {
  return toDecimal(amount).isNegative() ? 'text-destructive' : 'text-success'
}

export function SubcategoryCombobox({
  expenseId,
  expenseTitle,
  expenseAmount,
  categories,
}: SubcategoryComboboxProps) {
  const [open, setOpen] = useState(false)
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null)
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
    return null
  }

  const isPending = isActionPending || isTransitionPending

  function handleSelect(subCategoryId: number, label: string) {
    setSelectedLabel(label)
    setOpen(false)
    submittedRef.current = true

    const formData = buildOnboardingCategorizeFormData(expenseId, subCategoryId)
    startTransition(() => {
      formAction(formData)
    })
  }

  return (
    <div className="rounded-2xl bg-card border border-border p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-sm font-semibold text-card-foreground break-words">
          {expenseTitle}
        </p>
        <p className={`text-sm font-bold shrink-0 ${amountClassName(expenseAmount)}`}>
          {formatAmount(expenseAmount)}
        </p>
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={isPending}
            className="w-full justify-between font-normal"
          >
            <span className={selectedLabel ? 'truncate' : 'truncate text-muted-foreground'}>
              {selectedLabel ?? 'Seleziona categoria...'}
            </span>
            {isPending ? (
              <Loader2 className="ml-2 size-4 shrink-0 animate-spin opacity-70" />
            ) : (
              <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Cerca categoria..." />
            <CommandList>
              <CommandEmpty>Nessuna categoria trovata</CommandEmpty>
              {categories.map((category) => (
                <CommandGroup key={category.id} heading={category.name}>
                  {category.subCategories.map((subCategory) => (
                    <CommandItem
                      key={subCategory.id}
                      value={`${category.name} ${subCategory.name}`}
                      onSelect={() => handleSelect(subCategory.id, subCategory.name)}
                    >
                      <span className="min-w-0 flex-1 truncate">{subCategory.name}</span>
                      <Badge variant="secondary" className="ml-auto shrink-0">
                        {NATURE_LABELS[subCategory.effectiveNature ?? 'unclassified']}
                      </Badge>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {state.error && (
        <p className="mt-2 text-xs text-destructive" aria-live="polite">
          {state.error}
        </p>
      )}
    </div>
  )
}
