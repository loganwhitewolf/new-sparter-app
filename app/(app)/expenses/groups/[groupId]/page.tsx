import { notFound } from 'next/navigation'
import { GroupDetailClient } from '@/components/expenses/group-detail-client'
import { verifySession } from '@/lib/dal/auth'
import { getExpenseGroupForDetail } from '@/lib/dal/expenses'

function parseGroupId(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null
  }

  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string }>
}) {
  const { groupId: rawGroupId } = await params
  const groupId = parseGroupId(rawGroupId)

  if (groupId === null) {
    notFound()
  }

  const { userId } = await verifySession()
  const group = await getExpenseGroupForDetail({ userId, groupId })

  if (!group) {
    notFound()
  }

  return <GroupDetailClient group={group} />
}
