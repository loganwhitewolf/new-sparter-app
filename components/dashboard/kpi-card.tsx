import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Props = {
  label: string
  value: string
  delta: number | null
  tone: 'in' | 'out' | 'balance' | 'savings' | 'neutral'
  goodWhenPositive?: boolean
  className?: string
}

function formatDelta(delta: number | null): string {
  if (delta === null) {
    return '--'
  }
  if (delta === 0) {
    return '0%'
  }

  const formatted = Number.isInteger(delta) ? String(delta) : delta.toFixed(1)
  return delta > 0 ? `+${formatted}%` : `${formatted}%`
}

function valueColor(tone: Props['tone'], value: string): string {
  if (tone === 'in') return 'text-total-in'
  if (tone === 'out') return 'text-total-out'
  if (tone === 'balance') return 'text-balance text-[color:var(--balance)]'
  if (tone === 'savings') return value.trim().startsWith('-') ? 'text-total-out' : 'text-total-in'
  return 'text-foreground'
}

function deltaColor(delta: number | null, goodWhenPositive: boolean): string {
  if (delta === null || delta === 0) {
    return 'text-muted-foreground'
  }

  const isGood = goodWhenPositive ? delta > 0 : delta < 0
  return isGood ? 'text-total-in' : 'text-total-out'
}

export function KpiCard({
  label,
  value,
  delta,
  tone,
  goodWhenPositive = true,
  className,
}: Props) {
  return (
    <Card
      className={cn('min-h-32 rounded-lg py-0', className)}
      data-testid={`kpi-${label.toLowerCase().replaceAll(' ', '-')}`}
    >
      <CardContent className="flex h-full flex-col justify-between gap-3 p-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={cn('font-mono text-2xl font-semibold tabular-nums', valueColor(tone, value))}>
            {value}
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn('border-border bg-background font-mono', deltaColor(delta, goodWhenPositive))}
        >
          {formatDelta(delta)}
        </Badge>
      </CardContent>
    </Card>
  )
}
