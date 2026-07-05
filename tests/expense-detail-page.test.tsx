import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const EXP_ID = '11111111-1111-4111-8111-111111111111'
const NON_OWNED_ID = '22222222-2222-4222-8222-222222222222'

// ---------------------------------------------------------------------------
// ExpenseNotesEdit
// ---------------------------------------------------------------------------

describe('ExpenseNotesEdit', () => {
  it('shows the muted "Aggiungi note" placeholder with a pencil icon when notes is null', async () => {
    vi.resetModules()
    vi.doMock('react', async () => {
      const actual = await vi.importActual<typeof import('react')>('react')
      return {
        ...actual,
        useActionState: vi.fn(() => [{ error: null }, vi.fn(), false]),
      }
    })
    const { ExpenseNotesEdit } = await import('../components/expenses/expense-notes-edit')

    const html = renderToStaticMarkup(
      createElement(ExpenseNotesEdit, {
        id: EXP_ID,
        title: 'Spesa settimanale',
        notes: null,
      }),
    )

    expect(html).toContain('Aggiungi note')
    vi.doUnmock('react')
  })

  it('shows the existing notes text when not editing', async () => {
    vi.resetModules()
    vi.doMock('react', async () => {
      const actual = await vi.importActual<typeof import('react')>('react')
      return {
        ...actual,
        useActionState: vi.fn(() => [{ error: null }, vi.fn(), false]),
      }
    })
    const { ExpenseNotesEdit } = await import('../components/expenses/expense-notes-edit')

    const html = renderToStaticMarkup(
      createElement(ExpenseNotesEdit, {
        id: EXP_ID,
        title: 'Spesa settimanale',
        notes: 'Nota esistente',
      }),
    )

    expect(html).toContain('Nota esistente')
    vi.doUnmock('react')
  })

  it('renders a hidden title input and a notes textarea when in edit mode', async () => {
    vi.resetModules()
    vi.doMock('react', async () => {
      const actual = await vi.importActual<typeof import('react')>('react')
      return {
        ...actual,
        useState: vi.fn((initial: unknown) => {
          const resolved = typeof initial === 'function' ? (initial as () => unknown)() : initial
          if (typeof resolved === 'boolean') {
            return [true, vi.fn()]
          }
          return [resolved, vi.fn()]
        }),
        useActionState: vi.fn(() => [{ error: null }, vi.fn(), false]),
      }
    })
    const { ExpenseNotesEdit } = await import('../components/expenses/expense-notes-edit')

    const html = renderToStaticMarkup(
      createElement(ExpenseNotesEdit, {
        id: EXP_ID,
        title: 'Spesa settimanale',
        notes: 'Nota esistente',
      }),
    )

    expect(html).toContain('name="notes"')
    expect(html).toContain('name="title"')
    expect(html).toContain('value="Spesa settimanale"')
    vi.doUnmock('react')
  })

  it('never includes a subCategoryId field in the rendered form (three-state contract)', async () => {
    vi.resetModules()
    vi.doMock('react', async () => {
      const actual = await vi.importActual<typeof import('react')>('react')
      return {
        ...actual,
        useState: vi.fn((initial: unknown) => {
          const resolved = typeof initial === 'function' ? (initial as () => unknown)() : initial
          if (typeof resolved === 'boolean') {
            return [true, vi.fn()]
          }
          return [resolved, vi.fn()]
        }),
        useActionState: vi.fn(() => [{ error: null }, vi.fn(), false]),
      }
    })
    const { ExpenseNotesEdit } = await import('../components/expenses/expense-notes-edit')

    const html = renderToStaticMarkup(
      createElement(ExpenseNotesEdit, {
        id: EXP_ID,
        title: 'Spesa settimanale',
        notes: 'Nota esistente',
      }),
    )

    expect(html).not.toContain('name="subCategoryId"')
  })

  it('renders the error text when the action state has an error, while remaining in edit mode', async () => {
    vi.resetModules()
    vi.doMock('react', async () => {
      const actual = await vi.importActual<typeof import('react')>('react')
      return {
        ...actual,
        useState: vi.fn((initial: unknown) => {
          const resolved = typeof initial === 'function' ? (initial as () => unknown)() : initial
          if (typeof resolved === 'boolean') {
            return [true, vi.fn()]
          }
          return [resolved, vi.fn()]
        }),
        useActionState: vi.fn(() => [{ error: 'Si è verificato un errore. Riprova tra qualche secondo.' }, vi.fn(), false]),
      }
    })
    const { ExpenseNotesEdit } = await import('../components/expenses/expense-notes-edit')

    const html = renderToStaticMarkup(
      createElement(ExpenseNotesEdit, {
        id: EXP_ID,
        title: 'Spesa settimanale',
        notes: 'Nota esistente',
      }),
    )

    expect(html).toContain('Si è verificato un errore. Riprova tra qualche secondo.')
    expect(html).toContain('name="notes"')
  })
})

// ---------------------------------------------------------------------------
// /expenses/[id] RSC page — ownership gate + rendering
// ---------------------------------------------------------------------------

const pageMocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  getExpenseForDetail: vi.fn(),
  getCategories: vi.fn(),
  getMostUsedSubcategories: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('notFound')
  }),
}))

vi.mock('next/navigation', () => ({
  notFound: pageMocks.notFound,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('@/lib/dal/auth', () => ({
  verifySession: pageMocks.verifySession,
}))

vi.mock('@/lib/dal/expenses', () => ({
  getExpenseForDetail: pageMocks.getExpenseForDetail,
}))

vi.mock('@/lib/dal/categories', () => ({
  getCategories: pageMocks.getCategories,
}))

vi.mock('@/lib/dal/subcategory-usage', () => ({
  getMostUsedSubcategories: pageMocks.getMostUsedSubcategories,
}))

const USER_ID = 'user-1'

function makeExpenseDetailRow(overrides: Record<string, unknown> = {}) {
  return {
    id: EXP_ID,
    title: 'Spesa settimanale',
    status: '3' as const,
    notes: 'Nota esistente',
    createdAt: new Date('2026-03-15T00:00:00.000Z'),
    totalAmount: '-120.50',
    transactionCount: 2,
    subCategoryId: 10,
    subCategoryName: 'Supermercato',
    categoryName: 'Spesa',
    categorySlug: 'spesa',
    platformName: 'Intesa SP',
    sourceFile: { id: 'file-1', name: 'estratto_conto.csv' },
    transactions: [
      {
        id: 'tx-1',
        description: 'SUPERMERCATO CENTRALE',
        customTitle: null,
        amount: '-60.25',
        currency: 'EUR',
        occurredAt: new Date('2026-03-10T00:00:00.000Z'),
      },
      {
        id: 'tx-2',
        description: 'SUPERMERCATO PERIFERIA',
        customTitle: null,
        amount: '-60.25',
        currency: 'EUR',
        occurredAt: new Date('2026-03-12T00:00:00.000Z'),
      },
    ],
    ...overrides,
  }
}

async function renderExpensePage(id = EXP_ID) {
  const { default: ExpenseDetailPage } = await import('../app/(app)/expenses/[id]/page')
  const element = await ExpenseDetailPage({ params: Promise.resolve({ id }) })
  return renderToStaticMarkup(createElement(() => element))
}

describe('/expenses/[id] page', () => {
  beforeEach(() => {
    vi.resetModules()
    pageMocks.verifySession.mockReset()
    pageMocks.getExpenseForDetail.mockReset()
    pageMocks.getCategories.mockReset()
    pageMocks.getMostUsedSubcategories.mockReset()
    pageMocks.notFound.mockReset()
    pageMocks.notFound.mockImplementation(() => {
      throw new Error('notFound')
    })

    pageMocks.verifySession.mockResolvedValue({ userId: USER_ID })
    pageMocks.getExpenseForDetail.mockResolvedValue(makeExpenseDetailRow())
    pageMocks.getCategories.mockResolvedValue([])
    pageMocks.getMostUsedSubcategories.mockResolvedValue([])
  })

  it('renders 200 with title, notes, category, readonly totals, and linked transactions', async () => {
    const html = await renderExpensePage()

    expect(html).toContain('Spesa settimanale')
    expect(html).toContain('Nota esistente')
    expect(html).toContain('Supermercato')
    expect(html).toContain('120,50')
    expect(html).toContain('SUPERMERCATO CENTRALE')
    expect(html).toContain('SUPERMERCATO PERIFERIA')
    expect(html).toContain('estratto_conto.csv')
    expect(html).toContain('Intesa SP')
  })

  it('calls notFound() for a non-existent expense id', async () => {
    pageMocks.getExpenseForDetail.mockResolvedValue(undefined)

    await expect(renderExpensePage(NON_OWNED_ID)).rejects.toThrow('notFound')
    expect(pageMocks.notFound).toHaveBeenCalledTimes(1)
  })

  it('calls notFound() for an expense owned by a different user (DAL returns undefined)', async () => {
    pageMocks.getExpenseForDetail.mockResolvedValue(undefined)

    await expect(renderExpensePage()).rejects.toThrow('notFound')
  })

  it('shows the amber "Categorizza" CTA when subCategoryId is null', async () => {
    pageMocks.getExpenseForDetail.mockResolvedValue(
      makeExpenseDetailRow({ subCategoryId: null, subCategoryName: null, categoryName: null }),
    )
    const html = await renderExpensePage()
    expect(html).toContain('Categorizza')
  })

  it('does not show the amber "Categorizza" CTA when subCategoryId is set', async () => {
    const html = await renderExpensePage()
    // "Categorizza" as a header CTA should be absent; the category card itself may say "Supermercato".
    expect(html).not.toMatch(/Categorizza<\/button>|>Categorizza</)
  })

  it('renders each linked-transaction row as a link to /transactions/[id]', async () => {
    const html = await renderExpensePage()

    expect(html).toContain('href="/transactions/tx-1"')
    expect(html).toContain('href="/transactions/tx-2"')
  })
})
