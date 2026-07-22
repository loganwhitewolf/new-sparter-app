import { verifySession } from '@/lib/dal/auth'
import { getCategories } from '@/lib/dal/categories'
import { getUserPatterns } from '@/lib/dal/patterns'
import { CategoryPatternPanel } from '@/components/categories/category-pattern-panel'

export const metadata = { title: 'Pattern' }

export default async function PatternsPage() {
  const { userId, subscriptionPlan } = await verifySession()
  const isPaid = subscriptionPlan === 'basic' || subscriptionPlan === 'pro'

  const [categories, allPatterns] = await Promise.all([
    getCategories(),
    getUserPatterns(userId),
  ])

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pattern</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crea e gestisci i pattern di categorizzazione automatica delle transazioni.
        </p>
      </div>

      <CategoryPatternPanel categories={categories} patterns={allPatterns} isPaid={isPaid} />
    </div>
  )
}
