'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { promoteSuggestionAction } from '@/lib/actions/patterns'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import type { PatternSuggestion } from '@/lib/utils/pattern-suggestions'

type Props = {
  suggestion: PatternSuggestion
  categories: CategoryWithSubCategories[]
  onPromoted: () => void
}

export function SuggestionPromoteForm({ suggestion, categories, onPromoted }: Props) {
  const [categoryId, setCategoryId] = useState('')
  const [subCategoryId, setSubCategoryId] = useState('')
  const [state, formAction, isPending] = useActionState(promoteSuggestionAction, { error: null })
  const submittedRef = useRef(false)

  const selectedCategory = useMemo(
    () => categories.find((category) => String(category.id) === categoryId),
    [categories, categoryId],
  )

  // submittedRef guards against the initial-render false positive
  // (state.error === null is also the initial state). See Pitfall 4.
  useEffect(() => {
    if (submittedRef.current && state.error === null) {
      submittedRef.current = false
      onPromoted()
    }
  }, [state, onPromoted])

  function handleCategoryChange(value: string) {
    setCategoryId(value)
    setSubCategoryId('') // reset subcategory when category changes
  }

  return (
    <form
      action={(formData) => {
        submittedRef.current = true
        formAction(formData)
      }}
      className="flex flex-col gap-4"
    >
      {/* Hidden inputs pre-filled from the suggestion. */}
      {/* NOTE: `confidence` is intentionally NOT a hidden input — the Server Action hardcodes 0.85. */}
      <input type="hidden" name="pattern" value={suggestion.pattern} />
      <input type="hidden" name="amountSign" value={suggestion.detectedAmountSign} />
      <input type="hidden" name="subCategoryId" value={subCategoryId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm" htmlFor={`promote-category-${suggestion.pattern}`}>
            Categoria
          </label>
          <Select value={categoryId} onValueChange={handleCategoryChange}>
            <SelectTrigger id={`promote-category-${suggestion.pattern}`} className="w-full">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={String(category.id)}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm" htmlFor={`promote-subcategory-${suggestion.pattern}`}>
            Sottocategoria
          </label>
          <Select
            value={subCategoryId}
            onValueChange={setSubCategoryId}
            disabled={!selectedCategory}
          >
            <SelectTrigger id={`promote-subcategory-${suggestion.pattern}`} className="w-full">
              <SelectValue placeholder="Sottocategoria" />
            </SelectTrigger>
            <SelectContent>
              {selectedCategory?.subCategories.map((subCategory) => (
                <SelectItem key={subCategory.id} value={String(subCategory.id)}>
                  {subCategory.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {state.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" size="sm" className="self-start" disabled={isPending || !subCategoryId}>
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
        Crea pattern
      </Button>
    </form>
  )
}
