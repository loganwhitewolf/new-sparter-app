'use client'

import { SuggestionCard } from './suggestion-card'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import type { PatternSuggestion } from '@/lib/utils/pattern-suggestions'

type Props = {
  suggestions: PatternSuggestion[]
  categories: CategoryWithSubCategories[]
  fileId: string
  platformId: number
}

export function SuggestionSection({ suggestions, categories, fileId, platformId }: Props) {
  if (suggestions.length === 0) return null

  return (
    <section aria-label="Suggerimenti pattern" className="flex flex-col gap-4">
      <h2 className="text-base font-semibold">
        Suggerimenti pattern ({suggestions.length})
      </h2>
      <div className="flex flex-col gap-4">
        {suggestions.map((suggestion, index) => (
          <SuggestionCard
            key={`${suggestion.pattern}-${index}`}
            suggestion={suggestion}
            categories={categories}
            fileId={fileId}
            platformId={platformId}
          />
        ))}
      </div>
    </section>
  )
}
