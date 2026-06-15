'use client'

import { Link2 } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toDecimal } from '@/lib/utils/decimal'
import { APP_ROUTES } from '@/lib/routes'

type Props = {
  pairedWithId: string
  netAmount: string   // DECIMAL string from DB — never use native arithmetic
  pairedDescription: string
  pairedAmount: string
  pairedOccurredAt: Date
}

const dateFormatter = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

/**
 * Format the signed net amount for badge display.
 * Uses Decimal.js — never native JS arithmetic (project hard rule).
 *
 * Open Question 1 from 50-RESEARCH.md: both legs show the SAME signed net
 * (e.g. -€50,00 on the expense and -€50,00 on the reimbursement) to communicate
 * the economic effect rather than a per-leg breakdown.
 */
function formatNet(netAmount: string): string {
  try {
    const net = toDecimal(netAmount)
    const sign = net.isNegative() ? '' : '+'
    return `${sign}€${net.toFixed(2).replace('.', ',')}`
  } catch {
    return netAmount
  }
}

/**
 * Format an absolute transaction amount for popover display.
 * Uses Decimal.js — never native JS arithmetic (project hard rule).
 */
function formatAmount(amount: string): string {
  try {
    const d = toDecimal(amount)
    const sign = d.isNegative() ? '-' : '+'
    return `${sign}€${d.abs().toFixed(2).replace('.', ',')}`
  } catch {
    return amount
  }
}

function formatDate(date: Date): string {
  return dateFormatter.format(new Date(date))
}

/**
 * Inline pair badge + popover component.
 *
 * Renders a compact 🔗 badge showing the signed net amount. Clicking it opens a
 * Popover with counterpart details (description, amount, date, net) and a link to
 * jump to the counterpart transaction via a query-anchor (D-16).
 *
 * T-50-08: counterpart text is rendered through React (auto-escaped); no
 * dangerouslySetInnerHTML anywhere in this component.
 */
export function TransactionPairPopover({
  pairedWithId,
  netAmount,
  pairedDescription,
  pairedAmount,
  pairedOccurredAt,
}: Props) {
  const netLabel = formatNet(netAmount)

  // D-16: link to the transactions list filtered by the counterpart ID; no page navigation.
  const counterpartHref = `${APP_ROUTES.transactions}?q=${encodeURIComponent(pairedWithId)}`

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Rimborso collegato: netto ${netLabel}`}
          className="inline-flex items-center gap-1"
        >
          <Badge
            variant="outline"
            className="border-0 bg-blue-100 text-blue-700 cursor-pointer hover:bg-blue-200 transition-colors font-mono tabular-nums"
          >
            <Link2 className="h-3 w-3" />
            {netLabel}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 text-sm">
        <div className="flex flex-col gap-2">
          <p className="font-medium text-foreground">Rimborso collegato</p>
          <div className="flex flex-col gap-1 text-muted-foreground">
            <p className="truncate" title={pairedDescription}>
              {pairedDescription}
            </p>
            <div className="flex items-center justify-between">
              <span>Importo</span>
              <span className="font-mono tabular-nums">{formatAmount(pairedAmount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Data</span>
              <span className="font-mono">{formatDate(pairedOccurredAt)}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-1 mt-1 text-foreground font-medium">
              <span>Netto</span>
              <span className="font-mono tabular-nums">{netLabel}</span>
            </div>
          </div>
          <Link
            href={counterpartHref}
            className="text-xs text-primary underline-offset-4 hover:underline"
          >
            Vai alla transazione
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
