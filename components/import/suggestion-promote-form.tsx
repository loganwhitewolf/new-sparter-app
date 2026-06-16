'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { AlertCircle, Loader2, Tag } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ClientMountIcon } from '@/components/ui/client-mount-icon'
import { SubcategoryPicker } from '@/components/categorization/subcategory-picker'
import { promoteSuggestionAction } from '@/lib/actions/patterns'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import type { PatternSuggestion } from '@/lib/utils/pattern-suggestions'
import type { PatternApplyResult } from '@/lib/validations/pattern'

type Props = {
  suggestion: PatternSuggestion
  categories: CategoryWithSubCategories[]
  fileId: string
  onPromoted: (applyResult: PatternApplyResult) => void
  disabled?: boolean
}

export function SuggestionPromoteForm({ suggestion, categories, fileId, onPromoted, disabled }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [subCategoryId, setSubCategoryId] = useState('')
  const [subCategoryLabel, setSubCategoryLabel] = useState<string | null>(null)
  const [state, formAction, isPending] = useActionState(promoteSuggestionAction, { error: null })
  const submittedRef = useRef(false)

  // submittedRef guards against the initial-render false positive
  // (state.error === null is also the initial state). See Pitfall 4.
  // state.applyResult must be present before calling onPromoted (Pitfall 3).
  useEffect(() => {
    if (submittedRef.current && state.error === null && state.applyResult) {
      submittedRef.current = false
      onPromoted(state.applyResult)
    }
  }, [state, onPromoted])

  function handlePickerChange(id: string) {
    setSubCategoryId(id)
    for (const cat of categories) {
      const sub = cat.subCategories.find((s) => String(s.id) === id)
      if (sub) {
        setSubCategoryLabel(sub.name)
        break
      }
    }
  }

  return (
    <form
      action={(formData) => {
        submittedRef.current = true
        formAction(formData)
      }}
      className="flex flex-col gap-4"
    >
      {/*
        Hidden inputs pre-filled from the suggestion.
        amountSign is intentionally NOT sent — the Server Action derives it server-side (ADR 0008).
        confidence is NOT sent — hardcoded to 1 server-side (T-39-09).
      */}
      <input type="hidden" name="pattern" value={suggestion.pattern} />
      <input type="hidden" name="subCategoryId" value={subCategoryId} />
      <input type="hidden" name="fileId" value={fileId} />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm">Sottocategoria</label>
        <Button
          type="button"
          variant="outline"
          className="justify-start font-normal"
          onClick={() => setPickerOpen(true)}
          disabled={disabled}
        >
          <ClientMountIcon icon={Tag} ariaHidden className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          {subCategoryLabel ?? 'Categorizza…'}
        </Button>
      </div>

      <SubcategoryPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        categories={categories}
        mostUsed={[]}
        allowedCategoryTypes={['in', 'out', 'transfer', 'allocation']}
        defaultType={null}
        onChange={handlePickerChange}
      />

      {state.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" size="sm" className="self-start" disabled={isPending || !subCategoryId || disabled}>
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
        Crea pattern
      </Button>
    </form>
  )
}
