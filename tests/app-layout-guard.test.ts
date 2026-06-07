/**
 * Tests for the RSC layout guard in app/(app)/layout.tsx (R-OB-01 / D-11)
 *
 * The guard redirects authenticated users with 0 transactions to /onboarding,
 * while exempting paths that start with /onboarding or /settings.
 *
 * Mock strategy:
 * - next/navigation: redirect is a vi.fn() that throws a sentinel error
 * - next/headers: headers() returns a mock Headers-like map
 * - @/lib/dal/auth: verifySession returns { userId }
 * - @/lib/dal/transactions: getTransactionCount is a vi.fn()
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Sentinel class used by redirect mock to simulate Next.js redirect behavior
class RedirectError extends Error {
  constructor(public readonly url: string) {
    super(`NEXT_REDIRECT:${url}`)
    this.name = 'RedirectError'
  }
}

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => { throw new RedirectError(url) }),
  headers: vi.fn(),
  verifySession: vi.fn(),
  getTransactionCount: vi.fn(),
  getOnboardingCompletedAt: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}))

vi.mock('next/headers', () => ({
  headers: mocks.headers,
}))

vi.mock('@/lib/dal/auth', () => ({
  verifySession: mocks.verifySession,
}))

vi.mock('@/lib/dal/transactions', () => ({
  getTransactionCount: mocks.getTransactionCount,
}))

vi.mock('@/lib/dal/users', () => ({
  getOnboardingCompletedAt: mocks.getOnboardingCompletedAt,
}))

vi.mock('@/lib/routes', () => ({
  APP_ROUTES: {
    onboarding: '/onboarding',
    settings: '/settings',
    dashboard: '/dashboard',
    import: '/import',
  },
}))

// Mock layout child components to avoid deep import chains
vi.mock('@/components/layout/bottom-nav', () => ({
  BottomNav: () => null,
}))
vi.mock('@/components/layout/sidebar', () => ({
  Sidebar: () => null,
}))
vi.mock('@/components/layout/sidebar-provider', () => ({
  SidebarProvider: ({ children }: { children: unknown }) => children,
  useSidebarCollapsed: () => ({ collapsed: false, setCollapsed: () => {} }),
}))
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: unknown }) => children,
}))

function mockPathname(pathname: string) {
  const map = new Map([['x-pathname', pathname]])
  mocks.headers.mockResolvedValue({
    get: (key: string) => map.get(key) ?? null,
  })
}

const { default: AppLayout } = await import('../app/(app)/layout')

describe('app/(app)/layout.tsx onboarding gate (R-OB-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifySession.mockResolvedValue({ userId: 'u1' })
    mocks.getTransactionCount.mockResolvedValue(0)
    mocks.getOnboardingCompletedAt.mockResolvedValue(null)
  })

  it('redirects to /onboarding when txCount === 0 and pathname is /dashboard (R-OB-01)', async () => {
    mockPathname('/dashboard')
    mocks.getTransactionCount.mockResolvedValue(0)

    await expect(AppLayout({ children: null })).rejects.toThrow(RedirectError)

    expect(mocks.redirect).toHaveBeenCalledWith('/onboarding')
  })

  it('does NOT redirect when txCount === 0 and pathname starts with /onboarding (R-OB-01 exemption)', async () => {
    mockPathname('/onboarding')
    mocks.getTransactionCount.mockResolvedValue(0)

    // Should NOT throw — renders normally
    await expect(AppLayout({ children: null })).resolves.not.toThrow()

    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it('does NOT redirect when txCount === 0 and pathname starts with /settings (R-OB-01 exemption)', async () => {
    mockPathname('/settings/profile')
    mocks.getTransactionCount.mockResolvedValue(0)

    await expect(AppLayout({ children: null })).resolves.not.toThrow()

    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it('does NOT redirect when txCount > 0 on /dashboard (R-OB-01)', async () => {
    mockPathname('/dashboard')
    mocks.getTransactionCount.mockResolvedValue(5)

    await expect(AppLayout({ children: null })).resolves.not.toThrow()

    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it('calls verifySession before getTransactionCount and uses the returned userId (R-OB-01)', async () => {
    mockPathname('/expenses')
    mocks.verifySession.mockResolvedValue({ userId: 'user-abc' })
    mocks.getTransactionCount.mockResolvedValue(3)

    await AppLayout({ children: null })

    // Verify call order
    const verifyOrder = mocks.verifySession.mock.invocationCallOrder[0]
    const countOrder = mocks.getTransactionCount.mock.invocationCallOrder[0]
    expect(verifyOrder).toBeLessThan(countOrder)

    // Verify userId passed to getTransactionCount
    expect(mocks.getTransactionCount).toHaveBeenCalledWith('user-abc')
  })
})
