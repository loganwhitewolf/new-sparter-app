'use client'

// PROTOTYPE — wipe me. Year selector that drives the whole tab.
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AVAILABLE_YEARS } from './mock-data'

export function YearSelect({ year }: { year: number }) {
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
      <SelectTrigger aria-label="Anno" className="w-[120px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {AVAILABLE_YEARS.map((y) => (
          <SelectItem key={y} value={String(y)}>
            {y}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
