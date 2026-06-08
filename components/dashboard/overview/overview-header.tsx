'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function OverviewHeader({ year, years }: { year: number; years: string[] }) {
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
          {years.map((y) => (
            <SelectItem key={y} value={y}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
