import { notFound } from 'next/navigation'
import { ExpenseDetailClient } from '@/components/expenses/expense-detail-client'
import { verifySession } from '@/lib/dal/auth'
import { getCategories } from '@/lib/dal/categories'
import { getMostUsedSubcategories } from '@/lib/dal/subcategory-usage'
import { getExpenseForDetail } from '@/lib/dal/expenses'

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { userId } = await verifySession()

  const [exp, categories, mostUsed] = await Promise.all([
    getExpenseForDetail({ userId, id }),
    getCategories(),
    getMostUsedSubcategories(['in', 'out', 'transfer', 'allocation']),
  ])

  if (!exp) {
    notFound()
  }

  return <ExpenseDetailClient expense={exp} categories={categories} mostUsed={mostUsed} />
}
