'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  selectedIds: string[]
  canBulkCategorize: boolean
  onBulkCategorize: () => void
  onBulkDelete: () => void
}

export function TransactionBulkActionBar({
  selectedIds,
  canBulkCategorize,
  onBulkCategorize,
  onBulkDelete,
}: Props) {
  const count = selectedIds.length

  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-lg border bg-background px-4 py-3 shadow-lg transition-all duration-150 sm:gap-4',
        count === 0
          ? 'pointer-events-none translate-y-2 opacity-0'
          : 'translate-y-0 opacity-100',
      )}
    >
      <span className="text-sm text-muted-foreground">
        <span className="font-mono font-medium text-foreground">{count}</span> selezionate
      </span>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={onBulkCategorize}
          disabled={!canBulkCategorize}
        >
          Categorizza ({count})
        </Button>
        <Button type="button" size="sm" variant="destructive" onClick={onBulkDelete}>
          Elimina ({count})
        </Button>
      </div>
    </div>
  )
}
