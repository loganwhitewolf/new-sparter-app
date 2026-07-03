'use client'
import { useActionState, useEffect, useRef, useState } from 'react'
import { Pencil } from 'lucide-react'
import { updateTransactionCustomTitle } from '@/lib/actions/transactions'

type Props = {
  id: string
  description: string
  customTitle: string | null
  /** Title of the linked expense (transaction.expenseTitle) — display fallback between customTitle and the raw bank description. */
  fallbackTitle?: string | null
  onSuccess?: (newTitle: string) => void
}

export function TransactionTitleEdit({
  id,
  description,
  customTitle,
  fallbackTitle,
  onSuccess,
}: Props) {
  const displayTitle = customTitle ?? fallbackTitle ?? description
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(displayTitle)
  const [state, formAction, isPending] = useActionState(updateTransactionCustomTitle, {
    error: null,
  })
  const submittedRef = useRef(false)
  const pendingValueRef = useRef('')

  useEffect(() => {
    if (submittedRef.current && state.error === null) {
      submittedRef.current = false
      setIsEditing(false)
      onSuccess?.(pendingValueRef.current)
    }
  }, [state, onSuccess])

  if (!isEditing) {
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <button
          type="button"
          className="flex min-w-0 items-center gap-1 text-left"
          onClick={() => {
            setValue(customTitle ?? fallbackTitle ?? description)
            setIsEditing(true)
          }}
          title="Clicca per modificare il titolo di questa transazione"
        >
          <span className="truncate font-medium tracking-tight" title={description}>
            {displayTitle}
          </span>
          <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
        {customTitle ? (
          <span
            className="truncate text-xs text-muted-foreground"
            title={description}
          >
            Originale: {description}
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <form
        action={(fd) => {
          submittedRef.current = true
          pendingValueRef.current = value
          formAction(fd)
        }}
        className="flex min-w-0 flex-col gap-1.5"
      >
        <input type="hidden" name="id" value={id} />
        <input
          name="customTitle"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded border border-input bg-background px-2 py-1 text-sm font-medium leading-tight outline-none ring-ring focus:ring-1"
          autoFocus
          disabled={isPending}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setIsEditing(false)
          }}
        />
        <p className="text-xs text-muted-foreground">
          Modifica il titolo di questa transazione (non modifica il titolo della
          spesa aggregata).
        </p>
        {state.error ? (
          <p className="text-xs text-destructive">{state.error}</p>
        ) : null}
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
    </div>
  )
}
