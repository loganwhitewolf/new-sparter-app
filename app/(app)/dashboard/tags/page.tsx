import { Suspense } from 'react'
import { TagRankingList } from '@/components/dashboard/tag-ranking-list'
import { TagRankingSkeleton } from '@/components/dashboard/tag-ranking-skeleton'
import { verifySession } from '@/lib/dal/auth'
import { getTagTotals, type TagTotalItem } from '@/lib/dal/tags'

export const metadata = { title: 'Tag' }

// This page intentionally reads no searchParams (no preset/year/tag) — TAG-05's per-tag
// total is all-time and does not subscribe to the dashboard's global filters (LOCKED
// DECISION 1). getTagTotals failure surfaces the same dashed-box shape as the empty
// state, distinguished only by heading text (backstop — no dedicated fetch-failure test
// harness exists in this repo, per RESEARCH.md). JSX is constructed only after the
// try/catch resolves (never inside it) to satisfy the error-boundaries lint rule.
async function TagRankingContent({ userId }: { userId: string }) {
  let items: TagTotalItem[] | null = null

  try {
    items = await getTagTotals(userId)
  } catch {
    items = null
  }

  if (items === null) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-12 text-center text-muted-foreground">
        <p className="text-base font-medium text-foreground">
          Non è stato possibile caricare i tag. Ricarica la pagina.
        </p>
      </div>
    )
  }

  return <TagRankingList items={items} />
}

export default async function DashboardTagsPage() {
  const { userId } = await verifySession()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Tag</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Il totale di ogni tag è complessivo e indipendente dal periodo selezionato in
          dashboard.
        </p>
      </div>

      <Suspense fallback={<TagRankingSkeleton />}>
        <TagRankingContent userId={userId} />
      </Suspense>
    </div>
  )
}
