import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { CategoryDetailData } from '@/lib/dal/dashboard'

type Props = {
  summary: CategoryDetailData['summary']
  type?: 'in' | 'out'
}

const currencyFormatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
})

function formatAmount(value: string): string {
  const amount = Number(value)
  return currencyFormatter.format(Number.isFinite(amount) ? Math.abs(amount) : 0)
}

function movementLabel(count: number): string {
  return count === 1 ? '1 movimento' : `${count} movimenti`
}

export function CategoryDetailSummary({ summary, type = 'out' }: Props) {
  const count = Number.isFinite(summary.count) ? Math.max(0, summary.count) : 0
  const valueClass = type === 'in' ? 'text-total-in' : 'text-total-out'

  return (
    <section aria-label="Riepilogo categoria" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Card className="min-h-28 rounded-lg py-0">
        <CardContent className="flex h-full flex-col justify-between gap-3 p-4">
          <p className="text-xs text-muted-foreground">Totale categoria</p>
          <p className={cn('font-mono text-2xl font-semibold tabular-nums', valueClass)}>
            {formatAmount(summary.total)}
          </p>
        </CardContent>
      </Card>

      <Card className="min-h-28 rounded-lg py-0">
        <CardContent className="flex h-full flex-col justify-between gap-3 p-4">
          <p className="text-xs text-muted-foreground">Movimenti</p>
          <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">
            {count}
          </p>
          <p className="text-xs text-muted-foreground">{movementLabel(count)}</p>
        </CardContent>
      </Card>

      <Card className="min-h-28 rounded-lg py-0">
        <CardContent className="flex h-full flex-col justify-between gap-3 p-4">
          <p className="text-xs text-muted-foreground">Media movimento</p>
          <p className={cn('font-mono text-2xl font-semibold tabular-nums', valueClass)}>
            {formatAmount(summary.average)}
          </p>
        </CardContent>
      </Card>
    </section>
  )
}
