'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { DashboardPreset, DashboardType } from '@/lib/validations/dashboard'

type Props = {
  preset: DashboardPreset
  type: DashboardType
}

const typeOptions: Array<{ value: DashboardType; label: string }> = [
  { value: 'out', label: 'Uscite' },
  { value: 'in', label: 'Entrate' },
  { value: 'all', label: 'Tutti' },
]

const presetOptions: Array<{ value: DashboardPreset; label: string }> = [
  { value: 'last-month', label: 'Ultimo mese' },
  { value: 'last-3-months', label: 'Ultimi 3 mesi' },
  { value: 'last-6-months', label: 'Ultimi 6 mesi' },
  { value: 'this-year', label: "Quest'anno" },
  { value: 'last-year', label: 'Anno scorso' },
]

export function DashboardFilters({ preset, type }: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function updateFilters(next: Partial<Props>) {
    const params = new URLSearchParams(searchParams.toString())
    const nextType = next.type ?? type
    const nextPreset = next.preset ?? preset

    if (nextType === 'out') {
      params.delete('type')
    } else {
      params.set('type', nextType)
    }

    if (nextPreset === 'last-month') {
      params.delete('preset')
    } else {
      params.set('preset', nextPreset)
    }

    startTransition(() => {
      router.replace('/dashboard?' + params.toString(), { scroll: false })
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2 pb-4">
      <Tabs
        value={type}
        onValueChange={(value) => updateFilters({ type: value as DashboardType })}
      >
        <TabsList aria-label="Tipo movimento">
          {typeOptions.map((option) => (
            <TabsTrigger
              key={option.value}
              value={option.value}
              disabled={isPending}
              className="min-w-20"
            >
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Select
        value={preset}
        onValueChange={(value) => updateFilters({ preset: value as DashboardPreset })}
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
