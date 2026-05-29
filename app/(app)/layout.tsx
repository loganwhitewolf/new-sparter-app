/**
 * Onboarding gate per D-11:
 * - proxy.ts forwards 'x-pathname' on every request (session-only, no DB in edge runtime)
 * - This RSC layout reads the pathname and redirects users with 0 transactions to /onboarding
 * - /onboarding and /settings/* are exempt from the redirect guard
 */
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { BottomNav } from '@/components/layout/bottom-nav'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { verifySession } from '@/lib/dal/auth'
import { getTransactionCount } from '@/lib/dal/transactions'
import { getOnboardingCompletedAt } from '@/lib/dal/users'
import { APP_ROUTES } from '@/lib/routes'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = await verifySession()

  const requestHeaders = await headers()
  const pathname = requestHeaders.get('x-pathname') ?? ''

  // Exempt /onboarding and /settings/* from the zero-transaction redirect guard
  const isExempt =
    pathname.startsWith(APP_ROUTES.onboarding) ||
    pathname.startsWith(APP_ROUTES.settings)

  if (!isExempt) {
    const txCount = await getTransactionCount(userId)
    if (txCount === 0) {
      const completedAt = await getOnboardingCompletedAt(userId)
      if (!completedAt) {
        redirect(APP_ROUTES.onboarding)
      }
    }
  }

  // Bypass app chrome (Sidebar, Topbar, BottomNav) for the onboarding route group (D-09, D-11)
  const isOnboarding = pathname.startsWith(APP_ROUTES.onboarding)
  if (isOnboarding) {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <aside
        data-sidebar
        className="hidden border-r border-border md:flex md:w-60 md:shrink-0 md:flex-col"
      >
        <Sidebar />
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6 pb-20 md:pb-6">
          {children}
        </main>
        <BottomNav className="md:hidden" />
      </div>
    </div>
  )
}
