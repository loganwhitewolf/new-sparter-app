'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { Pencil } from 'lucide-react'
import { updateExpense } from '@/lib/actions/expenses'

type Props = {
  id: string
  title: string
  notes: string | null
  onSuccess?: (newNotes: string) => void
}

export function ExpenseNotesEdit({ id, title, notes, onSuccess }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(notes ?? '')
  const [state, formAction, isPending] = useActionState(updateExpense, {
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
      <button
        type="button"
        className="flex min-w-0 max-w-full items-start gap-1 text-left"
        onClick={() => {
          setValue(notes ?? '')
          setIsEditing(true)
        }}
        title="Clicca per modificare le note di questa spesa"
      >
        {notes ? (
          <span className="min-w-0 whitespace-pre-wrap text-sm">{notes}</span>
        ) : (
          <span className="text-sm text-muted-foreground">Aggiungi note</span>
        )}
        <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100" />
      </button>
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
        {/* UpdateExpenseSchema requires title; pass the current title unchanged
            so a notes-only edit never touches it. subCategoryId is intentionally
            omitted from this form's FormData so the three-state contract (DET-04)
            leaves category/status untouched on a notes-only save. */}
        <input type="hidden" name="title" value={title} />
        <textarea
          name="notes"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded border border-input bg-background px-2 py-1 text-sm leading-tight outline-none ring-ring focus:ring-1"
          rows={3}
          autoFocus
          disabled={isPending}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setIsEditing(false)
          }}
        />
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
            onClick={() => {
              setValue(notes ?? '')
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
