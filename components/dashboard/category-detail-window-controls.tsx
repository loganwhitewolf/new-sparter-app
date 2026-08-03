'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { monthLabel } from '@/lib/utils/date'
import {
  CATEGORY_DETAIL_WINDOW_LENGTHS,
  type CategoryDetailWindow,
  type CategoryDetailWindowLength,
} from '@/lib/validations/category-year-window'

type Props = {
  year: number
  window: CategoryDetailWindow
}

const WINDOW_LENGTH_LABELS: Record<CategoryDetailWindowLength, string> = {
  12: 'Anno intero',
  9: '9 mesi',
  6: '6 mesi',
  3: '3 mesi',
}

export type StartMonthOption = { value: string; label: string }

/**
 * D-03: the valid start months for `months` — `1..13-months`, each an Italian month name
 * (`monthLabel`). Pure/exported so it's directly unit-testable without jsdom (this repo has no
 * DOM-interaction test harness — precedent: buildTagFilterSearch, computeMergeEligibility).
 */
export function buildStartMonthOptions(year: number, months: CategoryDetailWindowLength): StartMonthOption[] {
  const maxStartMonth = 13 - months
  return Array.from({ length: maxStartMonth }, (_, index) => {
    const monthNumber = index + 1
    const value = String(monthNumber).padStart(2, '0')
    return { value, label: monthLabel(`${year}-${value}`) }
  })
}

/**
 * D-01/D-02/D-03/D-04 (Phase 84): the detail page's window controls, mirroring
 * CategoryYearSelect's useSearchParams/useRouter/usePathname + router.replace pattern exactly —
 * every OTHER param (`year`, `type`, `lens`) is preserved verbatim by construction, which is the
 * emergent mechanism D-04 relies on. This component never reads or writes `year` — that param is
 * CategoryYearSelect's alone. Leaving `from`'s stale `YYYY-MM` string untouched when `year`
 * changes is exactly what makes D-04's re-anchoring free: parseCategoryDetailWindow already
 * re-derives `from` against whatever `year` is current, discarding any year prefix already in the
 * URL's own `from` value.
 */
export function CategoryDetailWindowControls({ year, window }: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  function replaceWith(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString())
    mutate(params)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function selectWindowLength(length: CategoryDetailWindowLength) {
    replaceWith((params) => {
      // D-01: a whole-year window is the absent state — deleting `months` (not setting it to
      // '12') keeps the URL contract's implicit-default shape.
      if (length === 12) {
        params.delete('months')
        params.delete('from')
      } else {
        params.set('months', String(length))
      }
    })
  }

  function selectStartMonth(monthValue: string) {
    replaceWith((params) => {
      params.set('from', `${year}-${monthValue}`)
    })
  }

  const startMonthOptions = buildStartMonthOptions(year, window.months)
  const isWholeYear = window.months === 12

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label="Finestra" className="flex overflow-hidden rounded-full border">
        {CATEGORY_DETAIL_WINDOW_LENGTHS.map((length) => (
          <button
            key={length}
            type="button"
            aria-pressed={window.months === length}
            onClick={() => selectWindowLength(length)}
            className={cn(
              'px-3 py-1 text-sm font-medium transition-colors',
              window.months === length
                ? 'bg-primary text-primary-foreground'
                : 'bg-transparent text-muted-foreground hover:bg-muted',
            )}
          >
            {WINDOW_LENGTH_LABELS[length]}
          </button>
        ))}
      </div>

      <Select value={window.from.split('-')[1]} onValueChange={selectStartMonth} disabled={isWholeYear}>
        <SelectTrigger
          aria-label="Mese di partenza"
          className="h-auto w-auto gap-1 rounded-full border px-3 py-1 text-sm font-medium"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {startMonthOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              da {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
