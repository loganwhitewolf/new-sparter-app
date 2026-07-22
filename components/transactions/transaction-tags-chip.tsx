'use client'

import { useState } from 'react'
import { Tag } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export type TransactionRowTag = {
  tagId: number
  tagName: string
  archived: boolean
}

type Props = {
  tags: TransactionRowTag[]
}

/**
 * Compact inline tag indicator for a transactions-table row.
 *
 * Sits on the SAME line as the title: the title truncates with an ellipsis and this chip stays
 * visible right after it (the chip is `shrink-0`, the title owns the flexible space), so a long
 * description reads "DESCRIZIONE MOLTO LUN… [🏷 2]". The tag NAMES are revealed on demand rather
 * than inline, which keeps every row exactly one line tall regardless of how many tags it carries.
 *
 * Opens on hover (desktop) and on click/tap (touch, where hover does not exist) — the Popover's
 * open state is controlled so both gestures drive it. Read-only, like the chips it replaces:
 * bulk add/remove lives in BulkAssignTagsDialog, single add/remove on the detail page.
 */
export function TransactionTagsChip({ tags }: Props) {
  const [open, setOpen] = useState(false)

  if (tags.length === 0) return null

  const label =
    tags.length === 1 ? '1 tag collegato' : `${tags.length} tag collegati`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: ${tags.map((t) => t.tagName).join(', ')}`}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          className="shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Badge
            variant="outline"
            className="gap-1 px-1.5 text-[10px] font-medium tabular-nums"
          >
            <Tag className="size-3" aria-hidden="true" />
            {tags.length}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-auto max-w-64 p-2"
        // Keep the popover open while the pointer travels from the chip onto the panel.
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
        <ul className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <li key={tag.tagId}>
              <Badge variant="secondary" className="text-[10px]">
                {tag.tagName}
                {tag.archived && ' (archiviato)'}
              </Badge>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
