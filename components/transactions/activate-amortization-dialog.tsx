'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
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
import { createAmortizationPlan } from '@/lib/actions/amortization'
import {
  materializeInstalments,
  validateMonthsForAmount,
  type Instalment,
} from '@/lib/services/amortization-math'
import { formatAbsoluteAmount } from '@/lib/utils/format-amount'

// Same incremental-render technique as transaction-table.tsx's loadMoreRef block, but sliced
// from the already-computed in-memory instalments array (no server round-trip needed — the
// preview's data source is a pure function, not a paginated query).
const PREVIEW_CHUNK_SIZE = 50

const previewDateFormatter = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  transactionId: string
  amount: string
  occurredAt: Date
  onSuccess: (result: { planId: string; expenseId: string; instalments: Instalment[] }) => void
}

export function ActivateAmortizationDialog({
  open,
  onOpenChange,
  transactionId,
  amount,
  occurredAt,
  onSuccess,
}: Props) {
  const [monthsInput, setMonthsInput] = useState('')
  const [pending, setPending] = useState(false)
  const [visibleCount, setVisibleCount] = useState(PREVIEW_CHUNK_SIZE)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // Dialog reopens empty every time (D-01) — the months value from a previous, unrelated open
  // must never linger. On a write-failure retry the dialog stays open instead (handleConfirm's
  // catch never calls onOpenChange), so monthsInput is preserved without re-running this effect.
  useEffect(() => {
    if (open) {
      setMonthsInput('')
      setVisibleCount(PREVIEW_CHUNK_SIZE)
    }
  }, [open])

  const trimmedMonths = monthsInput.trim()
  const months = Number(trimmedMonths)
  const validation =
    trimmedMonths === '' ? { valid: false as const } : validateMonthsForAmount(amount, months)
  const instalments: Instalment[] = validation.valid
    ? materializeInstalments(amount, occurredAt, months)
    : []

  useEffect(() => {
    setVisibleCount(PREVIEW_CHUNK_SIZE)
  }, [monthsInput])

  useEffect(() => {
    const target = sentinelRef.current
    if (!target || visibleCount >= instalments.length) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((count) => Math.min(count + PREVIEW_CHUNK_SIZE, instalments.length))
        }
      },
      { rootMargin: '160px 0px' },
    )

    observer.observe(target)
    return () => observer.disconnect()
  }, [visibleCount, instalments.length])

  async function handleConfirm() {
    if (!validation.valid) {
      return
    }

    setPending(true)
    const result = await createAmortizationPlan({ transactionId, months })
    setPending(false)

    if (result.error) {
      // Dialog stays open, months value preserved (E1 error state) — no onOpenChange(false) here.
      toast.error(result.error)
      return
    }

    toast.success(`Transazione dilazionata su ${months} mesi.`)
    onOpenChange(false)
    onSuccess({
      planId: result.planId,
      expenseId: result.expenseId,
      instalments: result.instalments as Instalment[],
    })
  }

  const visibleInstalments = instalments.slice(0, visibleCount)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dilaziona transazione</DialogTitle>
          <DialogDescription>
            Distribuisci il costo su più mesi. Ogni rata sarà uniforme, a partire dalla data di
            acquisto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="amortization-months">
            Mesi
          </label>
          <Input
            id="amortization-months"
            type="number"
            inputMode="numeric"
            min={2}
            value={monthsInput}
            onChange={(e) => setMonthsInput(e.target.value)}
            disabled={pending}
            autoFocus
          />
          <p
            className={
              validation.valid || trimmedMonths === ''
                ? 'text-sm text-muted-foreground'
                : 'text-sm text-destructive'
            }
          >
            {validation.valid || trimmedMonths === ''
              ? 'Minimo 2 mesi. Ogni rata deve essere almeno €0,01.'
              : validation.reason}
          </p>
        </div>

        {validation.valid && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Anteprima della pianificazione</p>
            <div className="max-h-64 overflow-y-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left font-medium">Data</th>
                    <th className="px-3 py-2 text-right font-medium">Importo</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleInstalments.map((instalment, index) => (
                    <tr key={index} className="border-b last:border-0">
                      <td className="px-3 py-2">{previewDateFormatter.format(instalment.date)}</td>
                      <td className="px-3 py-2 text-right">
                        {formatAbsoluteAmount(instalment.amount, 'EUR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visibleCount < instalments.length && <div ref={sentinelRef} className="h-4" />}
            </div>
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost" disabled={pending}>
              Annulla
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleConfirm} disabled={pending || !validation.valid}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Dilaziona'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
