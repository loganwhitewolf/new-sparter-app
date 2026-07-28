'use client'
import { useActionState, useEffect, useRef, useState } from 'react'
import { AlertCircle, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ClientMountIcon } from '@/components/ui/client-mount-icon'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { SubcategoryPicker } from '@/components/categorization/subcategory-picker'
import { createTransaction } from '@/lib/actions/transactions'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import type { MostUsedSubcategory } from '@/lib/dal/subcategory-usage'
import {
  maxMonthsForAmount,
  materializeInstalments,
  validateMonthsForAmount,
  type Instalment,
} from '@/lib/services/amortization-math'
import { formatAbsoluteAmount } from '@/lib/utils/format-amount'

type Props = {
  categories: CategoryWithSubCategories[]
  mostUsed: MostUsedSubcategory[]
}

// Same incremental-render technique as ActivateAmortizationDialog's preview table (Plan 77-01) —
// manual-entry N is expected to be small, but the same bounded-height + incremental-render
// approach applies if it grows (E1/E4 "overflow (long plan)" UI resolution, 77-01-SUMMARY.md).
const PREVIEW_CHUNK_SIZE = 50

const previewDateFormatter = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

function parseOccurredAtDate(value: string): Date | null {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function TransactionFormDialog({ categories, mostUsed }: Props) {
  const [open, setOpen] = useState(false)
  const [subCategoryId, setSubCategoryId] = useState<string>('')
  const [subCategoryLabel, setSubCategoryLabel] = useState<string>('')
  const [pickerOpen, setPickerOpen] = useState(false)

  const todayISO = new Date().toISOString().slice(0, 10)
  const [amountInput, setAmountInput] = useState('')
  const [occurredAtInput, setOccurredAtInput] = useState(todayISO)
  const [amortizationEnabled, setAmortizationEnabled] = useState(false)
  const [monthsInput, setMonthsInput] = useState('')
  const [visibleCount, setVisibleCount] = useState(PREVIEW_CHUNK_SIZE)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const [state, formAction, isPending] = useActionState(createTransaction, { error: null })
  const submittedRef = useRef(false)
  const submittedMonthsRef = useRef<number | null>(null)

  useEffect(() => {
    if (submittedRef.current && state.error === null) {
      setOpen(false)
      if (state.amortized && submittedMonthsRef.current !== null) {
        toast.success(`Transazione creata e ammortizzata su ${submittedMonthsRef.current} mesi.`)
      } else {
        toast.success('Transazione creata con successo.')
      }
      submittedRef.current = false
      submittedMonthsRef.current = null
    }
  }, [state])

  function resetFormState() {
    setSubCategoryId('')
    setSubCategoryLabel('')
    setAmountInput('')
    setOccurredAtInput(todayISO)
    setAmortizationEnabled(false)
    setMonthsInput('')
    setVisibleCount(PREVIEW_CHUNK_SIZE)
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      resetFormState()
    }
  }

  function handlePickerChange(selectedSubCategoryId: string) {
    setSubCategoryId(selectedSubCategoryId)
    // Resolve display label from categories tree
    const parentCat = categories.find((c) =>
      c.subCategories.some((s) => String(s.id) === selectedSubCategoryId)
    )
    const subCat = parentCat?.subCategories.find(
      (s) => String(s.id) === selectedSubCategoryId
    )
    // sub.name already reflects the override (DAL bakes customName into name at row-map time)
    const label = subCat ? subCat.name : ''
    setSubCategoryLabel(label)
  }

  // Same normalization the Server Action applies (amount.replace(',', '.')) — the client-side
  // preview must use the exact same math the write path re-validates, never drift on parsing.
  const normalizedAmount = amountInput.trim().replace(',', '.')
  const parsedAmount = normalizedAmount === '' ? NaN : Number(normalizedAmount)
  const isNegativeAmount = Number.isFinite(parsedAmount) && parsedAmount < 0
  const maxMonths = isNegativeAmount ? maxMonthsForAmount(normalizedAmount) : undefined

  const trimmedMonths = monthsInput.trim()
  const months = Number(trimmedMonths)
  const monthsValidation =
    isNegativeAmount && trimmedMonths !== ''
      ? validateMonthsForAmount(normalizedAmount, months)
      : { valid: false as const }

  const occurredAtDate = parseOccurredAtDate(occurredAtInput)
  const instalments: Instalment[] =
    monthsValidation.valid && occurredAtDate
      ? materializeInstalments(normalizedAmount, occurredAtDate, months)
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

  const visibleInstalments = instalments.slice(0, visibleCount)

  function handleAmortizationCheckedChange(checked: boolean) {
    setAmortizationEnabled(checked)
    if (!checked) {
      setMonthsInput('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <ClientMountIcon icon={Plus} className="mr-2 h-4 w-4" />
          Nuova transazione
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuova transazione</DialogTitle>
          <DialogDescription className="sr-only">
            Inserisci i dettagli della nuova transazione manuale.
          </DialogDescription>
        </DialogHeader>

        <form
          action={(fd) => {
            submittedRef.current = true
            submittedMonthsRef.current = amortizationEnabled ? months : null
            formAction(fd)
          }}
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="subCategoryId" value={subCategoryId} />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="tx-description">
              Descrizione <span className="text-destructive">*</span>
            </label>
            <Input
              id="tx-description"
              name="description"
              placeholder="es. Bolletta Enel, Stipendio..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="tx-amount">
                Importo <span className="text-destructive">*</span>
              </label>
              <Input
                id="tx-amount"
                name="amount"
                placeholder="es. -45,90"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="tx-date">
                Data <span className="text-destructive">*</span>
              </label>
              <Input
                id="tx-date"
                name="occurredAt"
                type="date"
                value={occurredAtInput}
                onChange={(e) => setOccurredAtInput(e.target.value)}
                required
              />
            </div>
          </div>

          <input type="hidden" name="currency" value="EUR" />

          {/* Sottocategoria */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Sottocategoria</label>
            <Button
              type="button"
              variant="outline"
              className="justify-start text-left font-normal"
              onClick={() => setPickerOpen(true)}
            >
              {subCategoryLabel || (
                <span className="text-muted-foreground">Categorizza…</span>
              )}
            </Button>
          </div>

          {/* Ammortamento inline (D-10) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="tx-amortize"
                checked={amortizationEnabled}
                onCheckedChange={(checked) => handleAmortizationCheckedChange(checked === true)}
              />
              <label className="text-sm font-medium" htmlFor="tx-amortize">
                Ammortizza questa transazione
              </label>
            </div>
            <input
              type="hidden"
              name="amortizationEnabled"
              value={amortizationEnabled ? 'on' : ''}
            />

            {amortizationEnabled && isNegativeAmount && (
              <div className="flex flex-col gap-1.5 pl-6">
                <label className="text-sm font-medium" htmlFor="tx-amortization-months">
                  Mesi
                </label>
                <Input
                  id="tx-amortization-months"
                  name="amortizationMonths"
                  type="number"
                  inputMode="numeric"
                  min={2}
                  placeholder={maxMonths ? `2–${maxMonths}` : '2'}
                  value={monthsInput}
                  onChange={(e) => setMonthsInput(e.target.value)}
                />
                {trimmedMonths !== '' && !monthsValidation.valid && (
                  <p className="text-xs text-destructive">{monthsValidation.reason}</p>
                )}
              </div>
            )}

            {/* WR-02: the months sub-form above only renders for a valid negative amount — when
                the checkbox is checked but the amount is empty, unparseable, or non-negative,
                surface the SAME outflow-only guard message activatePlanTx's eligibility check
                would eventually produce, instead of leaving the checkbox checked with no visible
                explanation for the later generic "Minimo 2 mesi." error. */}
            {amortizationEnabled && !isNegativeAmount && (
              <p className="pl-6 text-xs text-destructive">
                Puoi ammortizzare solo transazioni in uscita.
              </p>
            )}

            {monthsValidation.valid && (
              <div className="flex flex-col gap-1 pl-6">
                <p className="text-xs font-medium text-muted-foreground">
                  Anteprima della pianificazione
                </p>
                <div className="max-h-40 overflow-y-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b">
                        <th className="px-2 py-1 text-left font-medium">Data</th>
                        <th className="px-2 py-1 text-right font-medium">Importo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleInstalments.map((instalment, index) => (
                        <tr key={index} className="border-b last:border-0">
                          <td className="px-2 py-1">
                            {previewDateFormatter.format(instalment.date)}
                          </td>
                          <td className="px-2 py-1 text-right">
                            {formatAbsoluteAmount(instalment.amount, 'EUR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {visibleCount < instalments.length && <div ref={sentinelRef} className="h-2" />}
                </div>
              </div>
            )}
          </div>

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
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {amortizationEnabled ? 'Crea e ammortizza' : 'Crea transazione'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <SubcategoryPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        categories={categories}
        mostUsed={mostUsed}
        allowedCategoryTypes={['in', 'out', 'transfer', 'allocation']}
        defaultType={null}
        onChange={handlePickerChange}
      />
    </Dialog>
  )
}
