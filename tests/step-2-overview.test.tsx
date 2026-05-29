/**
 * Step 2 Overview tests — R-OB-05, R-OB-10
 *
 * Strategy: async RSCs are hard to render in Vitest without jsdom.
 * The project pattern (tests/dashboard-charts.test.tsx) uses renderToStaticMarkup.
 * However, since step-2-overview.tsx calls an async server action and imports
 * 'server-only' modules, we test the pure view-model builder (buildStep2ViewModel)
 * directly for the formatting/percentage logic, and test the full component via
 * mocked dependencies + renderToStaticMarkup for the integration cases.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'

const mocks = vi.hoisted(() => ({
  getLatestImportSummaryForUser: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return { ...actual, cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }
})
vi.mock('@/lib/dal/imports', () => ({
  getLatestImportSummaryForUser: mocks.getLatestImportSummaryForUser,
  getFileCoveredMonths: vi.fn(),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement('a', { href, className }, children),
}))

const { buildStep2ViewModel } = await import(
  '../app/(app)/onboarding/_components/step-2-view-model'
)
const { Step2Overview } = await import(
  '../app/(app)/onboarding/_components/step-2-overview'
)

// ─── buildStep2ViewModel (pure logic tests) ───────────────────────────────────

describe('buildStep2ViewModel (R-OB-05, R-OB-10)', () => {
  it('formats Italian totals and computes percentage (R-OB-05)', () => {
    const vm = buildStep2ViewModel({
      fileId: 'f1',
      fileName: 'estratto-aprile.csv',
      importedCount: 123,
      autoCategorizedCount: 80,
      uncategorizedCount: 43,
      positiveTotal: '4500.00',
      negativeTotal: '3200.50',
      firstMonth: new Date(2026, 3, 1),
      lastMonth: new Date(2026, 3, 30),
    })

    // Percentage: Math.round(80 / 123 * 100) = 65
    expect(vm.pct).toBe(65)

    // Intl format for 4500.00 with locale it-IT: "4.500" (thousands separator is dot in Italian)
    expect(vm.formattedPositiveTotal).toContain('4')
    expect(vm.formattedPositiveTotal).toContain('500')

    // Months label for same year Apr 2026
    expect(vm.monthsLabel).toMatch(/Apr.*2026/)
  })

  it('computes correct multi-month label Apr–Mag 2026 (R-OB-10)', () => {
    const vm = buildStep2ViewModel({
      fileId: 'f1',
      fileName: 'estratto.csv',
      importedCount: 100,
      autoCategorizedCount: 50,
      uncategorizedCount: 50,
      positiveTotal: '1000.00',
      negativeTotal: '500.00',
      firstMonth: new Date(2026, 3, 1),   // April
      lastMonth: new Date(2026, 4, 30),   // May
    })

    // Should contain both Italian month abbreviations
    expect(vm.monthsLabel).toMatch(/Apr/)
    expect(vm.monthsLabel).toMatch(/Mag/)
    expect(vm.monthsLabel).toMatch(/2026/)
  })

  it('returns 0% when importedCount is 0 — no NaN (R-OB-05 boundary)', () => {
    const vm = buildStep2ViewModel({
      fileId: 'f1',
      fileName: 'empty.csv',
      importedCount: 0,
      autoCategorizedCount: 0,
      uncategorizedCount: 0,
      positiveTotal: '0.00',
      negativeTotal: '0.00',
      firstMonth: null,
      lastMonth: null,
    })

    expect(vm.pct).toBe(0)
    expect(vm.pct.toString()).not.toContain('NaN')
    expect(vm.monthsLabel).toBe('Periodo non disponibile')
  })

  it('returns fallback month label when dates are null', () => {
    const vm = buildStep2ViewModel({
      fileId: 'f1',
      fileName: 'test.csv',
      importedCount: 10,
      autoCategorizedCount: 5,
      uncategorizedCount: 5,
      positiveTotal: '100.00',
      negativeTotal: '50.00',
      firstMonth: null,
      lastMonth: null,
    })

    expect(vm.monthsLabel).toBe('Periodo non disponibile')
  })
})

// ─── Step2Overview RSC component ──────────────────────────────────────────────

describe('Step2Overview component (R-OB-05, R-OB-10)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders real data from getLatestImportSummaryForUser (R-OB-05)', async () => {
    mocks.getLatestImportSummaryForUser.mockResolvedValue({
      fileId: 'f1',
      fileName: 'estratto-aprile.csv',
      importedCount: 123,
      autoCategorizedCount: 80,
      uncategorizedCount: 43,
      positiveTotal: '4500.00',
      negativeTotal: '3200.50',
      firstMonth: new Date(2026, 3, 1),
      lastMonth: new Date(2026, 3, 30),
    })

    const element = await Step2Overview({ userId: 'u1' })
    const html = renderToStaticMarkup(element as React.ReactElement)

    expect(html).toContain('123')
    expect(html).toContain('transazioni importate')
    // Month range
    expect(html).toMatch(/Apr.*2026/)
    // Percentage
    expect(html).toContain('65%')
  })

  it('renders multi-month label Apr–Mag 2026 (R-OB-10)', async () => {
    mocks.getLatestImportSummaryForUser.mockResolvedValue({
      fileId: 'f1',
      fileName: 'file.csv',
      importedCount: 100,
      autoCategorizedCount: 50,
      uncategorizedCount: 50,
      positiveTotal: '1000.00',
      negativeTotal: '500.00',
      firstMonth: new Date(2026, 3, 1),
      lastMonth: new Date(2026, 4, 30),
    })

    const element = await Step2Overview({ userId: 'u1' })
    const html = renderToStaticMarkup(element as React.ReactElement)

    expect(html).toMatch(/Apr/)
    expect(html).toMatch(/Mag/)
    expect(html).toMatch(/2026/)
  })

  it('renders 0% without NaN when importedCount is 0 (boundary, R-OB-05)', async () => {
    mocks.getLatestImportSummaryForUser.mockResolvedValue({
      fileId: 'f1',
      fileName: 'empty.csv',
      importedCount: 0,
      autoCategorizedCount: 0,
      uncategorizedCount: 0,
      positiveTotal: '0.00',
      negativeTotal: '0.00',
      firstMonth: null,
      lastMonth: null,
    })

    const element = await Step2Overview({ userId: 'u1' })
    const html = renderToStaticMarkup(element as React.ReactElement)

    expect(html).toContain('0%')
    expect(html).not.toContain('NaN')
  })

  it('renders fallback "Nessun file caricato" when summary is null (defensive)', async () => {
    mocks.getLatestImportSummaryForUser.mockResolvedValue(null)

    const element = await Step2Overview({ userId: 'u1' })
    const html = renderToStaticMarkup(element as React.ReactElement)

    expect(html).toContain('Nessun file caricato')
  })
})
