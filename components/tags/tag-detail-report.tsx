import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { amountToneClass } from '@/lib/utils/amount-tone'
import { toDecimal } from '@/lib/utils/decimal'
import { formatAbsoluteAmount } from '@/lib/utils/format-amount'
import type Decimal from 'decimal.js'
import { transactionsByTagHref } from '@/lib/routes'
import type { TagBreakdownItem, TagDetail } from '@/lib/dal/tags'

type Props = {
  detail: TagDetail
  tagId: number
}

const amountFormatter = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })

// Signed currency — keeps the leading minus so net / outflow rows read as negative.
// (The shared formatAbsoluteAmount strips the sign by design, hence this local variant.)
function formatSignedAmount(value: string): string {
  const amount = Number(value)
  return amountFormatter.format(Number.isFinite(amount) ? amount : 0)
}

function formatTxDate(value: string): string {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString('it-IT')
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
function CategoryBar({ item, maxAbs }: { item: TagBreakdownItem; maxAbs: Decimal }) {
  const total = toDecimal(item.total)
  // Decimal all the way to the percentage: the ratio derives from monetary amounts, so it stays
  // on Decimal per the money rule; toNumber() happens only at the CSS boundary.
  const widthPct = total.abs().div(maxAbs).times(100).toNumber()
  const barColor = total.isNegative() ? 'var(--total-out)' : 'var(--total-in)'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="truncate font-medium">{item.categoryName}</span>
        <span className={cn('shrink-0 tabular-nums', amountToneClass(item.total))}>
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
export function TagDetailReport({ detail, tagId }: Props) {
  // Bar scale: the widest bar (100%) is the category with the largest |total|. Floor of 1 so an
  // all-zero (or empty) breakdown never divides by zero.
  const maxAbs = detail.breakdown.reduce(
    (max, b) => (toDecimal(b.total).abs().greaterThan(max) ? toDecimal(b.total).abs() : max),
    toDecimal(1),
  )

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
          tone={amountToneClass(detail.net)}
        />
      </div>

      {/* Count + the bridge from analysis to navigation: this page is the all-time per-tag
          report, the transactions table is where you act on individual rows. `?tag=` is the
          transactions filter (TAG-14); the link is hidden when the tag has no transactions. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{transactionCountLabel(detail.count)}</p>
        {detail.count > 0 && (
          <Link
            href={transactionsByTagHref(tagId)}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Apri nella lista transazioni
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        )}
      </div>

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

      {/* The list has no fixed height / inner scrollbar: it flows to its natural length so the
          page has ONE scroll instead of a nested one (a tag's transaction count is bounded — it
          never approaches the volume that would justify virtualisation). */}
      {detail.transactions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nessuna transazione inclusa per questo tag.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {detail.transactions.map((tx) => (
            <li
              key={tx.transactionId}
              className="flex items-start justify-between gap-3 px-3 py-2 text-sm"
            >
              <div className="flex min-w-0 items-start gap-2">
                <span className="w-16 shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
                  {formatTxDate(tx.occurredAt)}
                </span>
                <div className="min-w-0">
                  <p className="truncate">{tx.description}</p>
                  <p className="truncate text-xs text-muted-foreground">{tx.subCategoryName}</p>
                </div>
              </div>
              <span className={cn('shrink-0 pt-0.5 font-medium tabular-nums', amountToneClass(tx.amount))}>
                {formatSignedAmount(tx.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
