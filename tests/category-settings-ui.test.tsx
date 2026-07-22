import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  getCategories: vi.fn(),
  createCategoryAction: vi.fn(),
  renameCategoryAction: vi.fn(),
  deleteCategoryAction: vi.fn(),
  createSubcategoryAction: vi.fn(),
  renameSubcategoryAction: vi.fn(),
  deleteSubcategoryAction: vi.fn(),
  setSubcategoryNatureAction: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/dal/auth', () => ({ verifySession: mocks.verifySession }))
vi.mock('@/lib/dal/categories', () => ({ getCategories: mocks.getCategories }))
vi.mock('@/lib/actions/categories', () => ({
  createCategoryAction: mocks.createCategoryAction,
  renameCategoryAction: mocks.renameCategoryAction,
  deleteCategoryAction: mocks.deleteCategoryAction,
  createSubcategoryAction: mocks.createSubcategoryAction,
  renameSubcategoryAction: mocks.renameSubcategoryAction,
  deleteSubcategoryAction: mocks.deleteSubcategoryAction,
  setSubcategoryNatureAction: mocks.setSubcategoryNatureAction,
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
  })

  it('renders the category heading, create affordance, ownership badges, override hints, and delete warning', async () => {
    const html = await renderCategoriesPage()

    expect(html).toContain('Categorie')
    expect(html).toContain('Gestione categorie')
    expect(html).toContain('Nuova categoria')
    expect(html).toContain('Personale')
    expect(html).toContain('Alimentari speciali')
    expect(html).toContain('Nome originale: Alimentari')
    expect(html).toContain('Questo nome vale solo per te')
    expect(html).toContain('Le eliminazioni sono disponibili solo per voci personali')
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

  it('renders SubcategoryNatureSelect within subcategory rows (R-FN-07)', async () => {
    const html = await renderCategoriesPage()
    expect(html).toContain('aria-label="Natura sottocategoria"')
  })

  it('CreateSubcategoryDialog includes a Natura label for the required nature field', async () => {
    const html = await renderCategoriesPage()
    expect(html).toContain('Natura')
  })
})
