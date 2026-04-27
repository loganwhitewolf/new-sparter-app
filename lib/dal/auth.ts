import 'server-only'
import { cache } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'

type SessionUserWithAccessFields = {
  subscriptionPlan?: 'free' | 'basic' | 'pro'
  role?: 'user' | 'admin'
}

export const verifySession = cache(async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  if (!session?.user) {
    redirect('/login')
  }
  const user = session.user as typeof session.user & SessionUserWithAccessFields

  return {
    userId: user.id,
    email: user.email,
    subscriptionPlan: user.subscriptionPlan ?? 'free',
    role: user.role ?? 'user',
  }
})
