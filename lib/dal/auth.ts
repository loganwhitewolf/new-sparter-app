import 'server-only'
import { cache } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'

export const verifySession = cache(async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  if (!session?.user) {
    redirect('/login')
  }
  return {
    userId: session.user.id,
    email: session.user.email,
    subscriptionPlan: (session.user as any).subscriptionPlan as 'free' | 'basic' | 'pro',
    role: (session.user as any).role as 'user' | 'admin',
  }
})
