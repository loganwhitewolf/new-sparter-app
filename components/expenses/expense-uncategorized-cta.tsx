'use client'

import { useTableUrl } from '@/components/data-table/use-table-url'
import { cn } from '@/lib/utils'

type Props = {
  uncategorizedCount: number
  route: string
}

/**
 * One-click toggle for ?status=uncategorized on the expenses list.
 * Pill in the page header — replaces the categorization filter in the toolbar.
 */
export function ExpenseUncategorizedCta({ uncategorizedCount, route }: Props) {
  const { searchParams, isPending, updateParam } = useTableUrl(route)
  const isActive = searchParams.get('status') === 'uncategorized'

  if (uncategorizedCount === 0 && !isActive) return null

  function handleClick() {
    updateParam('status', isActive ? null : 'uncategorized')
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={isActive}
      className={cn(
        'rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors',
        isActive
          ? 'border-amber-400 bg-amber-100 text-amber-900'
          : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:text-amber-900',
        isPending && 'opacity-60',
      )}
    >
      Da categorizzare ({uncategorizedCount})
    </button>
  )
}
