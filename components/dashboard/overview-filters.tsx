'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { DashboardPreset } from '@/lib/validations/dashboard'

type Props = {
  preset: DashboardPreset
}

const presetOptions: Array<{ value: DashboardPreset; label: string }> = [
  { value: 'last-month', label: 'Mese corrente' },
  { value: 'last-3-months', label: 'Ultimi 3 mesi' },
  { value: 'last-6-months', label: 'Ultimi 6 mesi' },
  { value: 'this-year', label: "Quest'anno" },
  { value: 'last-year', label: 'Anno scorso' },
]

export function OverviewFilters({ preset }: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  function updatePreset(next: DashboardPreset) {
    const params = new URLSearchParams(searchParams.toString())

    if (next === 'last-month') {
      params.delete('preset')
    } else {
      params.set('preset', next)
    }

    const search = params.toString()
    startTransition(() => {
      router.replace(pathname + (search ? '?' + search : ''), { scroll: false })
    })
  }

  return (
    <div className="flex items-center pb-4">
      <Select
        value={preset}
        onValueChange={(value) => updatePreset(value as DashboardPreset)}
        disabled={isPending}
      >
        <SelectTrigger aria-label="Periodo dashboard" className="w-[170px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {presetOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
