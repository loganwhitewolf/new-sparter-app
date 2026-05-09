import 'server-only'
import { cache } from 'react'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { user as userTable } from '@/lib/db/schema'
import { getAuthSessionOrNull } from '@/lib/auth-session'

export const verifySession = cache(async () => {
  const requestHeaders = await headers()

  if (
    process.env.STAGING_KEY &&
    requestHeaders.get('x-staging-key') === process.env.STAGING_KEY
  ) {
    return {
      userId: process.env.STAGING_USER_ID ?? 'staging-user',
      email: 'staging@example.local',
      subscriptionPlan: 'basic' as const,
      role: 'user' as const,
    }
  }

  const session = await getAuthSessionOrNull(requestHeaders)
  if (!session?.user) {
    redirect('/login')
  }

  const userId = session.user.id
  const email = session.user.email

  const [row] = await db
    .select({
      subscriptionPlan: userTable.subscriptionPlan,
      role: userTable.role,
    })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1)

  return {
    userId,
    email,
    subscriptionPlan: row?.subscriptionPlan ?? 'free',
    role: row?.role ?? 'user',
  }
})
