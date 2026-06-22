'use client'
import { useSearchParams, useRouter } from 'next/navigation'
import { useTransition, useRef } from 'react'
import { ArrowDown, ArrowUp, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import { APP_ROUTES } from '@/lib/routes'

type Props = { categories: CategoryWithSubCategories[] }

const DEFAULT_SORT = 'createdAt'

const SORT_OPTIONS = [
  { value: 'createdAt', label: 'Data creazione' },
  { value: 'totalAmount', label: 'Totale spesa' },
] as const

export function ExpenseFilters({ categories }: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const currentCategory = searchParams.get('category') ?? ''
  const currentStatus = searchParams.get('status') ?? ''
  const currentPeriod = searchParams.get('period') ?? 'this-month'
  const currentName = searchParams.get('name') ?? ''
  const currentSort = searchParams.get('sort') === 'totalAmount' ? 'totalAmount' : DEFAULT_SORT
  const currentDirection = searchParams.get('dir') === 'asc' ? 'asc' : 'desc'

  function updateFilter(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    startTransition(() => {
      const query = params.toString()
      router.replace(query ? `${APP_ROUTES.expenses}?${query}` : APP_ROUTES.expenses, { scroll: false })
    })
  }

  function updateSort(value: string) {
    updateFilter('sort', value === DEFAULT_SORT ? null : value)
  }

  function toggleDirection() {
    updateFilter('dir', currentDirection === 'asc' ? null : 'asc')
  }

  function handleNameChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateFilter('name', value.trim() || null)
    }, 300)
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap gap-3 p-4">
        {/* Ricerca per nome */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Spesa o descrizione…"
            defaultValue={currentName}
            onChange={(e) => handleNameChange(e.currentTarget.value)}
            disabled={isPending}
            className="pl-9"
          />
        </div>

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

        <Select
          value={currentSort}
          onValueChange={updateSort}
          disabled={isPending}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Ordina spese" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          onClick={toggleDirection}
          disabled={isPending}
          aria-label={
            currentDirection === 'asc'
              ? 'Imposta ordinamento decrescente'
              : 'Imposta ordinamento crescente'
          }
        >
          {currentDirection === 'asc' ? (
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ArrowDown className="h-4 w-4" aria-hidden="true" />
          )}
          <span>{currentDirection === 'asc' ? 'Crescente' : 'Decrescente'}</span>
        </Button>
      </CardContent>
    </Card>
  )
}
