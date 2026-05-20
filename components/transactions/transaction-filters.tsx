'use client'

import { ArrowDown, ArrowUp, Search } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useRef, useTransition } from 'react'
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
import type { TransactionPlatformOption } from '@/lib/dal/transactions'
import type { ParsedTransactionFilters } from '@/lib/validations/transactions'
import { APP_ROUTES } from '@/lib/routes'

const DEFAULT_SORT = 'occurredAt'

const SORT_OPTIONS = [
  { value: 'occurredAt', label: 'Data movimento' },
  { value: 'amount', label: 'Importo' },
] as const

type Props = {
  filters: ParsedTransactionFilters
  platforms: TransactionPlatformOption[]
  categories: CategoryWithSubCategories[]
}

export function TransactionFilters({ filters, platforms, categories }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function replaceWith(params: URLSearchParams) {
    const query = params.toString()
    startTransition(() => {
      router.replace(query ? `${APP_ROUTES.transactions}?${query}` : APP_ROUTES.transactions, {
        scroll: false,
      })
    })
  }

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())

    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }

    replaceWith(params)
  }

  function updateSort(value: string) {
    updateParam('sort', value === DEFAULT_SORT ? null : value)
  }

  function updateCategory(value: string) {
    const params = new URLSearchParams(searchParams.toString())

    if (value === 'all') {
      params.delete('category')
      params.delete('subCategory')
    } else {
      params.set('category', value)
      params.delete('subCategory')
    }

    replaceWith(params)
  }

  function toggleDirection() {
    updateParam('dir', filters.dir === 'asc' ? null : 'asc')
  }

  function handleNameChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateParam('name', value.trim() || null)
    }, 300)
  }

  const selectedCategory = filters.categorySlug
    ? categories.find((category) => category.slug === filters.categorySlug)
    : undefined
  const subcategoryOptions = selectedCategory
    ? selectedCategory.subCategories
    : categories.flatMap((category) => category.subCategories)

  return (
    <Card>
      <CardContent className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-[1.4fr_repeat(6,minmax(0,1fr))_auto] xl:items-end">
        {/* Ricerca per nome/descrizione */}
        <div className="grid gap-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="transaction-name">
            Cerca
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              id="transaction-name"
              type="search"
              placeholder="Nome o descrizione…"
              defaultValue={filters.name ?? ''}
              onChange={(e) => handleNameChange(e.currentTarget.value)}
              disabled={isPending}
              className="pl-9"
            />
          </div>
        </div>

        <div className="grid gap-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="transaction-from">
            Data da
          </label>
          <Input
            id="transaction-from"
            type="date"
            value={filters.from ?? ''}
            onChange={(event) =>
              updateParam('from', event.currentTarget.value || null)
            }
            disabled={isPending}
          />
        </div>

        <div className="grid gap-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="transaction-to">
            Data a
          </label>
          <Input
            id="transaction-to"
            type="date"
            value={filters.to ?? ''}
            onChange={(event) => updateParam('to', event.currentTarget.value || null)}
            disabled={isPending}
          />
        </div>

        <div className="grid gap-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="transaction-platform">
            Piattaforma
          </label>
          <Select
            value={filters.platform ?? 'all'}
            onValueChange={(value) =>
              updateParam('platform', value === 'all' ? null : value)
            }
            disabled={isPending}
          >
            <SelectTrigger id="transaction-platform" className="w-full">
              <SelectValue placeholder="Piattaforma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le piattaforme</SelectItem>
              {platforms.map((platform) => (
                <SelectItem key={platform.id} value={platform.slug}>
                  {platform.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="transaction-category">
            Categoria
          </label>
          <Select
            value={filters.categorySlug ?? 'all'}
            onValueChange={updateCategory}
            disabled={isPending}
          >
            <SelectTrigger id="transaction-category" className="w-full">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le categorie</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.slug}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="transaction-subcategory">
            Sottocategoria
          </label>
          <Select
            value={filters.subCategoryId ? String(filters.subCategoryId) : 'all'}
            onValueChange={(value) =>
              updateParam('subCategory', value === 'all' ? null : value)
            }
            disabled={isPending || subcategoryOptions.length === 0}
          >
            <SelectTrigger id="transaction-subcategory" className="w-full">
              <SelectValue placeholder="Sottocategoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le sottocategorie</SelectItem>
              {subcategoryOptions.map((subCategory) => (
                <SelectItem key={subCategory.id} value={String(subCategory.id)}>
                  {subCategory.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="transaction-sort">
            Ordina transazioni
          </label>
          <Select
            value={filters.sort}
            onValueChange={updateSort}
            disabled={isPending}
          >
            <SelectTrigger id="transaction-sort" className="w-full">
              <SelectValue placeholder="Ordina transazioni" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          variant="outline"
          className="md:self-end"
          onClick={toggleDirection}
          disabled={isPending}
          aria-label={
            filters.dir === 'asc'
              ? 'Imposta ordinamento decrescente'
              : 'Imposta ordinamento crescente'
          }
        >
          {filters.dir === 'asc' ? (
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ArrowDown className="h-4 w-4" aria-hidden="true" />
          )}
          <span>{filters.dir === 'asc' ? 'Crescente' : 'Decrescente'}</span>
        </Button>
      </CardContent>
    </Card>
  )
}
