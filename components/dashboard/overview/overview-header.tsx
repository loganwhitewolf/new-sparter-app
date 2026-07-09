'use client'

import { useEffect, type ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { readSavedYear, saveYear, safeSessionStorage } from './overview-persistence'

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

  // Session persistence (quick task 260709-gfz): remember the selected year per-tab.
  // The URL stays the source of truth — this only seeds a bare mount.
  function update(next: string) {
    saveYear(safeSessionStorage(), next)
    const params = new URLSearchParams(searchParams.toString())
    params.set('year', next)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  // On a bare mount (no ?year in the URL — a fresh return to the dashboard), restore
  // the last-selected year. Guarded to a year that still has data, so a stale saved
  // year never overrides the server's default. URL params always win otherwise.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (searchParams.has('year')) return
    const saved = readSavedYear(safeSessionStorage())
    if (saved && saved !== String(year) && years.includes(saved)) {
      router.replace(`${pathname}?year=${saved}`, { scroll: false })
    }
  }, [])

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
