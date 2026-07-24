'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  createMultiRefundAction,
  loadEligibleCounterpartsAction,
  loadGroupOccurrenceIntervalAction,
  loadGroupRefundCandidatesAction,
} from '@/lib/actions/transaction-pairs'
import type { CounterpartRow } from '@/lib/dal/transaction-pairs'
import { toDecimal } from '@/lib/utils/decimal'
import { formatAbsoluteAmount } from '@/lib/utils/format-amount'

type Anchor = { transactionId: string; amount: string; occurredAt: Date } | { groupId: number }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  anchor: Anchor
  /** Fired after a successful multi-link submission — the host refreshes its own data. */
  onLinked?: () => void
}

/** Format absolute amount for display (display-only, never written back to DB). */
function formatCounterpartAmount(amount: string, isNegative: boolean): string {
  try {
    const abs = toDecimal(amount).abs()
    const sign = isNegative ? '-' : '+'
    return `${sign}${formatAbsoluteAmount(abs.toFixed(2))}`
  } catch {
    return amount
  }
}

const dateFormatter = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function formatDate(date: Date): string {
  return dateFormatter.format(new Date(date))
}

/**
 * Compute a `YYYY-MM-DD` string offset by the given number of days from the reference date.
 * Operates entirely in UTC — same WR-07 convention as CounterpartPickerDialog's offsetDateISO
 * (avoids a local-time/UTC day-boundary drift for users in a positive UTC offset).
 */
function offsetDateISO(base: Date, days: number): string {
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + days))
  return d.toISOString().slice(0, 10)
}

/**
 * D-05's multi-select add-refund picker: structurally mirrors CounterpartPickerDialog (search,
 * date-range, scrollable candidate list, fetch-on-open) but ticks SEVERAL eligible inflows and
 * links them in one action, with a live running total (Decimal.js, never native +).
 *
 * Accepts either a transaction anchor (D-02, `/transactions/[id]`) or a Group anchor (D-03,
 * Expense Group detail) — the Group case resolves its ±90-day window from the Group's occurrence
 * interval (D-06), not a single reference date, via `loadGroupOccurrenceIntervalAction`.
 *
 * Distinct from CounterpartPickerDialog (D-07's untouched 1:1 quick-action dialog) — never shares
 * state or a component with it.
 */
export function RefundPickerDialog({ open, onOpenChange, anchor, onLinked }: Props) {
  const isGroupAnchor = 'groupId' in anchor
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [search, setSearch] = useState('')
  // Transaction anchor: seeded synchronously from the (stable, mount-time) anchor prop — no
  // effect-driven setState needed. Group anchor: seeded empty, resolved async on open (D-06)
  // since the window depends on a server-side occurrence-interval lookup.
  const [dateFrom, setDateFrom] = useState(() =>
    'transactionId' in anchor ? offsetDateISO(anchor.occurredAt, -90) : '',
  )
  const [dateTo, setDateTo] = useState(() =>
    'transactionId' in anchor ? offsetDateISO(anchor.occurredAt, 90) : '',
  )

  const [counterparts, setCounterparts] = useState<CounterpartRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoadingCounterparts, startLoadTransition] = useTransition()

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const fetchCounterparts = useCallback(
    (from: string, to: string) => {
      startLoadTransition(async () => {
        const result = isGroupAnchor
          ? await loadGroupRefundCandidatesAction({
              groupId: anchor.groupId,
              dateFrom: new Date(from),
              dateTo: new Date(to),
            })
          : await loadEligibleCounterpartsAction({
              referenceId: anchor.transactionId,
              referenceAmount: anchor.amount,
              dateFrom: new Date(from),
              dateTo: new Date(to),
            })

        if ('error' in result && result.error) {
          setLoadError(result.error)
          setCounterparts([])
        } else if ('counterparts' in result) {
          setCounterparts(result.counterparts)
          setLoadError(null)
        }
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isGroupAnchor, isGroupAnchor ? anchor.groupId : anchor.transactionId],
  )

  // Fetch candidates whenever the dialog opens. Transaction anchor: dateFrom/dateTo are already
  // seeded (lazy initializer above) — fetch immediately. Group anchor (D-06): resolve the
  // occurrence interval FIRST, then default the window to ±90 days from its first/last member
  // transaction — never a single reference date.
  useEffect(() => {
    if (!open) return

    if (!isGroupAnchor) {
      fetchCounterparts(dateFrom, dateTo)
      return
    }

    startLoadTransition(async () => {
      const intervalResult = await loadGroupOccurrenceIntervalAction({ groupId: anchor.groupId })
      let from: string
      let to: string
      if ('interval' in intervalResult && intervalResult.interval) {
        from = offsetDateISO(intervalResult.interval.first, -90)
        to = offsetDateISO(intervalResult.interval.last, 90)
      } else {
        const today = new Date()
        from = offsetDateISO(today, -90)
        to = offsetDateISO(today, 90)
      }
      setDateFrom(from)
      setDateTo(to)
      fetchCounterparts(from, to)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function handleDateFromChange(value: string) {
    setDateFrom(value)
    if (open) fetchCounterparts(value, dateTo)
  }

  function handleDateToChange(value: string) {
    setDateTo(value)
    if (open) fetchCounterparts(dateFrom, value)
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setSearch('')
      setSelectedIds(new Set())
      setCounterparts([])
      setLoadError(null)
      setError(null)
      // Group anchor: blank, re-resolved on next open (D-06 async interval lookup). Transaction
      // anchor: restore the deterministic ±90-day default from the stable anchor prop — mirrors
      // CounterpartPickerDialog's own reset-to-default (never left blank for this branch).
      if (isGroupAnchor) {
        setDateFrom('')
        setDateTo('')
      } else {
        setDateFrom(offsetDateISO(anchor.occurredAt, -90))
        setDateTo(offsetDateISO(anchor.occurredAt, 90))
      }
    }
    onOpenChange(nextOpen)
  }

  async function handleSubmit(formData: FormData) {
    setError(null)
    setIsSubmitting(true)
    const result = await createMultiRefundAction({ error: null }, formData)
    setIsSubmitting(false)
    if (result.error) {
      setError(result.error)
      return
    }
    handleOpenChange(false)
    toast.success('Rimborsi collegati.')
    onLinked?.()
  }

  const filteredCounterparts = counterparts.filter((c) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    const label = (c.customTitle ?? c.description).toLowerCase()
    return label.includes(q)
  })

  const selectedTotal = counterparts
    .filter((c) => selectedIds.has(c.id))
    .reduce((sum, c) => sum.plus(toDecimal(c.amount)), toDecimal('0'))

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Aggiungi rimborso</DialogTitle>
          <DialogDescription className="sr-only">
            Seleziona una o più transazioni da collegare come rimborsi.
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="flex min-w-0 flex-col gap-4">
          {isGroupAnchor ? (
            <input type="hidden" name="groupId" value={anchor.groupId} />
          ) : (
            <input type="hidden" name="transactionId" value={anchor.transactionId} />
          )}
          {Array.from(selectedIds).map((id) => (
            <input key={id} type="hidden" name="counterpartIds" value={id} />
          ))}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="rp-search">
              Cerca contropartita
            </label>
            <Input
              id="rp-search"
              placeholder="Filtra per descrizione…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="rp-date-from">
                Da data
              </label>
              <Input
                id="rp-date-from"
                type="date"
                className="min-w-0"
                value={dateFrom}
                onChange={(e) => handleDateFromChange(e.target.value)}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="rp-date-to">
                A data
              </label>
              <Input
                id="rp-date-to"
                type="date"
                className="min-w-0"
                value={dateTo}
                onChange={(e) => handleDateToChange(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-muted-foreground">Transazioni disponibili</p>
            <div className="max-h-60 overflow-y-auto rounded-md border">
              {isLoadingCounterparts ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : loadError ? (
                <p className="px-4 py-6 text-center text-sm text-destructive">{loadError}</p>
              ) : filteredCounterparts.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  {counterparts.length === 0
                    ? 'Nessuna transazione disponibile nel periodo selezionato.'
                    : 'Nessuna transazione corrisponde alla ricerca.'}
                </p>
              ) : (
                <ul className="divide-y">
                  {filteredCounterparts.map((cp) => {
                    const isNegCp = toDecimal(cp.amount).isNegative()
                    const label = cp.customTitle?.trim() || cp.description
                    const isSelected = selectedIds.has(cp.id)
                    return (
                      <li key={cp.id}>
                        <label
                          className={`flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50 ${
                            isSelected ? 'bg-primary/5 font-medium' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelected(cp.id)}
                            className="mt-0.5 shrink-0"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className="min-w-0 flex-1 truncate">{label}</span>
                              <span className="shrink-0 font-mono tabular-nums text-xs">
                                {formatCounterpartAmount(cp.amount, isNegCp)}
                              </span>
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {formatDate(cp.occurredAt)}
                            </span>
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
            {selectedIds.size > 0 ? (
              <p className="text-xs text-muted-foreground">
                {selectedIds.size} selezionat{selectedIds.size === 1 ? 'a' : 'e'} — totale{' '}
                <span className="font-mono tabular-nums">
                  {formatAbsoluteAmount(selectedTotal.abs().toFixed(2))}
                </span>
              </p>
            ) : null}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Annulla
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting || selectedIds.size === 0}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Collega {selectedIds.size > 0 ? selectedIds.size : ''}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
