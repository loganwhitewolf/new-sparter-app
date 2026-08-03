'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type CategoryYearSelectProps = {
  year: number
  years: string[]
}

/**
 * D-12: the Categories list's own year selector, mirroring OverviewHeader's
 * `<Select>`/`router.replace` pattern exactly. Unlike OverviewHeader this component does NOT
 * restore a session-persisted year on a bare mount — that sessionStorage-restore behavior is an
 * Overview-specific persistence feature (overview-persistence.ts), not part of this phase's
 * locked decisions (Phase 83-04 plan, Task 1 `<action>`).
 */
export function CategoryYearSelect({ year, years }: CategoryYearSelectProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  function update(next: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('year', next)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <Select value={String(year)} onValueChange={update}>
      <SelectTrigger
        aria-label="Anno"
        className="h-auto w-auto gap-1 rounded-full border px-3 py-1 text-sm font-medium"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {years.map((y) => (
          <SelectItem key={y} value={y}>
            {y}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
