import { verifySession } from '@/lib/dal/auth'
import { getUserPatterns } from '@/lib/dal/patterns'
import { getCategories } from '@/lib/dal/categories'
import { CategoryPatternPanel } from '@/components/categories/category-pattern-panel'

export const metadata = { title: 'Pattern personalizzati' }

export default async function PatternPage() {
  const { userId, subscriptionPlan } = await verifySession()
  const isPaid = subscriptionPlan === 'basic' || subscriptionPlan === 'pro'

  const [allPatterns, categories] = await Promise.all([
    getUserPatterns(userId),
    getCategories(),
  ])

  return (
    <div className="flex flex-col gap-6 p-6">
      <CategoryPatternPanel
        categories={categories}
        patterns={allPatterns}
        isPaid={isPaid}
        wrapInCard={false}
      />
    </div>
  )
}
