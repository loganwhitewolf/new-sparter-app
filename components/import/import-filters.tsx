'use client'

import { Search, X } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { ClientMountIcon } from '@/components/ui/client-mount-icon'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { APP_ROUTES } from '@/lib/routes'
import type { ParsedImportFilters } from '@/lib/validations/import'

type Props = {
  filters: ParsedImportFilters
}

const FILTER_KEYS = ['q', 'importedFrom', 'importedTo', 'referenceFrom', 'referenceTo'] as const

export function ImportFilters({ filters }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const hasFilters = FILTER_KEYS.some((key) => Boolean(filters[key]))

  function replaceWith(params: URLSearchParams) {
    const query = params.toString()
    startTransition(() => {
      router.replace(query ? `${APP_ROUTES.import}?${query}` : APP_ROUTES.import, {
        scroll: false,
      })
    })
  }

  function updateParam(key: (typeof FILTER_KEYS)[number], value: string | null) {
    const params = new URLSearchParams(searchParams.toString())

    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }

    replaceWith(params)
  }

  function clearFilters() {
    const params = new URLSearchParams(searchParams.toString())
    FILTER_KEYS.forEach((key) => params.delete(key))
    replaceWith(params)
  }

  return (
    <Card>
      <CardContent className="grid gap-4 p-4 lg:grid-cols-[minmax(14rem,1.4fr)_repeat(4,minmax(10rem,1fr))_auto] lg:items-end">
        <div className="grid gap-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="import-search">
            Cerca importazione
          </label>
          <div className="relative">
            <ClientMountIcon
              icon={Search}
              ariaHidden
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="import-search"
              type="search"
              value={filters.q ?? ''}
              onChange={(event) => updateParam('q', event.currentTarget.value.trim() || null)}
              className="pl-9"
              placeholder="Nome file o etichetta"
              disabled={isPending}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="import-imported-from">
            Importato da
          </label>
          <Input
            id="import-imported-from"
            type="date"
            value={filters.importedFrom ?? ''}
            onChange={(event) => updateParam('importedFrom', event.currentTarget.value || null)}
            disabled={isPending}
          />
        </div>

        <div className="grid gap-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="import-imported-to">
            Importato a
          </label>
          <Input
            id="import-imported-to"
            type="date"
            value={filters.importedTo ?? ''}
            onChange={(event) => updateParam('importedTo', event.currentTarget.value || null)}
            disabled={isPending}
          />
        </div>

        <div className="grid gap-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="import-reference-from">
            Riferimento da
          </label>
          <Input
            id="import-reference-from"
            type="date"
            value={filters.referenceFrom ?? ''}
            onChange={(event) => updateParam('referenceFrom', event.currentTarget.value || null)}
            disabled={isPending}
          />
        </div>

        <div className="grid gap-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="import-reference-to">
            Riferimento a
          </label>
          <Input
            id="import-reference-to"
            type="date"
            value={filters.referenceTo ?? ''}
            onChange={(event) => updateParam('referenceTo', event.currentTarget.value || null)}
            disabled={isPending}
          />
        </div>

        <Button
          type="button"
          variant="outline"
          className="lg:self-end"
          onClick={clearFilters}
          disabled={isPending || !hasFilters}
        >
          <ClientMountIcon icon={X} ariaHidden className="h-4 w-4" />
          <span>Reset filtri</span>
        </Button>
      </CardContent>
    </Card>
  )
}
