import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { TagDetail } from '@/lib/dal/tags'

type Props = {
  detail: TagDetail
}

const amountFormatter = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })

// Signed currency — keeps the leading minus so the net / outflow rows read as negative;
// color (--total-in/--total-out) reinforces direction. Lifted from the former TagDetailView
// (D4 locked presentation rules), which was the tag-settings-panel inline detail.
function formatSignedAmount(value: string): string {
  const amount = Number(value)
  return amountFormatter.format(Number.isFinite(amount) ? amount : 0)
}

function formatAbsoluteAmount(value: string): string {
  const amount = Number(value)
  return amountFormatter.format(Math.abs(Number.isFinite(amount) ? amount : 0))
}

function formatTxDate(value: string): string {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString('it-IT')
}

// Sign-based tone (a tag has no fixed direction) — same rule as tag-ranking-list's totalTone.
function toneClass(value: string): string {
  return Number(value) >= 0 ? 'text-[var(--total-in)]' : 'text-[var(--total-out)]'
}

function transactionCountLabel(count: number): string {
  return count === 1 ? '1 transazione inclusa' : `${count} transazioni incluse`
}

function KpiCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-xs font-normal text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <p className={cn('text-lg font-semibold tabular-nums', tone)}>{value}</p>
      </CardContent>
    </Card>
  )
}

// Presentational server component (D4 "report verticale" body, minus the per-category breakdown
// added in Plan 69-02): 3 KPI cards → included-transaction count → date-descending tx list.
// Pure formatting over props — deliberately NOT a client component.
export function TagDetailReport({ detail }: Props) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          label="Entrate"
          value={formatAbsoluteAmount(detail.inflow)}
          tone="text-[var(--total-in)]"
        />
        <KpiCard
          label="Uscite"
          value={formatAbsoluteAmount(detail.outflow)}
          tone="text-[var(--total-out)]"
        />
        <KpiCard
          label="Valore finale"
          value={formatSignedAmount(detail.net)}
          tone={toneClass(detail.net)}
        />
      </div>

      <p className="text-sm text-muted-foreground">{transactionCountLabel(detail.count)}</p>

      {detail.transactions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nessuna transazione inclusa per questo tag.
        </p>
      ) : (
        <ul className="max-h-[420px] divide-y overflow-y-auto rounded-md border">
          {detail.transactions.map((tx) => (
            <li
              key={tx.transactionId}
              className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatTxDate(tx.occurredAt)}
                </span>
                <span className="truncate">{tx.subCategoryName}</span>
              </div>
              <span className={cn('shrink-0 font-medium tabular-nums', toneClass(tx.amount))}>
                {formatSignedAmount(tx.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
