'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { Pencil } from 'lucide-react'
import { updateReimbursementTitleAction } from '@/lib/actions/reimbursement'
import { resolveReimbursementDisplayTitle } from '@/lib/utils/reimbursement-format'

type Props = {
  id: number
  title: string
  anchorTitle: string
  onSuccess?: (newTitle: string) => void
}

/**
 * `/reimbursements/[id]`'s inline edit-title control (Phase 76 Plan 05, RMB-11) — mirrors
 * `TransactionTitleEdit`'s `variant="detail"` structure (pencil-toggle inline edit,
 * `useActionState`, a hidden id input), adapted for a reimbursement instead of a transaction.
 *
 * The DISPLAYED (non-editing) text is `resolveReimbursementDisplayTitle(title, anchorTitle)`
 * (D-03 fallback), while the EDIT input's initial value is the raw `title` — so clearing it back
 * to '' is possible and meaningful (it reverts the displayed title to the anchor's own title,
 * D-03), not pre-filled with the fallback.
 */
export function ReimbursementTitleEdit({ id, title, anchorTitle, onSuccess }: Props) {
  const displayTitle = resolveReimbursementDisplayTitle(title, anchorTitle)
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(title)
  const [state, formAction, isPending] = useActionState(updateReimbursementTitleAction, {
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
      <div className="flex min-w-0 items-center gap-2">
        <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight">{displayTitle}</h1>
        <button
          type="button"
          aria-label="Modifica titolo"
          onClick={() => {
            setValue(title)
            setIsEditing(true)
          }}
          title="Clicca per modificare il titolo di questo rimborso"
        >
          <Pencil className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <form
        action={(fd) => {
          submittedRef.current = true
          pendingValueRef.current = value
          formAction(fd)
        }}
        className="flex min-w-0 flex-col gap-1.5"
      >
        <input type="hidden" name="reimbursementId" value={id} />
        <input
          name="title"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full max-w-md rounded border border-input bg-background px-2 py-1 text-lg font-semibold leading-tight outline-none ring-ring focus:ring-1"
          autoFocus
          disabled={isPending}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setIsEditing(false)
          }}
        />
        <p className="text-xs text-muted-foreground">
          Lascia vuoto per usare il titolo della spesa collegata.
        </p>
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
    </div>
  )
}
