'use client'

import { useCallback, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SuggestionPromoteForm } from './suggestion-promote-form'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import type { PatternSuggestion } from '@/lib/utils/pattern-suggestions'
import type { PatternApplyResult } from '@/lib/validations/pattern'
import { formatAbsoluteAmount } from '@/lib/utils/format-amount'

type Props = {
  suggestion: PatternSuggestion
  categories: CategoryWithSubCategories[]
  fileId: string
  /** @internal test-only: pre-seeds the applyResult state for SSR snapshot tests */
  initialApplyResult?: PatternApplyResult | null
}

export function SuggestionCard({ suggestion, categories, fileId, initialApplyResult = null }: Props) {
  const [promoted, setPromoted] = useState(initialApplyResult != null)
  const [applyResult, setApplyResult] = useState<PatternApplyResult | null>(initialApplyResult)
  const [showSamples, setShowSamples] = useState(false)

  const handlePromoted = useCallback((result: PatternApplyResult) => {
    setPromoted(true)
    setApplyResult(result)
  }, [])

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
        {applyResult && (
          <p className="text-sm text-muted-foreground">
            {applyResult.updatedCount} categorizzate · {applyResult.notUpdatedCount} ancora senza match
          </p>
        )}
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
                  <li key={i} className="flex items-start justify-between gap-2 text-xs text-muted-foreground">
                    <span className="break-words min-w-0">{sample}</span>
                    {suggestion.sampleAmounts[i] != null && (
                      <span className={`shrink-0 tabular-nums ${Number(suggestion.sampleAmounts[i]) < 0 ? 'text-destructive' : 'text-green-600'}`}>
                        {(Number(suggestion.sampleAmounts[i]) < 0 ? '−' : '+') + ' ' + formatAbsoluteAmount(suggestion.sampleAmounts[i]!)}
                      </span>
                    )}
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
            fileId={fileId}
            onPromoted={handlePromoted}
            disabled={promoted}
          />
        </div>
      </CardContent>
    </Card>
  )
}
