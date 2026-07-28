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
import { realizePlanAction, reimbursePlanAction } from '@/lib/actions/amortization-lifecycle'
import { loadEligibleCounterpartsAction } from '@/lib/actions/transaction-pairs'
import type { CounterpartRow } from '@/lib/dal/transaction-pairs'
import { toDecimal } from '@/lib/utils/decimal'
import { formatAbsoluteAmount } from '@/lib/utils/format-amount'

type Intent = 'realize' | 'reduce'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction: {
    id: string
    planId: string
    amount: string
    occurredAt: Date
  }
  onDone: () => void
}

/** Format absolute amount for display (display-only, never written back to DB). */
function formatCandidateAmount(amount: string): string {
  try {
    return `+${formatAbsoluteAmount(toDecimal(amount).abs().toFixed(2))}`
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
 * Operates entirely in UTC — same WR-07 convention as RefundPickerDialog's own offsetDateISO.
 */
function offsetDateISO(base: Date, days: number): string {
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + days))
  return d.toISOString().slice(0, 10)
}

/**
 * D-03's intent-prompt dialog: intercepts "Aggiungi rimborso" for a transaction with an OPEN
 * amortization plan. Structurally mirrors RefundPickerDialog's candidate list (search, ±90-day
 * date range defaulted from the transaction's own occurredAt, fetched via
 * loadEligibleCounterpartsAction on open) but selection is single-choice (radio, not checkboxes)
 * and there is no multi-total footer. Once a candidate is picked, two intent radios appear —
 * "Chiudi per vendita" routes to realizePlanAction (D-02, AMORT-05), "Rimborso parziale
 * (ridistribuisci)" routes to reimbursePlanAction (D-03, AMORT-06). The system never guesses.
 */
export function AmortizationReimburseDialog({ open, onOpenChange, transaction, onDone }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState(() => offsetDateISO(transaction.occurredAt, -90))
  const [dateTo, setDateTo] = useState(() => offsetDateISO(transaction.occurredAt, 90))

  const [counterparts, setCounterparts] = useState<CounterpartRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoadingCounterparts, startLoadTransition] = useTransition()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [intent, setIntent] = useState<Intent | null>(null)

  const fetchCounterparts = useCallback(
    (from: string, to: string) => {
      startLoadTransition(async () => {
        const result = await loadEligibleCounterpartsAction({
          referenceId: transaction.id,
          referenceAmount: transaction.amount,
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
    [transaction.id, transaction.amount],
  )

  useEffect(() => {
    if (!open) return
    fetchCounterparts(dateFrom, dateTo)
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

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setSearch('')
      setSelectedId(null)
      setIntent(null)
      setCounterparts([])
      setLoadError(null)
      setError(null)
      setDateFrom(offsetDateISO(transaction.occurredAt, -90))
      setDateTo(offsetDateISO(transaction.occurredAt, 90))
    }
    onOpenChange(nextOpen)
  }

  function selectCandidate(id: string) {
    setSelectedId((prev) => (prev === id ? null : id))
    setIntent(null)
    setError(null)
  }

  async function handleSubmit() {
    if (!selectedId || !intent) return
    setError(null)
    setIsSubmitting(true)

    const result =
      intent === 'realize'
        ? await realizePlanAction({ planId: transaction.planId, saleTransactionId: selectedId })
        : await reimbursePlanAction({ planId: transaction.planId, refundTransactionId: selectedId })

    setIsSubmitting(false)

    if (result.error) {
      setError(result.error)
      return
    }

    handleOpenChange(false)
    toast.success(intent === 'realize' ? 'Piano chiuso e venduto.' : 'Rimborso applicato, rate ridistribuite.')
    onDone()
  }

  const filteredCounterparts = counterparts.filter((c) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    const label = (c.customTitle ?? c.description).toLowerCase()
    return label.includes(q)
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Aggiungi rimborso</DialogTitle>
          <DialogDescription>
            Questa transazione ha un piano di ammortamento aperto. Scegli una transazione e come
            vuoi collegarla.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="ar-search">
              Cerca contropartita
            </label>
            <Input
              id="ar-search"
              placeholder="Filtra per descrizione…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="ar-date-from">
                Da data
              </label>
              <Input
                id="ar-date-from"
                type="date"
                className="min-w-0"
                value={dateFrom}
                onChange={(e) => handleDateFromChange(e.target.value)}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="ar-date-to">
                A data
              </label>
              <Input
                id="ar-date-to"
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
                    const isSelected = selectedId === cp.id
                    const label = cp.customTitle?.trim() || cp.description
                    return (
                      <li key={cp.id}>
                        <label
                          className={`flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50 ${
                            isSelected ? 'bg-primary/5 font-medium' : ''
                          }`}
                        >
                          <input
                            type="radio"
                            name="ar-candidate"
                            checked={isSelected}
                            onChange={() => selectCandidate(cp.id)}
                            className="mt-0.5 shrink-0"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className="min-w-0 flex-1 truncate">{label}</span>
                              <span className="shrink-0 font-mono tabular-nums text-xs">
                                {formatCandidateAmount(cp.amount)}
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
          </div>

          {selectedId ? (
            <div className="flex flex-col gap-2 rounded-md border p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Cosa vuoi fare con questo collegamento?
              </p>
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="radio"
                  name="ar-intent"
                  checked={intent === 'realize'}
                  onChange={() => setIntent('realize')}
                  className="mt-1 shrink-0"
                />
                <span>
                  <span className="block font-medium">Chiudi per vendita</span>
                  <span className="block text-xs text-muted-foreground">
                    Il piano si chiude: le rate future vengono raggruppate e nettate con questa
                    transazione nel mese di chiusura.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="radio"
                  name="ar-intent"
                  checked={intent === 'reduce'}
                  onChange={() => setIntent('reduce')}
                  className="mt-1 shrink-0"
                />
                <span>
                  <span className="block font-medium">Rimborso parziale (ridistribuisci)</span>
                  <span className="block text-xs text-muted-foreground">
                    Il piano resta aperto: la base si riduce e le rate future vengono
                    ridistribuite proporzionalmente.
                  </span>
                </span>
              </label>
            </div>
          ) : null}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Annulla
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting || !selectedId || !intent}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Conferma
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
