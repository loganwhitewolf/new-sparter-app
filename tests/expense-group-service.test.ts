import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

vi.mock('@/lib/db/schema', () => ({
  expense: {
    id: 'expense.id',
    userId: 'expense.userId',
  },
  expenseGroup: {
    id: 'expenseGroup.id',
    userId: 'expenseGroup.userId',
    title: 'expenseGroup.title',
    subCategoryId: 'expenseGroup.subCategoryId',
    updatedAt: 'expenseGroup.updatedAt',
  },
  expenseGroupMembership: {
    id: 'expenseGroupMembership.id',
    groupId: 'expenseGroupMembership.groupId',
    expenseId: 'expenseGroupMembership.expenseId',
  },
}))

vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ op: 'and', args }),
  eq: (left: unknown, right: unknown) => ({ op: 'eq', left, right }),
  inArray: (col: unknown, vals: unknown) => ({ op: 'inArray', col, vals }),
}))

import { expense, expenseGroup, expenseGroupMembership } from '@/lib/db/schema'
import { createExpenseGroup, renameExpenseGroup } from '@/lib/services/expense-group'

type DbOrTxMockOptions = {
  ownedRows?: unknown[]
  groupedRows?: unknown[]
  groupInsertRows?: unknown[]
  membershipInsertImpl?: () => Promise<unknown>
  updateRows?: unknown[]
}

function makeDbOrTx(opts: DbOrTxMockOptions) {
  const select = vi.fn(() => ({
    from: vi.fn((table: unknown) => {
      if (table === expense) {
        return { where: vi.fn().mockResolvedValue(opts.ownedRows ?? []) }
      }
      if (table === expenseGroupMembership) {
        return { where: vi.fn().mockResolvedValue(opts.groupedRows ?? []) }
      }
      throw new Error(`unexpected select table: ${String(table)}`)
    }),
  }))

  const insert = vi.fn((table: unknown) => {
    if (table === expenseGroup) {
      return {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue(opts.groupInsertRows ?? [{ id: 1 }]),
        }),
      }
    }
    if (table === expenseGroupMembership) {
      return {
        values: vi.fn(opts.membershipInsertImpl ?? (() => Promise.resolve(undefined))),
      }
    }
    throw new Error(`unexpected insert table: ${String(table)}`)
  })

  const update = vi.fn((table: unknown) => {
    if (table === expenseGroup) {
      return {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue(opts.updateRows ?? []),
          }),
        }),
      }
    }
    throw new Error(`unexpected update table: ${String(table)}`)
  })

  return { select, insert, update } as never
}

describe('createExpenseGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a group and memberships when every id is owned and ungrouped', async () => {
    const dbOrTx = makeDbOrTx({
      ownedRows: [{ id: 'expense-1' }, { id: 'expense-2' }],
      groupedRows: [],
      groupInsertRows: [{ id: 7 }],
    })

    const result = await createExpenseGroup(dbOrTx, {
      userId: 'user-1',
      selectedExpenseIds: ['expense-1', 'expense-2'],
      groupTitle: 'Cherasco 57',
      subCategoryId: 42,
    })

    expect(result).toEqual({ groupId: 7 })
  })

  it('rejects when the ownership-scoped select returns fewer rows than requested (IDOR)', async () => {
    const dbOrTx = makeDbOrTx({
      ownedRows: [{ id: 'expense-1' }], // expense-2 missing or not owned
      groupedRows: [],
    })

    await expect(
      createExpenseGroup(dbOrTx, {
        userId: 'user-1',
        selectedExpenseIds: ['expense-1', 'expense-2'],
        groupTitle: 'Cherasco 57',
        subCategoryId: 42,
      }),
    ).rejects.toThrow('Spesa non trovata o non tua.')
  })

  it('rejects when a pre-check finds a selected expense already grouped', async () => {
    const dbOrTx = makeDbOrTx({
      ownedRows: [{ id: 'expense-1' }, { id: 'expense-2' }],
      groupedRows: [{ expenseId: 'expense-2' }],
    })

    await expect(
      createExpenseGroup(dbOrTx, {
        userId: 'user-1',
        selectedExpenseIds: ['expense-1', 'expense-2'],
        groupTitle: 'Cherasco 57',
        subCategoryId: 42,
      }),
    ).rejects.toThrow('Una spesa selezionata fa già parte di un gruppo.')
  })

  it('translates a 23505 unique-violation race on the membership insert into the same Italian message', async () => {
    const dbOrTx = makeDbOrTx({
      ownedRows: [{ id: 'expense-1' }, { id: 'expense-2' }],
      groupedRows: [],
      groupInsertRows: [{ id: 7 }],
      membershipInsertImpl: () => {
        const err = new Error('duplicate key value violates unique constraint') as Error & {
          cause?: { code: string }
        }
        err.cause = { code: '23505' }
        return Promise.reject(err)
      },
    })

    await expect(
      createExpenseGroup(dbOrTx, {
        userId: 'user-1',
        selectedExpenseIds: ['expense-1', 'expense-2'],
        groupTitle: 'Cherasco 57',
        subCategoryId: 42,
      }),
    ).rejects.toThrow('Una spesa selezionata fa già parte di un gruppo.')
  })
})

describe('renameExpenseGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates the group title and resolves true when the group is owned', async () => {
    const dbOrTx = makeDbOrTx({ updateRows: [{ id: 7 }] })

    const result = await renameExpenseGroup(dbOrTx, {
      userId: 'user-1',
      groupId: 7,
      title: 'Nuovo titolo',
    })

    expect(result).toBe(true)
  })

  it('throws when no group matches both groupId and userId', async () => {
    const dbOrTx = makeDbOrTx({ updateRows: [] })

    await expect(
      renameExpenseGroup(dbOrTx, {
        userId: 'user-1',
        groupId: 999,
        title: 'Nuovo titolo',
      }),
    ).rejects.toThrow('Gruppo non trovato.')
  })
})
