'use client'

import type { ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type OverviewHeaderProps = {
  year: number
  years: string[]
  /** Optional nudge slot — rendered right-aligned on the title row (FRU-FIX-03). */
  nudge?: ReactNode
}

export function OverviewHeader({ year, years, nudge }: OverviewHeaderProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  function update(next: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('year', next)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
      {/* Left side: title + year selector */}
      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
        <h1 className="text-lg font-semibold">Panoramica delle tue finanze</h1>
        <Select value={String(year)} onValueChange={update}>
          <SelectTrigger aria-label="Anno" className="h-auto w-auto gap-1 rounded-full border px-3 py-1 text-sm font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {/* Right side: nudge slot (FRU-FIX-03) */}
      {nudge != null && <div className="ml-auto shrink-0">{nudge}</div>}
    </div>
  )
}
