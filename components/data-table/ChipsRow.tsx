'use client'

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Chip = {
  key: string
  label: string
  onRemove: () => void
}

type Props = {
  chips: Chip[]
  onClear: () => void
}

/**
 * ChipsRow — renders removable active-filter pill buttons and a
 * "Cancella tutto" ghost button that clears all filter params at once.
 * Renders nothing when chips.length === 0.
 */
export function ChipsRow({ chips, onClear }: Props) {
  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Filtri attivi:
      </span>
      {chips.map((c) => (
        <button
          key={c.key}
          onClick={c.onRemove}
          className="inline-flex items-center gap-1 rounded-full border bg-secondary px-3 py-1 text-sm hover:bg-secondary/70"
        >
          {c.label}
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      ))}
      <Button variant="ghost" size="sm" onClick={onClear} className="text-muted-foreground">
        Cancella tutto
      </Button>
    </div>
  )
}
