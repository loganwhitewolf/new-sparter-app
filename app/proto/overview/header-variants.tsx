'use client'

// PROTOTYPE — wipe me. Five header treatments for the year selector UX exploration.
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AVAILABLE_YEARS } from './mock-data'

type HeaderProps = { year: number }

function useYearNav(year: number) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  function setYear(next: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('year', String(next))
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const sorted = ([...AVAILABLE_YEARS] as number[]).sort((a, b) => a - b)
  const idx = sorted.indexOf(year)
  return {
    setYear,
    sorted,
    canPrev: idx > 0,
    canNext: idx < sorted.length - 1,
    prevYear: sorted[idx - 1] as number | undefined,
    nextYear: sorted[idx + 1] as number | undefined,
  }
}

// H1 — Pill inline accanto al titolo (stessa riga)
export function HeaderH1({ year }: HeaderProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  function update(next: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('year', next)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1">
      <h1 className="text-lg font-semibold">Panoramica delle tue finanze</h1>
      <Select value={String(year)} onValueChange={update}>
        <SelectTrigger aria-label="Anno" className="h-auto w-auto gap-1 rounded-full border px-3 py-1 text-sm font-medium">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {AVAILABLE_YEARS.map((y) => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

// H2 — Anno grande e prominente sopra, titolo come sottotitolo sotto
export function HeaderH2({ year }: HeaderProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  function update(next: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('year', next)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="shrink-0">
      <Select value={String(year)} onValueChange={update}>
        <SelectTrigger
          aria-label="Anno"
          className="h-auto w-auto gap-2 border-none p-0 text-3xl font-bold shadow-none focus:ring-0 [&>svg]:h-5 [&>svg]:w-5 [&>svg]:opacity-50"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {AVAILABLE_YEARS.map((y) => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="mt-0.5 text-sm text-muted-foreground">Panoramica delle tue finanze</p>
    </div>
  )
}

// H3 — Titolo a sinistra, anno grande a destra (peso bilanciato)
export function HeaderH3({ year }: HeaderProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  function update(next: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('year', next)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="flex shrink-0 items-end justify-between gap-4">
      <h1 className="text-xl font-bold leading-tight">
        Panoramica<br className="hidden sm:block" /> delle tue finanze
      </h1>
      <Select value={String(year)} onValueChange={update}>
        <SelectTrigger
          aria-label="Anno"
          className="h-auto w-auto gap-1 border-none p-0 text-2xl font-bold text-muted-foreground shadow-none transition-colors hover:text-foreground focus:ring-0 [&>svg]:h-4 [&>svg]:w-4"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {AVAILABLE_YEARS.map((y) => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

// H4 — Pills/tab orizzontali per anno sotto il titolo
export function HeaderH4({ year }: HeaderProps) {
  const { setYear, sorted } = useYearNav(year)

  return (
    <div className="shrink-0">
      <h1 className="text-lg font-semibold">Panoramica delle tue finanze</h1>
      <div className="mt-2 flex gap-1.5">
        {sorted.map((y) => (
          <button
            key={y}
            type="button"
            onClick={() => setYear(y)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              y === year
                ? 'bg-foreground text-background'
                : 'border text-muted-foreground hover:text-foreground'
            }`}
          >
            {y}
          </button>
        ))}
      </div>
    </div>
  )
}

// H5 — Frecce prev/next con anno al centro (stile calendario)
export function HeaderH5({ year }: HeaderProps) {
  const { setYear, canPrev, canNext, prevYear, nextYear } = useYearNav(year)

  return (
    <div className="shrink-0">
      <p className="text-sm text-muted-foreground">Panoramica delle tue finanze</p>
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          onClick={() => canPrev && prevYear !== undefined && setYear(prevYear)}
          disabled={!canPrev}
          aria-label="Anno precedente"
          className="flex h-8 w-8 items-center justify-center rounded-full border transition-colors hover:bg-muted disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[4.5rem] text-center text-2xl font-bold tabular-nums">{year}</span>
        <button
          type="button"
          onClick={() => canNext && nextYear !== undefined && setYear(nextYear)}
          disabled={!canNext}
          aria-label="Anno successivo"
          className="flex h-8 w-8 items-center justify-center rounded-full border transition-colors hover:bg-muted disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
