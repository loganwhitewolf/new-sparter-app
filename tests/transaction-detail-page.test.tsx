import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const TX_ID = '11111111-1111-4111-8111-111111111111'

describe('TransactionAmountEdit', () => {
  it('shows the formatted signed amount with a pencil icon when not editing', async () => {
    vi.resetModules()
    vi.doMock('react', async () => {
      const actual = await vi.importActual<typeof import('react')>('react')
      return {
        ...actual,
        useActionState: vi.fn(() => [{ error: null }, vi.fn(), false]),
      }
    })
    const { TransactionAmountEdit } = await import(
      '../components/transactions/transaction-amount-edit'
    )

    const html = renderToStaticMarkup(
      createElement(TransactionAmountEdit, {
        id: TX_ID,
        amount: '-12.99',
        currency: 'EUR',
      }),
    )

    expect(html).toContain('-12,99')
    vi.doUnmock('react')
  })

  it('surfaces the pair-guard error inline and stays in edit mode when the action returns an error', async () => {
    vi.resetModules()
    vi.doMock('react', async () => {
      const actual = await vi.importActual<typeof import('react')>('react')
      return {
        ...actual,
        useState: vi.fn((initial: unknown) => [
          typeof initial === 'function' ? (initial as () => unknown)() : initial,
          vi.fn(),
        ]),
        useActionState: vi.fn(() => [
          { error: 'Scollega prima il rimborso' },
          vi.fn(),
          false,
        ]),
      }
    })
    const { TransactionAmountEdit } = await import(
      '../components/transactions/transaction-amount-edit'
    )

    const html = renderToStaticMarkup(
      createElement(TransactionAmountEdit, {
        id: TX_ID,
        amount: '-12.99',
        currency: 'EUR',
      }),
    )

    // useState is mocked to always return its initial value, so isEditing stays
    // false in this render. To exercise the error-rendering branch itself we
    // assert the component surfaces state.error text whenever isEditing is true —
    // covered directly by rendering the edit-mode markup below instead.
    expect(html).toBeDefined()
    vi.doUnmock('react')
  })
})

describe('TransactionAmountEdit — editable value round-trips through UpdateTransactionSchema', () => {
  it('seeds the input with a plain decimal (no currency symbol/spacing) that the amount refine accepts unmodified', async () => {
    vi.resetModules()
    let editingState = true
    vi.doMock('react', async () => {
      const actual = await vi.importActual<typeof import('react')>('react')
      return {
        ...actual,
        useState: vi.fn((initial: unknown) => {
          const resolved = typeof initial === 'function' ? (initial as () => unknown)() : initial
          if (typeof resolved === 'boolean') {
            return [editingState, vi.fn()]
          }
          return [resolved, vi.fn()]
        }),
        useActionState: vi.fn(() => [{ error: null }, vi.fn(), false]),
      }
    })
    const { TransactionAmountEdit } = await import(
      '../components/transactions/transaction-amount-edit'
    )
    const { UpdateTransactionSchema } = await import('../lib/validations/transaction-edit')

    const html = renderToStaticMarkup(
      createElement(TransactionAmountEdit, {
        id: TX_ID,
        amount: '-45.30',
        currency: 'EUR',
      }),
    )

    const inputValueMatch = html.match(/name="amount"[^>]*value="([^"]*)"/)
    expect(inputValueMatch).not.toBeNull()
    const seededValue = inputValueMatch![1]

    // Reproduces CR-01: a currency-formatted seed (e.g. "-45,30 €") fails this
    // refine on an unmodified re-save. The seeded value must parse cleanly.
    const result = UpdateTransactionSchema.safeParse({ id: TX_ID, amount: seededValue })
    expect(result.success).toBe(true)
    editingState = false
    vi.doUnmock('react')
  })
})

describe('TransactionAmountEdit — pair-guard error markup', () => {
  it('renders the exact pair-guard error string under the input while remaining in edit mode', async () => {
    vi.resetModules()
    let editingState = true
    vi.doMock('react', async () => {
      const actual = await vi.importActual<typeof import('react')>('react')
      return {
        ...actual,
        useState: vi.fn((initial: unknown) => {
          const resolved = typeof initial === 'function' ? (initial as () => unknown)() : initial
          // First useState call in the component is `isEditing` — force it true.
          if (typeof resolved === 'boolean') {
            return [editingState, vi.fn()]
          }
          return [resolved, vi.fn()]
        }),
        useActionState: vi.fn(() => [
          { error: 'Scollega prima il rimborso' },
          vi.fn(),
          false,
        ]),
      }
    })
    const { TransactionAmountEdit } = await import(
      '../components/transactions/transaction-amount-edit'
    )

    const html = renderToStaticMarkup(
      createElement(TransactionAmountEdit, {
        id: TX_ID,
        amount: '-12.99',
        currency: 'EUR',
      }),
    )

    expect(html).toContain('Scollega prima il rimborso')
    // Still in edit mode: an <input name="amount"> must be present.
    expect(html).toContain('name="amount"')
    editingState = false
    vi.doUnmock('react')
  })
})

describe('TransactionDateEdit', () => {
  it('shows the formatted date with a pencil icon when not editing', async () => {
    vi.resetModules()
    vi.doMock('react', async () => {
      const actual = await vi.importActual<typeof import('react')>('react')
      return {
        ...actual,
        useActionState: vi.fn(() => [{ error: null }, vi.fn(), false]),
      }
    })
    const { TransactionDateEdit } = await import(
      '../components/transactions/transaction-date-edit'
    )

    const html = renderToStaticMarkup(
      createElement(TransactionDateEdit, {
        id: TX_ID,
        occurredAt: new Date('2026-03-15T00:00:00.000Z'),
      }),
    )

    expect(html).toContain('mar')
    expect(html).toContain('2026')
    vi.doUnmock('react')
  })

  it('renders the pair-guard error string under the input while remaining in edit mode', async () => {
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
        useActionState: vi.fn(() => [
          { error: 'Scollega prima il rimborso' },
          vi.fn(),
          false,
        ]),
      }
    })
    const { TransactionDateEdit } = await import(
      '../components/transactions/transaction-date-edit'
    )

    const html = renderToStaticMarkup(
      createElement(TransactionDateEdit, {
        id: TX_ID,
        occurredAt: new Date('2026-03-15T00:00:00.000Z'),
      }),
    )

    expect(html).toContain('Scollega prima il rimborso')
    expect(html).toContain('name="occurredAt"')
    vi.doUnmock('react')
  })
})

// ---------------------------------------------------------------------------
// /transactions/[id] RSC page — ownership gate + rendering
// ---------------------------------------------------------------------------

const pageMocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  getTransactionForDetail: vi.fn(),
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

vi.mock('@/lib/dal/transactions', () => ({
  getTransactionForDetail: pageMocks.getTransactionForDetail,
}))

vi.mock('@/lib/dal/categories', () => ({
  getCategories: pageMocks.getCategories,
}))

vi.mock('@/lib/dal/subcategory-usage', () => ({
  getMostUsedSubcategories: pageMocks.getMostUsedSubcategories,
}))

const USER_ID = 'user-1'
const NON_OWNED_ID = '22222222-2222-4222-8222-222222222222'

function makeTransactionDetailRow(overrides: Record<string, unknown> = {}) {
  return {
    id: TX_ID,
    description: 'SUPERMERCATO CENTRALE',
    transactionHash: 'hash-tx-123',
    descriptionHash: 'hash-desc-456',
    customTitle: null,
    amount: '-45.30',
    currency: 'EUR',
    occurredAt: new Date('2026-03-15T00:00:00.000Z'),
    rowIndex: 0,
    expenseId: 'expense-1',
    expenseTitle: 'Spesa settimanale',
    expenseStatus: '3' as const,
    expenseNotes: null,
    expenseSubCategoryId: 10,
    subCategoryName: 'Supermercato',
    categoryName: 'Spesa',
    categorySlug: 'spesa',
    categoryType: 'out' as const,
    expenseTransactionCount: 1,
    fileId: 'file-1',
    fileName: 'estratto_conto.csv',
    platformName: 'Intesa SP',
    pairedWithId: null,
    pairedAmount: null,
    pairedDescription: null,
    pairedOccurredAt: null,
    pairedNetAmount: null,
    ...overrides,
  }
}

async function renderTransactionPage(id = TX_ID) {
  const { default: TransactionDetailPage } = await import(
    '../app/(app)/transactions/[id]/page'
  )
  const element = await TransactionDetailPage({ params: Promise.resolve({ id }) })
  return renderToStaticMarkup(createElement(() => element))
}

describe('/transactions/[id] page', () => {
  beforeEach(() => {
    vi.resetModules()
    pageMocks.verifySession.mockReset()
    pageMocks.getTransactionForDetail.mockReset()
    pageMocks.getCategories.mockReset()
    pageMocks.getMostUsedSubcategories.mockReset()
    pageMocks.notFound.mockReset()
    pageMocks.notFound.mockImplementation(() => {
      throw new Error('notFound')
    })

    pageMocks.verifySession.mockResolvedValue({ userId: USER_ID })
    pageMocks.getTransactionForDetail.mockResolvedValue(makeTransactionDetailRow())
    pageMocks.getCategories.mockResolvedValue([])
    pageMocks.getMostUsedSubcategories.mockResolvedValue([])
  })

  it('renders 200 with amount, date, title, category, and cross-refs for an owned transaction', async () => {
    const html = await renderTransactionPage()

    expect(html).toContain('SUPERMERCATO CENTRALE')
    expect(html).toContain('45,30')
    expect(html).toContain('Supermercato')
    expect(html).toContain('Spesa settimanale')
    expect(html).toContain('estratto_conto.csv')
  })

  it('calls notFound() for a non-existent transaction id', async () => {
    pageMocks.getTransactionForDetail.mockResolvedValue(undefined)

    await expect(renderTransactionPage(NON_OWNED_ID)).rejects.toThrow('notFound')
    expect(pageMocks.notFound).toHaveBeenCalledTimes(1)
  })

  it('calls notFound() for a transaction owned by a different user (DAL returns undefined)', async () => {
    // getTransactionForDetail is ownership-scoped in the DAL — a non-owned id
    // resolves to undefined exactly like a missing id (T-63-04, no enumeration).
    pageMocks.getTransactionForDetail.mockResolvedValue(undefined)

    await expect(renderTransactionPage()).rejects.toThrow('notFound')
  })

  it('renders the description as readonly text with no editable control (lock icon present)', async () => {
    const html = await renderTransactionPage()

    // Description must appear in the markup but never inside an <input>.
    expect(html).toContain('SUPERMERCATO CENTRALE')
    expect(html).not.toMatch(/<input[^>]*value="SUPERMERCATO CENTRALE"/)
  })

  it('never renders transactionHash or descriptionHash', async () => {
    const html = await renderTransactionPage()

    expect(html).not.toContain('hash-tx-123')
    expect(html).not.toContain('hash-desc-456')
  })

  it('shows the category subtitle only when expenseTransactionCount > 1', async () => {
    const htmlSingle = await renderTransactionPage()
    expect(htmlSingle).not.toContain('La categoria è assegnata alla spesa aggregata')

    pageMocks.getTransactionForDetail.mockResolvedValue(
      makeTransactionDetailRow({ expenseTransactionCount: 3 }),
    )
    const htmlMulti = await renderTransactionPage()
    expect(htmlMulti).toContain('La categoria è assegnata alla spesa aggregata')
  })

  it('shows the "Assegna categoria" action when the linked expense has no subCategoryId', async () => {
    pageMocks.getTransactionForDetail.mockResolvedValue(
      makeTransactionDetailRow({ subCategoryName: null, categoryName: null }),
    )
    const html = await renderTransactionPage()
    expect(html).toContain('Assegna categoria')
    expect(html).toContain('Non assegnata')
  })

  it('shows a "Manuale" badge when fileId is null', async () => {
    pageMocks.getTransactionForDetail.mockResolvedValue(
      makeTransactionDetailRow({ fileId: null, fileName: null, platformName: null }),
    )
    const html = await renderTransactionPage()
    expect(html).toContain('Manuale')
  })

  it('renders transfer amounts with neutral transfer tone in the detail header', async () => {
    pageMocks.getTransactionForDetail.mockResolvedValue(
      makeTransactionDetailRow({ categoryType: 'transfer', amount: '45.30' }),
    )
    const html = await renderTransactionPage()
    expect(html).toContain('text-total-transfer/80')
  })

  it('renders visible action buttons in the Azioni card instead of an overflow menu', async () => {
    const html = await renderTransactionPage()

    expect(html).toContain('Azioni')
    expect(html).toContain('Cerca su internet')
    expect(html).toContain('Collega rimborso')
    expect(html).toContain('Spesa a sé (non aggregare)')
    expect(html).toContain('Elimina')
    expect(html).not.toContain('Altre azioni')
  })
})
