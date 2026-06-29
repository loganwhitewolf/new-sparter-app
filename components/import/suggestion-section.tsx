'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SuggestionCard } from './suggestion-card'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import { APP_ROUTES } from '@/lib/routes'
import type { PatternSuggestion } from '@/lib/utils/pattern-suggestions'
import type { SingleCategorizationSuggestion } from '@/lib/services/regex-discovery'
import { formatAbsoluteAmount } from '@/lib/utils/format-amount'

type Props = {
  suggestions: PatternSuggestion[]
  singleSuggestions?: SingleCategorizationSuggestion[]
  categories: CategoryWithSubCategories[]
  fileId: string
}

export function shouldRedirectToImportList({
  regexSuggestionCount,
  promotedCount,
}: {
  regexSuggestionCount: number
  promotedCount: number
}) {
  return regexSuggestionCount > 0 && promotedCount >= regexSuggestionCount
}

export function SuggestionSection({ suggestions, singleSuggestions, categories, fileId }: Props) {
  const router = useRouter()
  const [promotedCount, setPromotedCount] = useState(0)
  const redirectScheduledRef = useRef(false)

  const handleRegexPromoted = useCallback(() => {
    setPromotedCount((count) => count + 1)
  }, [])

  useEffect(() => {
    if (
      shouldRedirectToImportList({
        regexSuggestionCount: suggestions.length,
        promotedCount,
      }) &&
      !redirectScheduledRef.current
    ) {
      redirectScheduledRef.current = true
      router.push(APP_ROUTES.import)
    }
  }, [promotedCount, router, suggestions.length])

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
                onRegexPromoted={handleRegexPromoted}
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
                <div className="ml-4 flex shrink-0 items-center gap-3">
                  {item.sampleAmounts[0] != null && (
                    <span className={`tabular-nums ${Number(item.sampleAmounts[0]) < 0 ? 'text-destructive' : 'text-green-600'}`}>
                      {(Number(item.sampleAmounts[0]) < 0 ? '−' : '+') + ' ' + formatAbsoluteAmount(item.sampleAmounts[0])}
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {item.matchCount} {item.matchCount === 1 ? 'transazione' : 'transazioni'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
