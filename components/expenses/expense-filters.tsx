'use client'
import { useSearchParams, useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'

type Props = { categories: CategoryWithSubCategories[] }

export function ExpenseFilters({ categories }: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const currentCategory = searchParams.get('category') ?? ''
  const currentStatus = searchParams.get('status') ?? ''
  const currentPeriod = searchParams.get('period') ?? 'this-month'

  function updateFilter(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    startTransition(() => {
      router.replace('/spese?' + params.toString(), { scroll: false })
    })
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap gap-3 p-4">
        {/* Categoria filter */}
        <Select
          value={currentCategory}
          onValueChange={(v) => updateFilter('category', v === 'all' ? null : v)}
          disabled={isPending}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le categorie</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.slug} value={cat.slug}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Stato filter */}
        <Select
          value={currentStatus}
          onValueChange={(v) => updateFilter('status', v === 'all' ? null : v)}
          disabled={isPending}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Stato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            <SelectItem value="uncategorized">Da categorizzare</SelectItem>
            <SelectItem value="categorized">Categorizzate</SelectItem>
          </SelectContent>
        </Select>

        {/* Periodo filter */}
        <Select
          value={currentPeriod}
          onValueChange={(v) => updateFilter('period', v)}
          disabled={isPending}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Periodo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this-month">Questo mese</SelectItem>
            <SelectItem value="last-3-months">Ultimi 3 mesi</SelectItem>
            <SelectItem value="last-6-months">Ultimi 6 mesi</SelectItem>
            <SelectItem value="this-year">Quest&apos;anno</SelectItem>
            <SelectItem value="last-year">Anno scorso</SelectItem>
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  )
}
