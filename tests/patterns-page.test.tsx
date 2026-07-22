import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  getCategories: vi.fn(),
  getUserPatterns: vi.fn(),
  createPatternAction: vi.fn(),
  updatePatternAction: vi.fn(),
  deletePatternAction: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/dal/auth', () => ({ verifySession: mocks.verifySession }))
vi.mock('@/lib/dal/categories', () => ({ getCategories: mocks.getCategories }))
vi.mock('@/lib/dal/patterns', () => ({ getUserPatterns: mocks.getUserPatterns }))
vi.mock('@/lib/actions/patterns', () => ({
  createPatternAction: mocks.createPatternAction,
  updatePatternAction: mocks.updatePatternAction,
  deletePatternAction: mocks.deletePatternAction,
}))

const { default: PatternsPage } = await import('../app/(app)/patterns/page')

const categories = [
  {
    id: 1,
    name: 'Spese',
    slug: 'spese',
    type: 'out' as const,
    userId: null,
    isOwned: false,
    subCategories: [
      {
        id: 10,
        name: 'Alimentari speciali',
        slug: 'alimentari',
        originalName: 'Alimentari',
        userId: null,
        isOwned: false,
        hasOverride: true,
        customName: 'Alimentari speciali',
        effectiveNature: 'essential' as const,
      },
      {
        id: 11,
        name: 'Casa vacanze',
        slug: 'casa-vacanze',
        originalName: 'Casa vacanze',
        userId: 'user-abc',
        isOwned: true,
        hasOverride: false,
        customName: null,
        effectiveNature: 'discretionary' as const,
      },
    ],
  },
  {
    id: 2,
    name: 'Rimborsi',
    slug: 'rimborsi',
    type: 'in' as const,
    userId: 'user-abc',
    isOwned: true,
    subCategories: [],
  },
]

const patterns = [
  {
    id: 7,
    userId: 'user-abc',
    pattern: 'netflix',
    subCategoryId: 10,
    amountSign: 'negative' as const,
    confidence: '0.90',
    priority: 100,
    description: 'Streaming',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  },
  {
    id: 8,
    userId: 'user-abc',
    pattern: 'old-shop',
    subCategoryId: 999,
    amountSign: 'negative' as const,
    confidence: '0.80',
    priority: 100,
    description: null,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  },
]

async function renderPatternsPage() {
  const element = await PatternsPage()
  return renderToStaticMarkup(createElement(() => element))
}

describe('/patterns UI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCategories.mockResolvedValue(categories)
    mocks.getUserPatterns.mockResolvedValue(patterns)
  })

  it('renders without throwing', async () => {
    mocks.verifySession.mockResolvedValue({
      userId: 'user-abc',
      email: 'user@example.test',
      subscriptionPlan: 'basic',
      role: 'user',
    })

    await expect(renderPatternsPage()).resolves.not.toThrow()
  })

  it('renders the Pattern heading', async () => {
    mocks.verifySession.mockResolvedValue({
      userId: 'user-abc',
      email: 'user@example.test',
      subscriptionPlan: 'basic',
      role: 'user',
    })

    const html = await renderPatternsPage()
    expect(html).toContain('Pattern')
  })

  it('renders the create action and pattern row content for a paid plan', async () => {
    mocks.verifySession.mockResolvedValue({
      userId: 'user-abc',
      email: 'user@example.test',
      subscriptionPlan: 'basic',
      role: 'user',
    })

    const html = await renderPatternsPage()

    expect(html).toContain('Nuovo pattern')
    expect(html).toContain('Spese → Alimentari speciali')
    expect(html).toContain('Sottocategoria non trovata (#999)')
    expect(html).toContain('90%')
    expect(html).toContain('Streaming')
  })

  it('renders the upgrade-plan message instead of the create button for a free plan', async () => {
    mocks.verifySession.mockResolvedValue({
      userId: 'user-abc',
      email: 'user@example.test',
      subscriptionPlan: 'free',
      role: 'user',
    })

    const html = await renderPatternsPage()

    expect(html).not.toContain('Nuovo pattern')
    expect(html).toContain('Disponibile con piano Basic o Pro.')
  })
})
