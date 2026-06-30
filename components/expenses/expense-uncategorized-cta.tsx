'use client'

import { Tag } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ClientMountIcon } from '@/components/ui/client-mount-icon'
import { useTableUrl } from '@/components/data-table/use-table-url'
import { cn } from '@/lib/utils'

type Props = {
  uncategorizedCount: number
  route: string
}

/**
 * Toggle for ?status=uncategorized — styled as a header action beside "Nuova spesa".
 */
export function ExpenseUncategorizedCta({ uncategorizedCount, route }: Props) {
  const { searchParams, isPending, updateParam } = useTableUrl(route)
  const isActive = searchParams.get('status') === 'uncategorized'

  if (uncategorizedCount === 0 && !isActive) return null

  function handleClick() {
    updateParam('status', isActive ? null : 'uncategorized')
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={isActive}
      aria-label={
        isActive
          ? 'Mostra tutte le spese — filtro da categorizzare attivo'
          : 'Mostra solo le spese da categorizzare'
      }
      className={cn(
        isActive &&
          'border-primary bg-primary/10 text-primary shadow-none ring-2 ring-primary/20 hover:bg-primary/15 hover:text-primary',
      )}
    >
      <ClientMountIcon icon={Tag} ariaHidden className="size-4" />
      <span>Da categorizzare</span>
      <Badge
        variant={isActive ? 'default' : 'secondary'}
        className="h-5 min-w-5 justify-center px-1.5 tabular-nums"
      >
        {uncategorizedCount}
      </Badge>
    </Button>
  )
}
