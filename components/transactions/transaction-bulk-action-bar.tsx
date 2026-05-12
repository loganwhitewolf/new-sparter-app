'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  selectedIds: string[]
  onBulkDelete: () => void
}

export function TransactionBulkActionBar({ selectedIds, onBulkDelete }: Props) {
  const count = selectedIds.length

  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-lg border bg-background px-4 py-3 shadow-lg transition-all duration-150',
        count === 0
          ? 'pointer-events-none translate-y-2 opacity-0'
          : 'translate-y-0 opacity-100',
      )}
    >
      <span className="text-sm text-muted-foreground">
        <span className="font-mono font-medium text-foreground">{count}</span> selezionate
      </span>
      <Button type="button" size="sm" variant="destructive" onClick={onBulkDelete}>
        Elimina ({count})
      </Button>
    </div>
  )
}
