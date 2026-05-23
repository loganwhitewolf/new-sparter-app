'use client'

import { useCallback, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SuggestionPromoteForm } from './suggestion-promote-form'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import type { PatternSuggestion } from '@/lib/utils/pattern-suggestions'

type Props = {
  suggestion: PatternSuggestion
  categories: CategoryWithSubCategories[]
}

export function SuggestionCard({ suggestion, categories }: Props) {
  const [promoted, setPromoted] = useState(false)
  const [showSamples, setShowSamples] = useState(false)

  const handlePromoted = useCallback(() => setPromoted(true), [])

  const sampleCount = suggestion.sampleDescriptions.length
  const samplesId = `samples-${suggestion.pattern}`

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <code className="font-mono text-sm bg-muted px-2 py-1 rounded">
                {suggestion.pattern}
              </code>
              <Badge variant="secondary">{suggestion.matchCount} match</Badge>
            </div>
            {promoted && (
              <Badge
                variant="outline"
                className="border-green-600 text-green-700 dark:text-green-400"
              >
                Pattern creato
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-0">
        {sampleCount > 0 && (
          <>
            <button
              type="button"
              className="self-start text-xs text-muted-foreground underline underline-offset-2"
              aria-expanded={showSamples}
              aria-controls={samplesId}
              onClick={() => setShowSamples((v) => !v)}
            >
              {showSamples ? 'Nascondi esempi' : `Mostra ${sampleCount} esempi`}
            </button>
            {showSamples && (
              <ul id={samplesId} className="flex flex-col gap-1">
                {suggestion.sampleDescriptions.map((sample, i) => (
                  <li key={i} className="text-xs text-muted-foreground truncate">
                    {sample}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <div className={promoted ? 'opacity-50 pointer-events-none' : undefined}>
          <SuggestionPromoteForm
            suggestion={suggestion}
            categories={categories}
            onPromoted={handlePromoted}
            disabled={promoted}
          />
        </div>
      </CardContent>
    </Card>
  )
}
