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
import { Badge } from '@/components/ui/badge'
import type { TagRow } from '@/lib/dal/tags'

// Sentinel value for the "Tutti i tag" default/clear option — Radix Select forbids an
// empty-string SelectItem value (reserved for "no selection"), and no real tagId is ever 'all'
// (tagId is a positive integer per parseTagIdParam/resolveOwnedTagId, 68-01).
const ALL_TAGS_VALUE = 'all'

type Props = {
  tags: TagRow[]
  value?: number
}

// Pure and exported so the URL-writing logic is independently unit-testable — this repo's
// test env has no jsdom/DOM-interaction harness (Radix Select portals into document.body),
// so behavior coverage happens against this function rather than a simulated Select
// interaction (same pattern as MergeExpensesDialog's exported step-logic helpers).
export function buildTagFilterSearch(
  searchParams: Pick<URLSearchParams, 'toString'>,
  nextValue: string
): string {
  const params = new URLSearchParams(searchParams.toString())
  if (nextValue === ALL_TAGS_VALUE) {
    params.delete('tag')
  } else {
    params.set('tag', nextValue)
  }
  return params.toString()
}

export function TagFilterSelect({ tags, value }: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  function handleValueChange(nextValue: string) {
    const search = buildTagFilterSearch(searchParams, nextValue)
    startTransition(() => {
      router.replace(pathname + (search ? '?' + search : ''), { scroll: false })
    })
  }

  return (
    <Select
      value={value !== undefined ? String(value) : ALL_TAGS_VALUE}
      onValueChange={handleValueChange}
      disabled={isPending}
    >
      <SelectTrigger aria-label="Filtro tag" className="w-[170px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_TAGS_VALUE}>Tutti i tag</SelectItem>
        {tags.map((tagRow) => (
          <SelectItem key={tagRow.id} value={String(tagRow.id)}>
            {tagRow.name}
            {tagRow.archived && (
              <Badge variant="secondary" className="ml-2 text-[10px]">
                Archiviato
              </Badge>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
