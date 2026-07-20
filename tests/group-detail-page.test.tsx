import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const USER_ID = 'user-1'
const GROUP_ID = 42

// ---------------------------------------------------------------------------
// /expenses/groups/[groupId] RSC page — ownership gate + rendering
// ---------------------------------------------------------------------------

const pageMocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  getExpenseGroupForDetail: vi.fn(),
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
  getExpenseGroupForDetail: pageMocks.getExpenseGroupForDetail,
}))

vi.mock('@/lib/dal/categories', () => ({
  getCategories: pageMocks.getCategories,
}))

vi.mock('@/lib/dal/subcategory-usage', () => ({
  getMostUsedSubcategories: pageMocks.getMostUsedSubcategories,
}))

function makeGroupDetailRow(overrides: Record<string, unknown> = {}) {
  return {
    id: GROUP_ID,
    title: 'Vacanza Roma',
    subCategoryId: 10,
    subCategoryName: 'Viaggi',
    categoryName: 'Svago',
    categorySlug: 'svago',
    categoryType: 'out' as const,
    totalAmount: '-150.00',
    transactionCount: 3,
    createdAt: new Date('2026-03-15T00:00:00.000Z'),
    members: [
      {
        id: 'exp-1',
        title: 'Hotel',
        totalAmount: '-100.00',
        transactionCount: 2,
      },
      {
        id: 'exp-2',
        title: 'Treno',
        totalAmount: '-50.00',
        transactionCount: 1,
      },
    ],
    transactions: [
      {
        id: 'tx-1',
        description: 'HOTEL ROMA CENTRO',
        customTitle: null,
        amount: '-70.00',
        currency: 'EUR',
        occurredAt: new Date('2026-03-12T00:00:00.000Z'),
      },
      {
        id: 'tx-2',
        description: 'TRENITALIA',
        customTitle: null,
        amount: '-50.00',
        currency: 'EUR',
        occurredAt: new Date('2026-03-10T00:00:00.000Z'),
      },
      {
        id: 'tx-3',
        description: 'HOTEL ROMA CENTRO EXTRA',
        customTitle: null,
        amount: '-30.00',
        currency: 'EUR',
        occurredAt: new Date('2026-03-08T00:00:00.000Z'),
      },
    ],
    ...overrides,
  }
}

async function renderGroupPage(groupId = String(GROUP_ID)) {
  const { default: GroupDetailPage } = await import(
    '../app/(app)/expenses/groups/[groupId]/page'
  )
  const element = await GroupDetailPage({ params: Promise.resolve({ groupId }) })
  return renderToStaticMarkup(createElement(() => element))
}

describe('/expenses/groups/[groupId] page', () => {
  beforeEach(() => {
    vi.resetModules()
    pageMocks.verifySession.mockReset()
    pageMocks.getExpenseGroupForDetail.mockReset()
    pageMocks.getCategories.mockReset()
    pageMocks.getMostUsedSubcategories.mockReset()
    pageMocks.notFound.mockReset()
    pageMocks.notFound.mockImplementation(() => {
      throw new Error('notFound')
    })

    pageMocks.verifySession.mockResolvedValue({ userId: USER_ID })
    pageMocks.getExpenseGroupForDetail.mockResolvedValue(makeGroupDetailRow())
    pageMocks.getCategories.mockResolvedValue([])
    pageMocks.getMostUsedSubcategories.mockResolvedValue([])
  })

  it('renders the group title, category, members, and transactions on the happy path', async () => {
    const html = await renderGroupPage()

    expect(html).toContain('Vacanza Roma')
    expect(html).toContain('Viaggi')
    expect(html).toContain('Hotel')
    expect(html).toContain('Treno')
    expect(html).toContain('HOTEL ROMA CENTRO')
  })

  it('calls notFound() for a groupId that getExpenseGroupForDetail cannot resolve (missing or non-owned)', async () => {
    pageMocks.getExpenseGroupForDetail.mockResolvedValue(undefined)

    await expect(renderGroupPage()).rejects.toThrow('notFound')
    expect(pageMocks.notFound).toHaveBeenCalledTimes(1)
    expect(pageMocks.getCategories).not.toHaveBeenCalled()
    expect(pageMocks.getMostUsedSubcategories).not.toHaveBeenCalled()
  })

  it('calls notFound() for a malformed (non-numeric) groupId without calling getExpenseGroupForDetail', async () => {
    await expect(renderGroupPage('abc')).rejects.toThrow('notFound')
    expect(pageMocks.getExpenseGroupForDetail).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// GroupDetailClient — shared category (read-only), members, combined transactions
// ---------------------------------------------------------------------------

describe('GroupDetailClient', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  async function renderGroupDetailClient(
    overrides: Record<string, unknown> = {},
    props: Record<string, unknown> = {},
  ) {
    const { GroupDetailClient } = await import('../components/expenses/group-detail-client')
    return renderToStaticMarkup(
      createElement(GroupDetailClient, {
        group: makeGroupDetailRow(overrides),
        categories: [],
        mostUsed: [],
        ...props,
      }),
    )
  }

  it('renders the shared subcategory with a "Cambia categoria" trigger', async () => {
    const html = await renderGroupDetailClient()

    expect(html).toContain('Viaggi')
    expect(html).toContain('Svago')
    expect(html).toContain('Cambia categoria')
  })

  it('renders with empty categories/mostUsed arrays without crashing (cold-start safety)', async () => {
    const html = await renderGroupDetailClient({}, { categories: [], mostUsed: [] })

    expect(html).toContain('Vacanza Roma')
    expect(html).toContain('Cambia categoria')
  })

  it('renders each member with its OWN title and OWN total, linking to its own expense detail page', async () => {
    const html = await renderGroupDetailClient()

    expect(html).toContain('Hotel')
    expect(html).toContain('href="/expenses/exp-1"')
    expect(html).toContain('Treno')
    expect(html).toContain('href="/expenses/exp-2"')
    // members' own totals, not the group's composed total (-150.00)
    expect(html).toContain('100,00')
    expect(html).toContain('50,00')
  })

  it('renders a "Rimuovi dal gruppo" control per member, as a sibling of the title Link (not nested)', async () => {
    const html = await renderGroupDetailClient()

    expect(html).toContain('dal gruppo')
    // The member Link still wraps only the title text, not the remove control:
    // href appears immediately before the truncate title span, and the anchor
    // closes before the remove button markup (no nested <button> inside <a>).
    const linkMatch = html.match(/<a class="[^"]*" href="\/expenses\/exp-1">.*?<\/a>/)
    expect(linkMatch).not.toBeNull()
    expect(linkMatch?.[0]).not.toContain('<button')
  })

  it('renders a member with zero linked transactions normally with a 0,00 € total', async () => {
    const html = await renderGroupDetailClient({
      members: [
        {
          id: 'exp-3',
          title: 'Extra vuoto',
          totalAmount: '0.00',
          transactionCount: 0,
        },
      ],
    })

    expect(html).toContain('Extra vuoto')
    expect(html).toContain('0,00')
  })

  it('renders the combined transaction list spanning every member, in the DAL-provided occurredAt DESC order', async () => {
    const html = await renderGroupDetailClient()

    const idxTx1 = html.indexOf('HOTEL ROMA CENTRO<')
    const idxTx2 = html.indexOf('TRENITALIA')
    const idxTx3 = html.indexOf('HOTEL ROMA CENTRO EXTRA')

    expect(idxTx1).toBeGreaterThan(-1)
    expect(idxTx2).toBeGreaterThan(idxTx1)
    expect(idxTx3).toBeGreaterThan(idxTx2)
  })
})

// ---------------------------------------------------------------------------
// GroupTitleEdit — inline rename control
// ---------------------------------------------------------------------------

describe('GroupTitleEdit', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('renders the title as plain text with no self-link when not editing', async () => {
    vi.doMock('react', async () => {
      const actual = await vi.importActual<typeof import('react')>('react')
      return {
        ...actual,
        useActionState: vi.fn(() => [{ error: null }, vi.fn(), false]),
      }
    })
    const { GroupTitleEdit } = await import('../components/expenses/group-title-edit')

    const html = renderToStaticMarkup(
      createElement(GroupTitleEdit, { groupId: GROUP_ID, title: 'Vacanza Roma' }),
    )

    expect(html).toContain('Vacanza Roma')
    expect(html).not.toContain('<a ')
    vi.doUnmock('react')
  })

  it('renders a hidden groupId input and a title input in edit mode, with no name="id" field', async () => {
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
    const { GroupTitleEdit } = await import('../components/expenses/group-title-edit')

    const html = renderToStaticMarkup(
      createElement(GroupTitleEdit, { groupId: GROUP_ID, title: 'Vacanza Roma' }),
    )

    expect(html).toContain('name="groupId"')
    expect(html).toContain('name="title"')
    expect(html).not.toContain('name="id"')
    vi.doUnmock('react')
  })

  it('disables the Salva button when the value is shorter than 2 trimmed characters', async () => {
    vi.doMock('react', async () => {
      const actual = await vi.importActual<typeof import('react')>('react')
      return {
        ...actual,
        useState: vi.fn((initial: unknown) => {
          const resolved = typeof initial === 'function' ? (initial as () => unknown)() : initial
          if (typeof resolved === 'boolean') {
            return [true, vi.fn()]
          }
          if (resolved === 'Vacanza Roma') {
            return ['a', vi.fn()]
          }
          return [resolved, vi.fn()]
        }),
        useActionState: vi.fn(() => [{ error: null }, vi.fn(), false]),
      }
    })
    const { GroupTitleEdit } = await import('../components/expenses/group-title-edit')

    const html = renderToStaticMarkup(
      createElement(GroupTitleEdit, { groupId: GROUP_ID, title: 'Vacanza Roma' }),
    )

    expect(html).toMatch(/<button type="submit" disabled=""/)
    vi.doUnmock('react')
  })
})
