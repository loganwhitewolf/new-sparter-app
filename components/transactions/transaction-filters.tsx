'use client'

import { ArrowDown, ArrowUp } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
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
import type { TransactionPlatformOption } from '@/lib/dal/transactions'
import type { ParsedTransactionFilters } from '@/lib/validations/transactions'

const DEFAULT_SORT = 'occurredAt'

const SORT_OPTIONS = [
  { value: 'occurredAt', label: 'Data movimento' },
  { value: 'amount', label: 'Importo' },
] as const

type Props = {
  filters: ParsedTransactionFilters
  platforms: TransactionPlatformOption[]
}

export function TransactionFilters({ filters, platforms }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function replaceWith(params: URLSearchParams) {
    const query = params.toString()
    startTransition(() => {
      router.replace(query ? `/transazioni?${query}` : '/transazioni', {
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

  function toggleDirection() {
    updateParam('dir', filters.dir === 'asc' ? null : 'asc')
  }

  return (
    <Card>
      <CardContent className="grid gap-4 p-4 md:grid-cols-[repeat(2,minmax(0,1fr))_minmax(12rem,1fr)_minmax(12rem,1fr)_auto] md:items-end">
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
