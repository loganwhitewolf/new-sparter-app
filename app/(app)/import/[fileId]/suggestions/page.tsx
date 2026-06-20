import { notFound } from 'next/navigation'
import { verifySession } from '@/lib/dal/auth'
import { getFileForUser, getPlatformIdForUserFile } from '@/lib/dal/files'
import { getCategories } from '@/lib/dal/categories'
import { discoverRegexCandidates } from '@/lib/services/regex-discovery'
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

  const platformId = await getPlatformIdForUserFile({ userId, fileId })
  if (platformId == null) {
    notFound()
  }

  // D-04: platform-scoped discovery (not file-scoped) — intentional, consistent with apply path
  const [discovery, categories] = await Promise.all([
    discoverRegexCandidates({ userId, scope: { platformId } }),
    getCategories(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Suggerimenti pattern</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crea pattern per categorizzare automaticamente transazioni simili nelle prossime importazioni.
        </p>
      </div>
      {discovery.candidates.length === 0 && discovery.singleCategorizationSuggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nessun suggerimento trovato — tutte le transazioni risultano già categorizzate o non sono stati rilevati pattern ricorrenti.
        </p>
      ) : (
        <SuggestionSection
          suggestions={discovery.candidates}
          singleSuggestions={discovery.singleCategorizationSuggestions}
          categories={categories}
          fileId={fileId}
        />
      )}
    </div>
  )
}
