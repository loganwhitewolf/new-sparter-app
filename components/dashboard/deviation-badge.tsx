import { cn } from '@/lib/utils'
import type { DeviationResult } from '@/lib/utils/dashboard'

type Props = {
  deviation: DeviationResult
  categoryType: 'in' | 'out'
  className?: string
}

export function DeviationBadge({ deviation, categoryType, className }: Props) {
  if (deviation === null) return null

  if (deviation === 'new') {
    return (
      <span
        className={cn('font-mono text-xs tabular-nums text-muted-foreground', className)}
        aria-label="Categoria nuova rispetto al periodo di riferimento"
      >
        Nuovo
      </span>
    )
  }

  if (deviation === 0) {
    return (
      <span className={cn('font-mono text-xs tabular-nums text-muted-foreground', className)}>
        0%
      </span>
    )
  }

  const isPositive = deviation > 0
  // For 'out': positive deviation = overspent = red (bad).
  // For 'in':  positive deviation = more income = green (good).
  const isGood = categoryType === 'out' ? !isPositive : isPositive
  const colorClass = isGood ? 'text-emerald-600' : 'text-destructive'
  const sign = isPositive ? '+' : ''

  return (
    <span
      className={cn('font-mono text-xs font-semibold tabular-nums', colorClass, className)}
      aria-label={`Deviazione ${sign}${deviation}%`}
    >
      {sign}{deviation}%
    </span>
  )
}
