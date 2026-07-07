'use client'
import { useActionState, useEffect, useRef, useState } from 'react'
import { Pencil } from 'lucide-react'
import { updateTransactionAction } from '@/lib/actions/transaction-edit'
import { toDecimal } from '@/lib/utils/decimal'

type Props = {
  id: string
  amount: string
  currency: string
  onSuccess?: () => void
}

/**
 * Signed Italian-format amount for display and edit prefill (D-06 — this page
 * shows the real sign, unlike the absolute-value table columns).
 */
function formatSignedAmount(amount: string, currency: string): string {
  try {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: currency || 'EUR',
    }).format(Number(toDecimal(amount)))
  } catch {
    return amount
  }
}

/**
 * Plain decimal string (no currency symbol/spacing) for seeding the editable
 * input — must round-trip through UpdateTransactionSchema's comma-to-dot refine.
 */
function toEditableAmount(amount: string): string {
  return toDecimal(amount).toFixed(2).replace('.', ',')
}

export function TransactionAmountEdit({ id, amount, currency, onSuccess }: Props) {
  const displayAmount = formatSignedAmount(amount, currency)
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(() => toEditableAmount(amount))
  const [state, formAction, isPending] = useActionState(updateTransactionAction, {
    error: null,
  })
  const submittedRef = useRef(false)
  const pendingValueRef = useRef('')

  useEffect(() => {
    if (submittedRef.current && state.error === null) {
      submittedRef.current = false
      setIsEditing(false)
      onSuccess?.()
    }
  }, [state, onSuccess])

  if (!isEditing) {
    return (
      <button
        type="button"
        className="flex items-center gap-1.5 text-left"
        onClick={() => {
          setValue(toEditableAmount(amount))
          setIsEditing(true)
        }}
        title="Clicca per modificare l'importo"
      >
        <span className="font-mono tabular-nums font-medium">{displayAmount}</span>
        <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>
    )
  }

  return (
    <form
      action={(fd) => {
        submittedRef.current = true
        pendingValueRef.current = value
        formAction(fd)
      }}
      className="flex flex-col gap-1.5"
    >
      <input type="hidden" name="id" value={id} />
      <input
        name="amount"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full rounded border border-input bg-background px-2 py-1 text-sm font-medium"
        autoFocus
        disabled={isPending}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setIsEditing(false)
        }}
      />
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
      <div className="flex gap-1.5">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? 'Salvo…' : 'Salva'}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => setIsEditing(false)}
          className="rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          Annulla
        </button>
      </div>
    </form>
  )
}
