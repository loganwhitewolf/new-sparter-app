'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { updateExpenseTitle } from '@/lib/actions/expenses'
import { expenseDetailHref } from '@/lib/routes'

const MIN_TITLE_LENGTH = 2

type Props = {
  id: string
  title: string
  onSuccess?: (newTitle: string) => void
}

export function ExpenseTitleEdit({ id, title, onSuccess }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(title)
  const [state, formAction, isPending] = useActionState(updateExpenseTitle, {
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
      <div className="flex min-w-0 max-w-full items-center gap-1">
        <Link href={expenseDetailHref(id)} className="block min-w-0 flex-1">
          <span className="block min-w-0 truncate font-mono text-sm tracking-tight" title={title}>
            {title}
          </span>
        </Link>
        <button
          type="button"
          aria-label="Rinomina spesa"
          onClick={() => {
            setValue(title)
            setIsEditing(true)
          }}
          title="Clicca per modificare il nome di questa spesa"
        >
          <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <form
        action={(fd) => {
          const trimmedValue = value.trim()
          submittedRef.current = true
          pendingValueRef.current = trimmedValue
          fd.set('title', trimmedValue)
          formAction(fd)
        }}
        className="flex min-w-0 flex-col gap-1.5"
      >
        <input type="hidden" name="id" value={id} />
        <input
          name="title"
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
          Modifica il nome della spesa aggregata, senza cambiare le transazioni collegate.
        </p>
        {state.error ? (
          <p className="text-xs text-destructive">{state.error}</p>
        ) : null}
        <div className="flex gap-1.5">
          <button
            type="submit"
            disabled={isPending || value.trim().length < MIN_TITLE_LENGTH}
            className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? 'Salvo…' : 'Salva'}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              setValue(title)
              setIsEditing(false)
            }}
            className="rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            Annulla
          </button>
        </div>
      </form>
    </div>
  )
}
