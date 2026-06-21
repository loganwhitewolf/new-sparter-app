'use client'

import { SuggestionCard } from './suggestion-card'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import type { PatternSuggestion } from '@/lib/utils/pattern-suggestions'
import type { SingleCategorizationSuggestion } from '@/lib/services/regex-discovery'

type Props = {
  suggestions: PatternSuggestion[]
  singleSuggestions?: SingleCategorizationSuggestion[]
  categories: CategoryWithSubCategories[]
  fileId: string
}

export function SuggestionSection({ suggestions, singleSuggestions, categories, fileId }: Props) {
  if (suggestions.length === 0 && (singleSuggestions?.length ?? 0) === 0) return null

  return (
    <div className="flex flex-col gap-6">
      {suggestions.length > 0 && (
        <section aria-label="Suggerimenti pattern" className="flex flex-col gap-4">
          <div>
            <h2 className="text-base font-semibold">Pattern proposti</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Crea un pattern per categorizzare automaticamente queste transazioni nelle importazioni future.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            {suggestions.map((suggestion, index) => (
              <SuggestionCard
                key={`${suggestion.pattern}-${index}`}
                suggestion={suggestion}
                categories={categories}
                fileId={fileId}
              />
            ))}
          </div>
        </section>
      )}

      {singleSuggestions && singleSuggestions.length > 0 && (
        <section aria-label="Transazioni identiche senza categoria" className="flex flex-col gap-4">
          <div>
            <h2 className="text-base font-semibold">
              Transazioni identiche ({singleSuggestions.length})
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Queste descrizioni compaiono più volte ma non generano un pattern automatizzabile. Categorizzale manualmente dalla pagina Spese.
            </p>
          </div>
          <ul className="flex flex-col gap-2">
            {singleSuggestions.map((item, index) => (
              <li key={`${item.normalizedDescription}-${index}`} className="flex items-center justify-between rounded-md border px-4 py-3 text-sm">
                <span className="font-medium">
                  {item.sampleDescriptions[0] ?? item.normalizedDescription}
                </span>
                <span className="ml-4 shrink-0 text-muted-foreground">
                  {item.matchCount} {item.matchCount === 1 ? 'transazione' : 'transazioni'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
