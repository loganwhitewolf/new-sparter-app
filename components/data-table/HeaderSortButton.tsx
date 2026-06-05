'use client'

import { ArrowDown, ArrowUp } from 'lucide-react'
import { TableHead } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { SortColumn } from '@/lib/utils/table-config'

type Props = {
  column: SortColumn
  activeSort?: string
  activeDir?: 'asc' | 'desc'
  align?: 'left' | 'right'
  className?: string
  onSort: (key: string) => void
}

/**
 * HeaderSortButton — renders a sortable <TableHead> with aria-sort and
 * ArrowUp / ArrowDown / neutral ↕ indicator.
 *
 * Sort cycle (Variant A, D-13): click inactive column → DESC; click active
 * DESC → ASC; click active ASC → off (params deleted = back to defaultSort).
 */
export function HeaderSortButton({ column, activeSort, activeDir, align, className, onSort }: Props) {
  const active = activeSort === column.key

  return (
    <TableHead
      className={className}
      aria-sort={active ? (activeDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        onClick={() => onSort(column.key)}
        className={cn(
          'inline-flex items-center gap-1 hover:text-foreground',
          align === 'right' && 'w-full justify-end',
          active && 'font-semibold text-foreground',
        )}
      >
        {column.label}
        {active ? (
          activeDir === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )
        ) : (
          <span className="text-muted-foreground/40">↕</span>
        )}
      </button>
    </TableHead>
  )
}

/**
 * nextSort — pure helper implementing the ASC → DESC → off cycle.
 *
 * Rules:
 *   - Clicking an inactive column → { sort: key, dir: 'desc' }
 *   - Clicking an active DESC column → { sort: key, dir: 'asc' }
 *   - Clicking an active ASC column → { sort: undefined, dir: undefined } (off = default)
 */
export function nextSort(
  current: { sort?: string; dir?: 'asc' | 'desc' },
  key: string,
): { sort?: string; dir?: 'asc' | 'desc' } {
  if (current.sort !== key) {
    // Inactive column → start with DESC
    return { sort: key, dir: 'desc' }
  }
  if (current.dir === 'desc') {
    // Active DESC → flip to ASC
    return { sort: key, dir: 'asc' }
  }
  // Active ASC → off (back to default, delete params)
  return { sort: undefined, dir: undefined }
}
