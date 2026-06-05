'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

// ---- Month label formatter -------------------------------------------------

/**
 * Formats a YYYY-MM string as a localized short label, e.g. "2026-05" → "Mag 2026".
 */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const label = new Intl.DateTimeFormat('it-IT', { month: 'short', year: 'numeric' }).format(
    new Date(y, m - 1, 1),
  )
  return label.charAt(0).toUpperCase() + label.slice(1)
}

// ---- Constants -------------------------------------------------------------

const MONTH_ABBR = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

function PresetBtn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border bg-secondary px-2.5 py-1 text-xs hover:bg-secondary/70"
    >
      {children}
    </button>
  )
}

// ---- Props -----------------------------------------------------------------

type MonthMultiPickerProps = {
  value: string[]
  monthsWithData: string[]
  onChange: (months: string[]) => void
}

// ---- Component -------------------------------------------------------------

/**
 * Year-grid month picker (D-12). Data-aware: cells disabled when no data for that month.
 *
 * - Year switcher: ‹ YYYY ›
 * - 12-cell grid (abbreviated Italian month names, Jan–Dec)
 * - Disabled cells: dashed border, 30% opacity
 * - "Tutto l'anno" toggle: selects/clears all enabled months in the viewed year
 * - Relative presets: "Ultimi 3 mesi", "Quest'anno", "Anno scorso" (D-10)
 * - onChange emits full selected string[]
 * - URL encoding: months=YYYY-MM,YYYY-MM (caller responsibility)
 */
export function MonthMultiPicker({ value, monthsWithData, onChange }: MonthMultiPickerProps) {
  const withDataSet = useMemo(() => new Set(monthsWithData), [monthsWithData])
  const years = useMemo(
    () =>
      Array.from(new Set(monthsWithData.map((m) => m.slice(0, 4))))
        .sort()
        .reverse(),
    [monthsWithData],
  )
  const latestYear = years[0] ?? String(new Date().getFullYear())
  const [viewYear, setViewYear] = useState(latestYear)

  const yearIdx = years.indexOf(viewYear)
  const goYear = (d: number) => {
    const i = yearIdx + d
    if (i >= 0 && i < years.length) setViewYear(years[i])
  }

  const toggle = (ym: string) =>
    onChange(value.includes(ym) ? value.filter((x) => x !== ym) : [...value, ym])

  // "Tutto l'anno" — operates only on enabled months in the viewed year
  const yearMonths = monthsWithData.filter((m) => m.startsWith(viewYear))
  const allYearSelected = yearMonths.length > 0 && yearMonths.every((m) => value.includes(m))
  const toggleYear = () =>
    allYearSelected
      ? onChange(value.filter((m) => !m.startsWith(viewYear)))
      : onChange(Array.from(new Set([...value, ...yearMonths])))

  // Relative presets (D-10) — resolved against actual monthsWithData
  const last3 = monthsWithData.slice(0, 3)
  const thisYear = monthsWithData.filter((m) => m.startsWith(latestYear))
  const lastYear = monthsWithData.filter((m) => m.startsWith(String(Number(latestYear) - 1)))

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-between">
          {value.length ? `${value.length} mes${value.length > 1 ? 'i' : 'e'}` : 'Mesi'}
          <span className="ml-2 text-muted-foreground">▾</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3 p-3">
        {/* Relative presets */}
        <div className="flex flex-wrap gap-1.5">
          {last3.length > 0 && (
            <PresetBtn onClick={() => onChange(last3)}>Ultimi 3 mesi</PresetBtn>
          )}
          {thisYear.length > 0 && (
            <PresetBtn onClick={() => onChange(thisYear)}>Quest&apos;anno</PresetBtn>
          )}
          {lastYear.length > 0 && (
            <PresetBtn onClick={() => onChange(lastYear)}>Anno scorso</PresetBtn>
          )}
        </div>

        {/* Year switcher */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => goYear(1)}
            disabled={yearIdx >= years.length - 1}
            className="px-2 text-lg leading-none disabled:opacity-30"
          >
            ‹
          </button>
          <span className="font-medium">{viewYear}</span>
          <button
            onClick={() => goYear(-1)}
            disabled={yearIdx <= 0}
            className="px-2 text-lg leading-none disabled:opacity-30"
          >
            ›
          </button>
        </div>

        {/* 12-cell month grid */}
        <div className="grid grid-cols-4 gap-1">
          {MONTH_ABBR.map((abbr, mi) => {
            const ym = `${viewYear}-${String(mi + 1).padStart(2, '0')}`
            const hasData = withDataSet.has(ym)
            const selected = value.includes(ym)
            return (
              <button
                key={ym}
                disabled={!hasData}
                onClick={() => toggle(ym)}
                className={cn(
                  'rounded-md border px-2 py-2 text-sm',
                  !hasData && 'cursor-not-allowed border-dashed text-muted-foreground/30',
                  hasData && !selected && 'hover:bg-muted',
                  selected && 'border-primary bg-primary text-primary-foreground',
                )}
              >
                {abbr}
              </button>
            )
          })}
        </div>

        {/* "Tutto l'anno" toggle */}
        <div className="flex items-center justify-between">
          <button
            onClick={toggleYear}
            disabled={yearMonths.length === 0}
            className="text-sm text-primary disabled:opacity-30"
          >
            {allYearSelected ? `Deseleziona ${viewYear}` : `Tutto l'anno`}
          </button>
          <span className="text-xs text-muted-foreground">{value.length} selez.</span>
        </div>
      </PopoverContent>
    </Popover>
  )
}
