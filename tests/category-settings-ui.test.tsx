import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  getCategories: vi.fn(),
  getUserPatterns: vi.fn(),
  createCategoryAction: vi.fn(),
  renameCategoryAction: vi.fn(),
  deleteCategoryAction: vi.fn(),
  createSubcategoryAction: vi.fn(),
  renameSubcategoryAction: vi.fn(),
  deleteSubcategoryAction: vi.fn(),
  createPatternAction: vi.fn(),
  updatePatternAction: vi.fn(),
  deletePatternAction: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/dal/auth', () => ({ verifySession: mocks.verifySession }))
vi.mock('@/lib/dal/categories', () => ({ getCategories: mocks.getCategories }))
vi.mock('@/lib/dal/patterns', () => ({ getUserPatterns: mocks.getUserPatterns }))
vi.mock('@/lib/actions/categories', () => ({
  createCategoryAction: mocks.createCategoryAction,
  renameCategoryAction: mocks.renameCategoryAction,
  deleteCategoryAction: mocks.deleteCategoryAction,
  createSubcategoryAction: mocks.createSubcategoryAction,
  renameSubcategoryAction: mocks.renameSubcategoryAction,
  deleteSubcategoryAction: mocks.deleteSubcategoryAction,
}))
vi.mock('@/lib/actions/patterns', () => ({
  createPatternAction: mocks.createPatternAction,
  updatePatternAction: mocks.updatePatternAction,
  deletePatternAction: mocks.deletePatternAction,
}))

const { default: CategoriesPage } = await import('../app/(app)/settings/categories/page')

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

async function renderCategoriesPage() {
  const element = await CategoriesPage()
  return renderToStaticMarkup(createElement(() => element))
}

describe('/settings/categories UI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifySession.mockResolvedValue({
      userId: 'user-abc',
      email: 'user@example.test',
      subscriptionPlan: 'basic',
      role: 'user',
    })
    mocks.getCategories.mockResolvedValue(categories)
    mocks.getUserPatterns.mockResolvedValue(patterns)
  })

  it('renders the category heading, create affordance, ownership badges, override hints, delete warning, and pattern panel', async () => {
    const html = await renderCategoriesPage()

    expect(html).toContain('Categorie')
    expect(html).toContain('Gestione categorie')
    expect(html).toContain('Nuova categoria')
    expect(html).toContain('Personale')
    expect(html).toContain('Alimentari speciali')
    expect(html).toContain('Nome originale: Alimentari')
    expect(html).toContain('Questo nome vale solo per te')
    expect(html).toContain('Le eliminazioni sono disponibili solo per voci personali')
    expect(html).toContain('Pattern di categorizzazione')
    expect(html).toContain('Nuovo pattern')
    expect(html).toContain('Spese → Alimentari speciali')
    expect(html).toContain('Sottocategoria non trovata (#999)')
    expect(html).toContain('data-testid="subcategory-row-10"')
  })

  it('does not render raw diagnostics or forbidden system delete controls', async () => {
    const html = await renderCategoriesPage()

    expect(html).not.toContain('stack')
    expect(html).not.toContain('SQL')
    expect(html).not.toContain('FATAL')
    expect(html).not.toContain('Error:')
    expect(html).not.toContain('Elimina categoria Spese')
    expect(html).not.toContain('Elimina sottocategoria Alimentari speciali')
  })
})
