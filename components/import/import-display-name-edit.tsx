'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { Pencil } from 'lucide-react'
import { updateImportDisplayNameAction } from '@/lib/actions/import'

type Props = {
  fileId: string
  displayName: string | null
  originalName: string
  onSuccess?: (displayName: string | null) => void
}

function getDisplayTitle(displayName: string | null, originalName: string) {
  return displayName?.trim() || originalName
}

export function ImportDisplayNameEdit({
  fileId,
  displayName,
  originalName,
  onSuccess,
}: Props) {
  const displayTitle = getDisplayTitle(displayName, originalName)
  const hasCustomName = Boolean(displayName?.trim())
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(displayName?.trim() ?? '')
  const [state, formAction, isPending] = useActionState(updateImportDisplayNameAction, {
    error: null,
  })
  const submittedRef = useRef(false)
  const pendingValueRef = useRef<string | null>(null)

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
            setValue(displayName?.trim() ?? '')
            setIsEditing(true)
          }}
          title="Clicca per modificare il nome di questa importazione"
          aria-label={`Rinomina importazione ${displayTitle}`}
        >
          <span className="truncate font-medium tracking-tight" title={displayTitle}>
            {displayTitle}
          </span>
          <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100" />
        </button>
        {hasCustomName ? (
          <span className="truncate text-xs text-muted-foreground" title={originalName}>
            {originalName}
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
          const trimmed = value.trim()
          pendingValueRef.current = trimmed ? trimmed : null
          fd.set('fileId', fileId)
          fd.set('displayName', trimmed)
          formAction(fd)
        }}
        className="flex min-w-0 flex-col gap-1.5"
      >
        <input type="hidden" name="fileId" value={fileId} />
        <input
          name="displayName"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded border border-input bg-background px-2 py-1 text-sm font-medium leading-tight outline-none ring-ring focus:ring-1"
          autoFocus
          disabled={isPending}
          maxLength={255}
          placeholder={originalName}
          aria-label="Nome importazione"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setValue(displayName?.trim() ?? '')
              setIsEditing(false)
            }
          }}
        />
        <p className="text-xs text-muted-foreground">
          Lascia vuoto per mostrare di nuovo il nome file originale.
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
            onClick={() => {
              setValue(displayName?.trim() ?? '')
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
