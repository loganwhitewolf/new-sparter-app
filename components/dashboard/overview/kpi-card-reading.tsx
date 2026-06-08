import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type Reading = { text: string; sentiment: 'good' | 'warn' | 'bad' | 'neutral' }

const sentimentColor: Record<Reading['sentiment'], string> = {
  good: 'text-total-in',
  warn: 'text-amber-600 dark:text-amber-400',
  bad: 'text-total-out',
  neutral: 'text-muted-foreground',
}

type Tone = 'in' | 'out' | 'balance' | 'savings' | 'neutral'

function formatDelta(delta: number): string {
  if (delta === 0) return '0%'
  const formatted = Number.isInteger(delta) ? String(delta) : delta.toFixed(1)
  return delta > 0 ? `+${formatted}%` : `${formatted}%`
}

function valueColor(tone: Tone, value: string): string {
  if (tone === 'in') return 'text-total-in'
  if (tone === 'out') return 'text-total-out'
  if (tone === 'balance') return 'text-balance text-[color:var(--balance)]'
  if (tone === 'savings') return value.trim().startsWith('-') ? 'text-total-out' : 'text-total-in'
  return 'text-foreground'
}

function deltaColor(delta: number, goodWhenPositive: boolean): string {
  if (delta === 0) return 'text-muted-foreground'
  const isGood = goodWhenPositive ? delta > 0 : delta < 0
  return isGood ? 'text-total-in' : 'text-total-out'
}

export function ReadingKpiCard({
  label,
  value,
  delta,
  tone,
  goodWhenPositive = true,
  reading,
  prevYear,
  className,
}: {
  label: string
  value: string
  delta: number | null
  tone: Tone
  goodWhenPositive?: boolean
  reading: Reading
  prevYear: number
  className?: string
}) {
  return (
    <Card className={cn('min-h-32 rounded-lg py-0', className)}>
      <CardContent className="flex h-full flex-col justify-between gap-3 p-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={cn('font-mono text-2xl font-semibold tabular-nums', valueColor(tone, value))}>{value}</p>
        </div>
        <div className="space-y-1.5">
          <p className={cn('text-xs font-medium leading-snug', sentimentColor[reading.sentiment])}>{reading.text}</p>
          {delta !== null ? (
            <Badge
              variant="outline"
              className={cn('border-border bg-background font-mono', deltaColor(delta, goodWhenPositive))}
            >
              <span>{formatDelta(delta)}</span>
              <span className="hidden lg:inline"> vs {prevYear}</span>
            </Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
