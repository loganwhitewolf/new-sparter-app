import { notFound } from 'next/navigation'
import { ProceedToImportsCta } from '@/components/import/proceed-to-imports-cta'
import { SuggestionSection } from '@/components/import/suggestion-section'
import { TagSuggestionSection } from '@/components/import/tag-suggestion-section'
import { verifySession } from '@/lib/dal/auth'
import { getCategories } from '@/lib/dal/categories'
import { getFileForUser, getPlatformIdForUserFile } from '@/lib/dal/files'
import { discoverRegexCandidates } from '@/lib/services/regex-discovery'
import { computeAllTagSuggestions } from '@/lib/services/tag-suggestions'

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

  // D-04: platform-scoped discovery (not file-scoped) — intentional, consistent with apply path.
  // D-08b: computeAllTagSuggestions takes only userId — it re-scans every tag's FULL date range
  // against ALL of the user's transactions on every visit, never scoped to this file/platform.
  const [discovery, categories, tagSuggestionGroups] = await Promise.all([
    discoverRegexCandidates({ userId, scope: { platformId } }),
    getCategories(),
    computeAllTagSuggestions({ userId }),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Suggerimenti pattern</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          I suggerimenti sono stati rilevati dalle transazioni non categorizzate di questa piattaforma
          dopo l&apos;importazione. Puoi ricontrollare i pattern in qualsiasi momento dal tab Importazioni.
        </p>
      </div>
      {discovery.candidates.length === 0 && discovery.singleCategorizationSuggestions.length === 0 ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Nessun suggerimento trovato — tutte le transazioni risultano già categorizzate o non sono stati rilevati pattern ricorrenti.
          </p>
          <ProceedToImportsCta />
        </div>
      ) : (
        <SuggestionSection
          suggestions={discovery.candidates}
          singleSuggestions={discovery.singleCategorizationSuggestions}
          categories={categories}
          fileId={fileId}
        />
      )}
      <TagSuggestionSection groups={tagSuggestionGroups} />
    </div>
  )
}
