'use client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  selectedIds: string[]
  onClearSelection: () => void
  onBulkCategorize: () => void
}

export function BulkActionBar({ selectedIds, onClearSelection, onBulkCategorize }: Props) {
  const count = selectedIds.length

  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-40',
        'flex items-center gap-4 rounded-lg border bg-background px-4 py-3 shadow-lg',
        'transition-all duration-150',
        count === 0
          ? 'pointer-events-none opacity-0 translate-y-2'
          : 'opacity-100 translate-y-0'
      )}
    >
      <span className="text-sm text-muted-foreground">
        <span className="font-mono font-medium text-foreground">{count}</span> selezionate
      </span>
      <Button size="sm" onClick={onBulkCategorize}>
        Categorizza ({count})
      </Button>
    </div>
  )
}
