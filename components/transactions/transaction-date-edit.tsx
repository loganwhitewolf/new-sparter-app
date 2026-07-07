'use client'
import { useActionState, useEffect, useRef, useState } from 'react'
import { Pencil } from 'lucide-react'
import { updateTransactionAction } from '@/lib/actions/transaction-edit'

type Props = {
  id: string
  occurredAt: Date
  onSuccess?: () => void
}

const dateFormatter = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function toInputValue(occurredAt: Date): string {
  return new Date(occurredAt).toISOString().slice(0, 10)
}

function formatDisplayDate(occurredAt: Date): string {
  return dateFormatter.format(new Date(occurredAt))
}

export function TransactionDateEdit({ id, occurredAt, onSuccess }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(() => toInputValue(occurredAt))
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
          setValue(toInputValue(occurredAt))
          setIsEditing(true)
        }}
        title="Clicca per modificare la data"
      >
        <span className="font-mono text-sm tabular-nums">{formatDisplayDate(occurredAt)}</span>
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
        type="date"
        name="occurredAt"
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
