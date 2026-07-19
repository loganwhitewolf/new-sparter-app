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
    pageMocks.notFound.mockReset()
    pageMocks.notFound.mockImplementation(() => {
      throw new Error('notFound')
    })

    pageMocks.verifySession.mockResolvedValue({ userId: USER_ID })
    pageMocks.getExpenseGroupForDetail.mockResolvedValue(makeGroupDetailRow())
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
  })

  it('calls notFound() for a malformed (non-numeric) groupId without calling getExpenseGroupForDetail', async () => {
    await expect(renderGroupPage('abc')).rejects.toThrow('notFound')
    expect(pageMocks.getExpenseGroupForDetail).not.toHaveBeenCalled()
  })
})
