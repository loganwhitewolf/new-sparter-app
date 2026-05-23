import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/dal/auth'
import { getFileForUser } from '@/lib/dal/files'
import { getUncategorizedTransactionsByFileId } from '@/lib/dal/transactions'
import { getCategories } from '@/lib/dal/categories'
import { loadActivePatterns } from '@/lib/services/categorization'
import {
  detectPatternSuggestions,
  type PatternDetectorRow,
} from '@/lib/utils/pattern-suggestions'
import { SuggestionSection } from '@/components/import/suggestion-section'

export default async function SuggestionsPage({
  params,
}: {
  params: Promise<{ fileId: string }>
}) {
  const { fileId } = await params
  const { userId } = await verifySession()

  const fileRow = await getFileForUser({ userId, fileId })
  if (!fileRow || fileRow.status !== 'imported') {
    notFound()
  }

  const [uncategorizedTxs, activePatterns, categories] = await Promise.all([
    getUncategorizedTransactionsByFileId(db, fileId, userId),
    loadActivePatterns(db, userId),
    getCategories(),
  ])

  const detectorRows: PatternDetectorRow[] = uncategorizedTxs.map((t) => ({
    description: t.description,
    normalizedDescription: t.description,
    amount: t.amount,
    valid: true,
    covered: false,
  }))

  const raw = detectPatternSuggestions(detectorRows, activePatterns)
  const patternSuggestions = raw
    .sort((a, b) => b.matchCount - a.matchCount)
    .slice(0, 5)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Suggerimenti pattern</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crea pattern per categorizzare automaticamente transazioni simili nelle prossime importazioni.
        </p>
      </div>
      {patternSuggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nessun suggerimento trovato — tutte le transazioni risultano già categorizzate o non sono stati rilevati pattern ricorrenti.
        </p>
      ) : (
        <SuggestionSection suggestions={patternSuggestions} categories={categories} />
      )}
    </div>
  )
}
