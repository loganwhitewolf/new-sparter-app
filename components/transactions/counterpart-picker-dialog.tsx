'use client'

import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from 'react'
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
import { createTransactionPairAction, loadEligibleCounterpartsAction } from '@/lib/actions/transaction-pairs'
import type { CounterpartRow } from '@/lib/dal/transaction-pairs'
import { toDecimal } from '@/lib/utils/decimal'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  transactionId: string
  transactionAmount: string
  transactionOccurredAt: Date
  /**
   * Fired after a successful pairing with the server-resolved secondary (refund)
   * transaction id and, when the refund expense inherited the spend's subcategory
   * (decision 2), that subCategoryId. Lets the table repaint the refund row as
   * categorized without a full reload.
   *
   * `counterpart` carries the selected counterpart's own amount/description/occurredAt
   * (CR-03) — the table needs this to optimistically set the pairing fields on BOTH
   * legs of the new pair, since the counterpart may not be present in the table's own
   * locally-loaded row list (it can come from outside the currently-loaded page).
   */
  onPaired?: (payload: {
    secondaryTransactionId: string
    subCategoryId?: number
    counterpart?: { id: string; amount: string; description: string; occurredAt: Date }
  }) => void
}

/** Format absolute amount for display (display-only, never written back to DB). */
function formatCounterpartAmount(amount: string, isNegative: boolean): string {
  try {
    const abs = toDecimal(amount).abs()
    const sign = isNegative ? '-' : '+'
    return `${sign}€${abs.toFixed(2).replace('.', ',')}`
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
 * Compute a `YYYY-MM-DD` string offset by the given number of days from the
 * reference date.
 *
 * WR-07: operate entirely in UTC. The earlier implementation mutated the date
 * with local-time `setDate` and then read it back with UTC `toISOString()`,
 * so for users in a positive UTC offset (Italy is UTC+1/+2) a transaction
 * timestamped near local midnight could shift the window boundary by a day.
 * `fetchCounterparts` later re-parses this string with `new Date(...)`, which
 * interprets a bare `YYYY-MM-DD` as UTC midnight — so computing the offset in
 * UTC here keeps the produced string and the re-parsed Date on the same day.
 */
function offsetDateISO(base: Date, days: number): string {
  const d = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + days),
  )
  return d.toISOString().slice(0, 10)
}

export function CounterpartPickerDialog({
  open,
  onOpenChange,
  transactionId,
  transactionAmount,
  transactionOccurredAt,
  onPaired,
}: Props) {
  const [state, formAction, isPending] = useActionState(createTransactionPairAction, { error: null })
  const submittedRef = useRef(false)

  // Search + date range state for filtering the counterpart list.
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState(() => offsetDateISO(transactionOccurredAt, -90))
  const [dateTo, setDateTo] = useState(() => offsetDateISO(transactionOccurredAt, 90))

  // Eligible counterparts loaded via server action (lazy, re-fetched on date range change).
  const [counterparts, setCounterparts] = useState<CounterpartRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoadingCounterparts, startLoadTransition] = useTransition()

  // Currently selected counterpart ID (hidden field sent with the form).
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Load counterparts from the server when triggered.
  const fetchCounterparts = useCallback(
    (from: string, to: string) => {
      if (!transactionId || !transactionAmount) return
      startLoadTransition(async () => {
        const result = await loadEligibleCounterpartsAction({
          referenceId: transactionId,
          referenceAmount: transactionAmount,
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
    [transactionId, transactionAmount],
  )

  // Fetch counterparts whenever the dialog first opens. The dialog is remounted
  // per transaction (key={pairTarget.id} in TransactionTable), so dateFrom/dateTo
  // are freshly initialised from this transaction's occurredAt — no stale window
  // from a previously-opened row.
  useEffect(() => {
    if (open) {
      fetchCounterparts(dateFrom, dateTo)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Close on successful pair creation (mirrors transaction-form-dialog.tsx pattern).
  useEffect(() => {
    if (submittedRef.current && state.error === null) {
      onOpenChange(false)
      toast.success('Transazione collegata.')
      submittedRef.current = false
      // Repaint the refund row: the server resolves which leg is the refund
      // (secondary) and whether its expense inherited a subcategory (decision 2).
      if (state.pairedSecondaryId) {
        const selectedCounterpart = counterparts.find((c) => c.id === selectedId)
        onPaired?.({
          secondaryTransactionId: state.pairedSecondaryId,
          subCategoryId: state.pairedSubCategoryId,
          counterpart: selectedCounterpart
            ? {
                id: selectedCounterpart.id,
                amount: selectedCounterpart.amount,
                description: selectedCounterpart.description,
                occurredAt: selectedCounterpart.occurredAt,
              }
            : undefined,
        })
      }
    }
  }, [state, onOpenChange, onPaired, counterparts, selectedId])

  // Re-fetch when date range changes (only while open).
  function handleDateFromChange(value: string) {
    setDateFrom(value)
    if (open) fetchCounterparts(value, dateTo)
  }

  function handleDateToChange(value: string) {
    setDateTo(value)
    if (open) fetchCounterparts(dateFrom, value)
  }

  // Reset all local state and close the dialog.
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setSearch('')
      setSelectedId(null)
      setCounterparts([])
      setLoadError(null)
      setDateFrom(offsetDateISO(transactionOccurredAt, -90))
      setDateTo(offsetDateISO(transactionOccurredAt, 90))
    }
    onOpenChange(nextOpen)
  }

  const filteredCounterparts = counterparts.filter((c) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    const title = (c.customTitle ?? c.description).toLowerCase()
    return title.includes(q)
  })

  const isNegativeRef = transactionAmount
    ? toDecimal(transactionAmount).isNegative()
    : true

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Collega rimborso</DialogTitle>
          <DialogDescription className="sr-only">
            Seleziona la transazione contropartita da collegare come rimborso.
          </DialogDescription>
        </DialogHeader>

        <form
          action={(fd) => {
            submittedRef.current = true
            formAction(fd)
          }}
          className="flex min-w-0 flex-col gap-4"
        >
          {/* Hidden fields required by createTransactionPairAction */}
          <input type="hidden" name="transactionId" value={transactionId} />
          <input type="hidden" name="counterpartId" value={selectedId ?? ''} />

          {/* Search filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="cp-search">
              Cerca contropartita
            </label>
            <Input
              id="cp-search"
              placeholder="Filtra per descrizione…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
            />
          </div>

          {/* Date range (D-13 — user can widen, defaulted to ±90 days) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="cp-date-from">
                Da data
              </label>
              <Input
                id="cp-date-from"
                type="date"
                className="min-w-0"
                value={dateFrom}
                onChange={(e) => handleDateFromChange(e.target.value)}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="cp-date-to">
                A data
              </label>
              <Input
                id="cp-date-to"
                type="date"
                className="min-w-0"
                value={dateTo}
                onChange={(e) => handleDateToChange(e.target.value)}
              />
            </div>
          </div>

          {/* Scrollable counterpart list */}
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-muted-foreground">
              Transazioni disponibili
            </p>
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
                    const isSelected = selectedId === cp.id
                    return (
                      <li key={cp.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(isSelected ? null : cp.id)}
                          className={`w-full px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50 ${
                            isSelected ? 'bg-primary/5 font-medium' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="min-w-0 flex-1 truncate">{label}</span>
                            <span className="shrink-0 font-mono tabular-nums text-xs">
                              {formatCounterpartAmount(cp.amount, isNegCp)}
                            </span>
                          </div>
                          <span className="block truncate text-xs text-muted-foreground">
                            {formatDate(cp.occurredAt)}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
            {/* Recap of the selected counterpart sign relationship */}
            {selectedId && (
              <p className="text-xs text-muted-foreground">
                {isNegativeRef ? 'Spesa' : 'Entrata'} collegata a una{' '}
                {isNegativeRef ? 'entrata' : 'uscita'} come rimborso.
              </p>
            )}
          </div>

          {/* Server error display (mirrors transaction-form-dialog.tsx pattern) */}
          {state.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Annulla
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending || !selectedId}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Collega
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
