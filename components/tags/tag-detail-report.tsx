import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { TagBreakdownItem, TagDetail } from '@/lib/dal/tags'

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

// One breakdown row: category name + signed amount, over a CSS bar whose width encodes |total| /
// max|total| and whose color follows the sign (--total-in / --total-out). No charting dependency
// (D4, CONTEXT out-of-scope). `total` is signed, so `>= 0` picks the inflow color.
function CategoryBar({ item, maxAbs }: { item: TagBreakdownItem; maxAbs: number }) {
  const value = Number(item.total)
  const widthPct = (Math.abs(value) / maxAbs) * 100
  const barColor = value >= 0 ? 'var(--total-in)' : 'var(--total-out)'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="truncate font-medium">{item.categoryName}</span>
        <span className={cn('shrink-0 tabular-nums', toneClass(item.total))}>
          {formatSignedAmount(item.total)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{ width: `${widthPct}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  )
}

// Presentational server component (D4 "report verticale" body): 3 KPI cards → included-transaction
// count → per-category breakdown (CSS bars) → date-descending tx list.
// Pure formatting over props — deliberately NOT a client component.
export function TagDetailReport({ detail }: Props) {
  // Bar scale: the widest bar (100%) is the category with the largest |total|. Guard with 1 so an
  // all-zero (or empty) breakdown never divides by zero. Number() is presentation-only — the
  // signed Decimal reconciliation already happened in buildTagDetailData (CLAUDE.md money rule).
  const maxAbs = Math.max(...detail.breakdown.map((b) => Math.abs(Number(b.total))), 1)

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

      {detail.breakdown.length > 0 && (
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle className="text-sm font-medium">Per categoria</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-4">
            {detail.breakdown.map((item) => (
              <CategoryBar key={item.categoryName} item={item} maxAbs={maxAbs} />
            ))}
          </CardContent>
        </Card>
      )}

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
