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
  count: (col: unknown) => ({ op: 'count', col }),
}))

import { expense, expenseGroup, expenseGroupMembership } from '@/lib/db/schema'
import {
  addExpensesToGroup,
  createExpenseGroup,
  dissolveExpenseGroup,
  removeExpenseFromGroup,
  renameExpenseGroup,
} from '@/lib/services/expense-group'

type DbOrTxMockOptions = {
  ownedRows?: unknown[]
  groupedRows?: unknown[]
  groupInsertRows?: unknown[]
  membershipInsertImpl?: () => Promise<unknown>
  updateRows?: unknown[]
  /** Rows returned by a select on expenseGroup (group ownership check). */
  groupOwnedRows?: unknown[]
  /** Rows returned by the membership-exists check (removeExpenseFromGroup). Falls back to groupedRows. */
  membershipRows?: unknown[]
  /** Rows returned by the membership count query (removeExpenseFromGroup). */
  membershipCountRows?: unknown[]
  membershipDeleteImpl?: () => Promise<unknown>
  groupDeleteImpl?: () => Promise<unknown>
}

function makeDbOrTx(opts: DbOrTxMockOptions) {
  const select = vi.fn((fields?: unknown) => ({
    from: vi.fn((table: unknown) => {
      if (table === expense) {
        return { where: vi.fn().mockResolvedValue(opts.ownedRows ?? []) }
      }
      if (table === expenseGroupMembership) {
        const isCountQuery = !!fields && typeof fields === 'object' && 'count' in (fields as object)
        return {
          where: vi.fn().mockResolvedValue(
            isCountQuery
              ? (opts.membershipCountRows ?? [{ count: 0 }])
              : (opts.membershipRows ?? opts.groupedRows ?? []),
          ),
        }
      }
      if (table === expenseGroup) {
        return { where: vi.fn().mockResolvedValue(opts.groupOwnedRows ?? []) }
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

  const del = vi.fn((table: unknown) => {
    if (table === expenseGroupMembership) {
      return { where: vi.fn(opts.membershipDeleteImpl ?? (() => Promise.resolve(undefined))) }
    }
    if (table === expenseGroup) {
      return { where: vi.fn(opts.groupDeleteImpl ?? (() => Promise.resolve(undefined))) }
    }
    throw new Error(`unexpected delete table: ${String(table)}`)
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

  return { select, insert, update, delete: del } as never
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

describe('addExpensesToGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('inserts memberships when the group is owned and every expense is owned and ungrouped', async () => {
    const dbOrTx = makeDbOrTx({
      groupOwnedRows: [{ id: 7 }],
      ownedRows: [{ id: 'expense-1' }, { id: 'expense-2' }],
      groupedRows: [],
    })

    await expect(
      addExpensesToGroup(dbOrTx, {
        userId: 'user-1',
        groupId: 7,
        expenseIds: ['expense-1', 'expense-2'],
      }),
    ).resolves.toBeUndefined()
  })

  it('throws "Gruppo non trovato." when the group is missing or not owned', async () => {
    const dbOrTx = makeDbOrTx({
      groupOwnedRows: [],
      ownedRows: [{ id: 'expense-1' }],
      groupedRows: [],
    })

    await expect(
      addExpensesToGroup(dbOrTx, {
        userId: 'user-1',
        groupId: 999,
        expenseIds: ['expense-1'],
      }),
    ).rejects.toThrow('Gruppo non trovato.')
  })

  it('rejects on partial ownership of the expenseIds (IDOR)', async () => {
    const dbOrTx = makeDbOrTx({
      groupOwnedRows: [{ id: 7 }],
      ownedRows: [{ id: 'expense-1' }], // expense-2 missing or not owned
      groupedRows: [],
    })

    await expect(
      addExpensesToGroup(dbOrTx, {
        userId: 'user-1',
        groupId: 7,
        expenseIds: ['expense-1', 'expense-2'],
      }),
    ).rejects.toThrow('Spesa non trovata o non tua.')
  })

  it('rejects when a pre-check finds a selected expense already grouped', async () => {
    const dbOrTx = makeDbOrTx({
      groupOwnedRows: [{ id: 7 }],
      ownedRows: [{ id: 'expense-1' }, { id: 'expense-2' }],
      groupedRows: [{ expenseId: 'expense-2' }],
    })

    await expect(
      addExpensesToGroup(dbOrTx, {
        userId: 'user-1',
        groupId: 7,
        expenseIds: ['expense-1', 'expense-2'],
      }),
    ).rejects.toThrow('Una spesa selezionata fa già parte di un gruppo.')
  })

  it('translates a 23505 unique-violation race on the membership insert into the same Italian message', async () => {
    const dbOrTx = makeDbOrTx({
      groupOwnedRows: [{ id: 7 }],
      ownedRows: [{ id: 'expense-1' }, { id: 'expense-2' }],
      groupedRows: [],
      membershipInsertImpl: () => {
        const err = new Error('duplicate key value violates unique constraint') as Error & {
          cause?: { code: string }
        }
        err.cause = { code: '23505' }
        return Promise.reject(err)
      },
    })

    await expect(
      addExpensesToGroup(dbOrTx, {
        userId: 'user-1',
        groupId: 7,
        expenseIds: ['expense-1', 'expense-2'],
      }),
    ).rejects.toThrow('Una spesa selezionata fa già parte di un gruppo.')
  })
})

describe('removeExpenseFromGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes only the membership row when 3+ members remain', async () => {
    const dbOrTx = makeDbOrTx({
      groupOwnedRows: [{ id: 7 }],
      membershipRows: [{ id: 1 }],
      membershipCountRows: [{ count: 3 }],
    })

    const result = await removeExpenseFromGroup(dbOrTx, {
      userId: 'user-1',
      groupId: 7,
      expenseId: 'expense-1',
    })

    expect(result).toEqual({ autoDissolved: false })
  })

  it('also deletes the group row (auto-dissolve) when exactly 1 member will remain', async () => {
    const dbOrTx = makeDbOrTx({
      groupOwnedRows: [{ id: 7 }],
      membershipRows: [{ id: 1 }],
      membershipCountRows: [{ count: 2 }],
    })

    const result = await removeExpenseFromGroup(dbOrTx, {
      userId: 'user-1',
      groupId: 7,
      expenseId: 'expense-1',
    })

    expect(result).toEqual({ autoDissolved: true })
  })

  it('throws "Gruppo non trovato." when the group is missing or not owned', async () => {
    const dbOrTx = makeDbOrTx({
      groupOwnedRows: [],
      membershipRows: [{ id: 1 }],
      membershipCountRows: [{ count: 3 }],
    })

    await expect(
      removeExpenseFromGroup(dbOrTx, {
        userId: 'user-1',
        groupId: 999,
        expenseId: 'expense-1',
      }),
    ).rejects.toThrow('Gruppo non trovato.')
  })

  it('throws "Spesa non trovata nel gruppo." when expenseId is not a member', async () => {
    const dbOrTx = makeDbOrTx({
      groupOwnedRows: [{ id: 7 }],
      membershipRows: [],
      membershipCountRows: [{ count: 3 }],
    })

    await expect(
      removeExpenseFromGroup(dbOrTx, {
        userId: 'user-1',
        groupId: 7,
        expenseId: 'expense-stale',
      }),
    ).rejects.toThrow('Spesa non trovata nel gruppo.')
  })
})

describe('dissolveExpenseGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes all memberships and the group row', async () => {
    const dbOrTx = makeDbOrTx({ groupOwnedRows: [{ id: 7 }] })

    const result = await dissolveExpenseGroup(dbOrTx, { userId: 'user-1', groupId: 7 })

    expect(result).toBe(true)
  })

  it('throws "Gruppo non trovato." when the group is missing or not owned', async () => {
    const dbOrTx = makeDbOrTx({ groupOwnedRows: [] })

    await expect(
      dissolveExpenseGroup(dbOrTx, { userId: 'user-1', groupId: 999 }),
    ).rejects.toThrow('Gruppo non trovato.')
  })
})
