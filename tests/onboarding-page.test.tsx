/**
 * Onboarding page tests — R-OB-03, R-OB-04, R-OB-06, R-OB-09
 *
 * Strategy: async RSC page.tsx is tested by calling the async default-export
 * function directly. The resulting JSX is serialised via renderToStaticMarkup
 * from react-dom/server (same pattern as tests/dashboard-charts.test.tsx).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  getLatestImportSummaryForUser: vi.fn(),
  getTopUncategorizedExpenses: vi.fn(),
  getCategories: vi.fn(),
  redirect: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return { ...actual, cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }
})
vi.mock('@/lib/dal/auth', () => ({ verifySession: mocks.verifySession }))
vi.mock('@/lib/dal/imports', () => ({
  getLatestImportSummaryForUser: mocks.getLatestImportSummaryForUser,
  getFileCoveredMonths: vi.fn(),
}))
vi.mock('@/lib/dal/transactions', () => ({
  getTopUncategorizedExpenses: mocks.getTopUncategorizedExpenses,
}))
vi.mock('@/lib/dal/categories', () => ({
  getCategories: mocks.getCategories,
}))
vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
  useRouter: vi.fn(),
}))
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Map()),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement('a', { href, className }, children),
}))

// ─── Component stubs ─────────────────────────────────────────────────────────

vi.mock('@/app/(app)/onboarding/_components/onboarding-shell', () => ({
  OnboardingShell: ({
    step,
    theme,
    children,
    footer,
  }: {
    step: number
    theme: string
    children: React.ReactNode
    footer?: React.ReactNode
  }) =>
    React.createElement(
      'div',
      { 'data-testid': 'onboarding-shell', 'data-step': step, 'data-theme': theme },
      children,
      footer,
    ),
}))

vi.mock('@/app/(app)/onboarding/_components/step-1-upload', () => ({
  Step1Upload: () =>
    React.createElement(
      'div',
      { 'data-testid': 'step-1-upload' },
      React.createElement('p', null, 'Il tuo primo estratto conto'),
      React.createElement('p', null, 'CSV, XLS, XLSX · max 10 MB'),
    ),
}))

vi.mock('@/app/(app)/onboarding/_components/step-2-overview', () => ({
  Step2Overview: ({ userId }: { userId: string }) =>
    React.createElement('div', { 'data-testid': 'step-2-overview', 'data-user-id': userId }, 'Step 2'),
}))

vi.mock('@/app/(app)/onboarding/_components/step-3-education', () => ({
  Step3Education: ({ userId }: { userId: string }) =>
    React.createElement(
      'div',
      { 'data-testid': 'step-3-education', 'data-user-id': userId },
      React.createElement(
        'p',
        null,
        'I trasferimenti tra conti e i giroconti vengono esclusi dai totali in dashboard — \xe8 normale se i numeri sembrano diversi da quelli che ti aspetti.',
      ),
    ),
}))

vi.mock('@/app/(app)/onboarding/_components/sticky-cta', () => ({
  StickyCta: ({ step }: { step: number }) =>
    step === 5
      ? null
      : React.createElement(
          'div',
          { 'data-testid': 'sticky-cta', 'data-step': step },
          step === 4 ? 'Categorizza il resto dopo' : 'Continua',
        ),
}))

vi.mock('@/app/(app)/onboarding/_components/subcategory-combobox', () => ({
  SubcategoryCombobox: ({ expenseTitle }: { expenseTitle: string }) =>
    React.createElement('div', { 'data-testid': 'subcategory-combobox' }, expenseTitle),
}))

// Lazy import after all mocks registered
const { default: OnboardingPage } = await import('../app/(app)/onboarding/page')

async function renderPageHtml(step?: string | string[]): Promise<string> {
  const searchParams = step !== undefined ? { step } : {}
  const element = await OnboardingPage({
    searchParams: Promise.resolve(searchParams),
  })
  return renderToStaticMarkup(element as React.ReactElement)
}

describe('OnboardingPage routing (R-OB-03, R-OB-04, R-OB-06, R-OB-09)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifySession.mockResolvedValue({ userId: 'user-1', subscriptionPlan: 'basic' })
    mocks.getLatestImportSummaryForUser.mockResolvedValue(null)
    mocks.getTopUncategorizedExpenses.mockResolvedValue([
      {
        id: 'expense-1',
        title: 'Supermercato',
        descriptionHash: 'hash-1',
        totalAmount: '-42.50',
      },
    ])
    mocks.getCategories.mockResolvedValue([])
  })

  it('renders Step1Upload when ?step is missing (R-OB-03)', async () => {
    const html = await renderPageHtml(undefined)
    expect(html).toContain('data-testid="step-1-upload"')
    expect(html).not.toContain('data-testid="step-2-overview"')
    expect(html).not.toContain('data-testid="step-3-education"')
  })

  it('renders Step1Upload when ?step=1 (R-OB-04)', async () => {
    const html = await renderPageHtml('1')
    expect(html).toContain('data-testid="step-1-upload"')
  })

  it('renders Step2Overview when ?step=2', async () => {
    const html = await renderPageHtml('2')
    expect(html).toContain('data-testid="step-2-overview"')
    expect(html).not.toContain('data-testid="step-1-upload"')
  })

  it('renders Step3Education with transfers/giroconto tip text when ?step=3 (R-OB-06)', async () => {
    const html = await renderPageHtml('3')
    expect(html).toContain('data-testid="step-3-education"')
    expect(html).toContain('I trasferimenti tra conti e i giroconti vengono esclusi')
  })

  it('R-OB-07 renders Step4Categorize with the user id from session when ?step=4', async () => {
    const html = await renderPageHtml('4')
    expect(html).toContain('Categorizza le spese principali')
    expect(html).toContain('data-testid="subcategory-combobox"')
    expect(mocks.getTopUncategorizedExpenses).toHaveBeenCalledWith('user-1', 15)
  })

  it('R-OB-08 renders Step5Outro when ?step=5', async () => {
    const html = await renderPageHtml('5')
    expect(html).toContain('Benvenuto in Sparter!')
    expect(html).toContain('Vai alla dashboard')
  })

  it("uses 'light' theme on step 4, 'dark' otherwise (R-OB-09)", async () => {
    const html = await renderPageHtml('4')
    expect(html).toContain('data-theme="light"')
  })

  it("uses 'dark' theme on step 1 (R-OB-09)", async () => {
    const html = await renderPageHtml('1')
    expect(html).toContain('data-theme="dark"')
  })

  it("uses 'dark' theme on step 3 (R-OB-09)", async () => {
    const html = await renderPageHtml('3')
    expect(html).toContain('data-theme="dark"')
  })

  it('step=5 sticky CTA bar is not rendered', async () => {
    const html = await renderPageHtml('5')
    expect(html).not.toContain('data-testid="sticky-cta"')
  })

  it("step=4 renders the secondary 'Categorizza il resto dopo' button (D-07)", async () => {
    const html = await renderPageHtml('4')
    expect(html).toContain('Categorizza il resto dopo')
  })

  it("Step1Upload shows file accept hint 'CSV, XLS, XLSX · max 10 MB' (R-OB-04)", async () => {
    const html = await renderPageHtml('1')
    expect(html).toContain('CSV, XLS, XLSX · max 10 MB')
  })

  it('Step3Education contains exact Italian text about giroconti (R-OB-06)', async () => {
    const html = await renderPageHtml('3')
    expect(html).toContain(
      'I trasferimenti tra conti e i giroconti vengono esclusi dai totali in dashboard',
    )
  })
})
