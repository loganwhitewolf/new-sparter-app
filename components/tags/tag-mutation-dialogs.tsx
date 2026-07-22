'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { AlertCircle, Loader2, Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
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
import { getNewTagSuggestionsAction } from '@/lib/actions/tag-suggestions'
import { archiveTagAction, createTagAction, updateTagAction } from '@/lib/actions/tags'
import type { TagRow } from '@/lib/dal/tags'
import type { TagSuggestionGroup } from '@/lib/services/tag-suggestions'
import type { ActionState } from '@/lib/validations/category'
import { TagCreationSuggestionsDialog } from './tag-creation-suggestions-dialog'

// ---------------------------------------------------------------------------
// Pure helpers — exported first, ahead of any component, so they are directly
// importable by the test file without rendering anything.
// ---------------------------------------------------------------------------

export function hasCompleteDateRange(dateRangeStart: string, dateRangeEnd: string): boolean {
  return dateRangeStart.trim() !== '' && dateRangeEnd.trim() !== ''
}

// Type-guard so callers get a narrowed `tagId: number` after the check, avoiding a redundant
// non-null assertion at the call site (D-08a: only fires when both a range was submitted AND
// the create succeeded with a returned tagId).
export function shouldOfferCreateSuggestions(
  state: { error: string | null; tagId?: number },
  hadRange: boolean,
): state is { error: null; tagId: number } {
  return state.error === null && typeof state.tagId === 'number' && hadRange
}

// Thin async wrapper so the test file can assert on this call in isolation, matching
// runCategorizeStep/runMergeStep's role in merge-expenses-dialog.test.tsx.
export async function runFetchNewTagSuggestions(tagId: number) {
  return getNewTagSuggestionsAction({ tagId })
}

function useDialogAction(
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>,
  successMessage: string,
  onSuccess?: () => void,
) {
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(action, { error: null })
  const submittedRef = useRef(false)

  useEffect(() => {
    if (submittedRef.current && state.error === null) {
      toast.success(successMessage)
      submittedRef.current = false
      setOpen(false)
      onSuccess?.()
    }
  }, [onSuccess, state, successMessage])

  function submit(formData: FormData) {
    submittedRef.current = true
    formAction(formData)
  }

  return { open, setOpen, state, submit, isPending }
}

function SubmitButton({
  children,
  isPending,
  variant = 'default',
}: {
  children: string
  isPending: boolean
  variant?: 'default' | 'destructive'
}) {
  return (
    <Button type="submit" variant={variant} disabled={isPending}>
      {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </Button>
  )
}

function ActionError({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  )
}

// D-02: a duplicate name (case/whitespace-insensitive) is surfaced inline via
// createTagAction's error return (ActionError below) — no crash, no duplicate row.
// D-08a: on success with a complete date range, fetches suggestions and — only when matches
// exist — opens TagCreationSuggestionsDialog. An empty/null group is a silent no-op.
export function CreateTagDialog() {
  const [open, setOpen] = useState(false)
  const [dateRangeStart, setDateRangeStart] = useState('')
  const [dateRangeEnd, setDateRangeEnd] = useState('')
  const [suggestionsGroup, setSuggestionsGroup] = useState<TagSuggestionGroup | null>(null)
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(createTagAction, { error: null })
  const submittedRef = useRef(false)
  // Captured at submit time, before the DOM form reset that follows a successful
  // useActionState submission would otherwise make the two controlled inputs' current values
  // unreliable to re-read after the fact.
  const hadRangeRef = useRef(false)

  useEffect(() => {
    if (!submittedRef.current) return
    submittedRef.current = false
    if (state.error !== null) return

    toast.success('Tag creato.')
    setOpen(false)
    setDateRangeStart('')
    setDateRangeEnd('')

    if (shouldOfferCreateSuggestions(state, hadRangeRef.current)) {
      void runFetchNewTagSuggestions(state.tagId).then(({ group }) => {
        if (group && group.matches.length > 0) {
          setSuggestionsGroup(group)
          setSuggestionsOpen(true)
        }
      })
    }
  }, [state])

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" aria-label="Crea tag">
            <ClientMountIcon icon={Plus} ariaHidden className="mr-2 h-4 w-4" />
            Nuovo tag
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuovo tag</DialogTitle>
            <DialogDescription>
              Crea un tag per organizzare le tue transazioni. L&apos;intervallo di date è
              opzionale.
            </DialogDescription>
          </DialogHeader>
          <form
            action={(formData) => {
              hadRangeRef.current = hasCompleteDateRange(dateRangeStart, dateRangeEnd)
              submittedRef.current = true
              formAction(formData)
            }}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="tag-name-new">
                Nome tag
              </label>
              <Input id="tag-name-new" name="name" required placeholder="es. Vacanza Sharm 2026" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" htmlFor="tag-date-start-new">
                  Da
                </label>
                <Input
                  id="tag-date-start-new"
                  type="date"
                  name="dateRangeStart"
                  value={dateRangeStart}
                  onChange={(e) => setDateRangeStart(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" htmlFor="tag-date-end-new">
                  A
                </label>
                <Input
                  id="tag-date-end-new"
                  type="date"
                  name="dateRangeEnd"
                  value={dateRangeEnd}
                  onChange={(e) => setDateRangeEnd(e.target.value)}
                />
              </div>
            </div>
            <ActionError error={state.error} />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Annulla
                </Button>
              </DialogClose>
              <SubmitButton isPending={isPending}>Crea tag</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {suggestionsGroup && (
        <TagCreationSuggestionsDialog
          open={suggestionsOpen}
          onOpenChange={setSuggestionsOpen}
          group={suggestionsGroup}
        />
      )}
    </>
  )
}

// D-03: changes both name and date range after creation. NEVER calls
// runFetchNewTagSuggestions/getNewTagSuggestionsAction anywhere — the create-time suggestion
// trigger fires only from CreateTagDialog, never from an edit.
export function EditTagDialog({ tag }: { tag: TagRow }) {
  const { open, setOpen, state, submit, isPending } = useDialogAction(
    updateTagAction,
    'Tag aggiornato.',
  )

  const defaultStart = tag.dateRangeStart ? tag.dateRangeStart.toISOString().slice(0, 10) : ''
  const defaultEnd = tag.dateRangeEnd ? tag.dateRangeEnd.toISOString().slice(0, 10) : ''

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Modifica tag ${tag.name}`}
        >
          <ClientMountIcon icon={Pencil} ariaHidden className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Modifica tag</DialogTitle>
          <DialogDescription>
            Puoi aggiornare nome e intervallo di date. La modifica dell&apos;intervallo non
            genera nuovi suggerimenti automatici: governa solo i prossimi import.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={tag.id} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor={`tag-name-${tag.id}`}>
              Nome tag
            </label>
            <Input id={`tag-name-${tag.id}`} name="name" defaultValue={tag.name} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor={`tag-date-start-${tag.id}`}>
                Da
              </label>
              <Input
                id={`tag-date-start-${tag.id}`}
                type="date"
                name="dateRangeStart"
                defaultValue={defaultStart}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor={`tag-date-end-${tag.id}`}>
                A
              </label>
              <Input
                id={`tag-date-end-${tag.id}`}
                type="date"
                name="dateRangeEnd"
                defaultValue={defaultEnd}
              />
            </div>
          </div>
          <ActionError error={state.error} />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Annulla
              </Button>
            </DialogClose>
            <SubmitButton isPending={isPending}>Salva modifiche</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// D-04: archive-only lifecycle-ending action. Calls archiveTagAction only — this is the sole
// lifecycle-ending action anywhere in this UI. The tag remains selectable in assignment and
// queryable in filters after archiving.
export function ArchiveTagDialog({ tag }: { tag: TagRow }) {
  const { open, setOpen, state, submit, isPending } = useDialogAction(
    archiveTagAction,
    'Tag archiviato.',
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="destructive" size="sm" aria-label={`Archivia tag ${tag.name}`}>
          Archivia
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Archivia tag</DialogTitle>
          <DialogDescription>
            Il tag verrà archiviato: resterà selezionabile nelle assegnazioni e ricercabile nei
            filtri, non viene rimosso.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={tag.id} />
          <ActionError error={state.error} />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Annulla
              </Button>
            </DialogClose>
            <SubmitButton isPending={isPending} variant="destructive">
              Archivia
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
