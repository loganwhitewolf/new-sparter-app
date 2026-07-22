import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toDecimal } from '@/lib/utils/decimal'

const mocks = vi.hoisted(() => ({
  fromArgs: [] as unknown[],
  whereArgs: [] as unknown[],
  orderByArgs: [] as unknown[][],
  limitArgs: [] as unknown[],
  queryResult: [] as unknown[],
  selectResults: [] as unknown[][],
  insertArgs: [] as unknown[],
  insertValues: [] as unknown[],
  updateArgs: [] as unknown[],
  updateSets: [] as unknown[],
  returningResult: [] as unknown[],
  selectArgs: [] as unknown[],
  leftJoinArgs: [] as unknown[],
  innerJoinCount: 0,
  groupByArgs: [] as unknown[][],
}))

function nextSelectResult() {
  return mocks.selectResults.length > 0 ? mocks.selectResults.shift() : mocks.queryResult
}

function makeQueryChain() {
  const chain = {
    from: vi.fn((arg: unknown) => {
      mocks.fromArgs.push(arg)
      return chain
    }),
    leftJoin: vi.fn((arg: unknown) => {
      mocks.leftJoinArgs.push(arg)
      return chain
    }),
    innerJoin: vi.fn(() => {
      mocks.innerJoinCount += 1
      return chain
    }),
    where: vi.fn((arg: unknown) => {
      mocks.whereArgs.push(arg)
      return chain
    }),
    groupBy: vi.fn((...args: unknown[]) => {
      mocks.groupByArgs.push(args)
      return chain
    }),
    orderBy: vi.fn((...args: unknown[]) => {
      mocks.orderByArgs.push(args)
      return Promise.resolve(mocks.queryResult)
    }),
    limit: vi.fn((arg: unknown) => {
      mocks.limitArgs.push(arg)
      return Promise.resolve(nextSelectResult())
    }),
    then: vi.fn((resolve: (value: unknown[] | undefined) => unknown) => Promise.resolve(resolve(nextSelectResult()))),
  }

  return chain
}

function makeInsertChain() {
  const chain = {
    values: vi.fn((value: unknown) => {
      mocks.insertValues.push(value)
      return chain
    }),
    returning: vi.fn(() => Promise.resolve(mocks.returningResult)),
  }
  return chain
}

function makeUpdateChain() {
  const chain = {
    set: vi.fn((value: unknown) => {
      mocks.updateSets.push(value)
      return chain
    }),
    where: vi.fn((arg: unknown) => {
      mocks.whereArgs.push(arg)
      return chain
    }),
    returning: vi.fn(() => Promise.resolve(mocks.returningResult)),
  }
  return chain
}

function findPredicate(node: unknown, predicate: (candidate: unknown) => boolean): unknown {
  if (predicate(node)) return node

  if (node && typeof node === 'object') {
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          const found = findPredicate(item, predicate)
          if (found) return found
        }
      } else {
        const found = findPredicate(value, predicate)
        if (found) return found
      }
    }
  }

  return undefined
}

function expectContainsPredicate(node: unknown, expected: unknown) {
  expect(findPredicate(node, (candidate) => JSON.stringify(candidate) === JSON.stringify(expected))).toEqual(expected)
}

vi.mock('server-only', () => ({}))
vi.mock('react', () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }))
vi.mock('@/lib/db', () => ({
  db: {
    select: (spec?: unknown) => {
      mocks.selectArgs.push(spec)
      return makeQueryChain()
    },
    insert: (table: unknown) => {
      mocks.insertArgs.push(table)
      return makeInsertChain()
    },
    update: (table: unknown) => {
      mocks.updateArgs.push(table)
      return makeUpdateChain()
    },
  },
}))
// `and`/`asc`/`eq`/`isNotNull` stay simplified (existing tests assert exact
// `{ op, ... }` shapes) — everything else (sql, inArray, ne, etc.) passes
// through to the REAL drizzle-orm, needed by getTagTotals's FILTER predicate
// and by transaction-pairs-sql.ts's effectiveAmount()/isNotSecondary() (both
// real, unmocked modules imported transitively by getTagTotals).
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return {
    ...actual,
    and: (...args: unknown[]) => ({ op: 'and', args }),
    asc: (column: unknown) => ({ op: 'asc', column }),
    eq: (left: unknown, right: unknown) => ({ op: 'eq', left, right }),
    isNotNull: (column: unknown) => ({ op: 'isNotNull', column }),
  }
})
vi.mock('@/lib/dal/dashboard', () => ({
  // getTagTotals only needs the constant — avoid pulling in the real,
  // heavy lib/dal/dashboard.ts module (which transitively imports
  // lib/dal/auth.ts -> next/headers, unnecessary and unmocked in this file).
  DASHBOARD_TOTAL_EXPENSE_STATUSES: ['1', '2', '3'],
}))
vi.mock('@/lib/db/schema', () => ({
  tag: {
    id: 'tag.id',
    userId: 'tag.userId',
    name: 'tag.name',
    normalizedName: 'tag.normalizedName',
    dateRangeStart: 'tag.dateRangeStart',
    dateRangeEnd: 'tag.dateRangeEnd',
    archived: 'tag.archived',
    createdAt: 'tag.createdAt',
  },
  transactionTag: {
    tagId: 'transactionTag.tagId',
    transactionId: 'transactionTag.transactionId',
  },
  transaction: {
    id: 'transaction.id',
    userId: 'transaction.userId',
    expenseId: 'transaction.expenseId',
    amount: 'transaction.amount',
    occurredAt: 'transaction.occurredAt',
  },
  expense: {
    id: 'expense.id',
    status: 'expense.status',
    subCategoryId: 'expense.subCategoryId',
  },
  subCategory: {
    id: 'subCategory.id',
    categoryId: 'subCategory.categoryId',
    natureId: 'subCategory.natureId',
  },
  category: {
    id: 'category.id',
  },
  userSubcategoryOverride: {
    subCategoryId: 'userSubcategoryOverride.subCategoryId',
    userId: 'userSubcategoryOverride.userId',
    natureId: 'userSubcategoryOverride.natureId',
  },
  nature: {
    id: 'nature.id',
    directionId: 'nature.directionId',
  },
  direction: {
    id: 'direction.id',
    code: 'direction.code',
  },
}))

const {
  getTags,
  getTag,
  getActiveTagsWithDateRange,
  getTagByNormalizedName,
  insertTagRow,
  updateTagRow,
  archiveTagRow,
  resolveOwnedTagId,
  getTagTotals,
  buildTagTotalsData,
  buildTagDetailData,
} = await import('@/lib/dal/tags')

// Minimal TagDetailQueryRow factory for the pure buildTagDetailData block — mirrors the
// getTagDetail select shape (occurredAt is only carried through to the tx list, not the sums).
function detailRow(overrides: {
  transactionId: string
  categoryName: string
  directionCode: string
  amount: string
  subCategoryName?: string
  description?: string
}) {
  return {
    transactionId: overrides.transactionId,
    occurredAt: '2026-06-01T00:00:00.000Z',
    description: overrides.description ?? 'Descrizione',
    subCategoryName: overrides.subCategoryName ?? 'Sub',
    categoryName: overrides.categoryName,
    directionCode: overrides.directionCode,
    amount: overrides.amount,
  }
}

describe('lib/dal/tags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fromArgs.length = 0
    mocks.whereArgs.length = 0
    mocks.orderByArgs.length = 0
    mocks.limitArgs.length = 0
    mocks.selectResults.length = 0
    mocks.insertArgs.length = 0
    mocks.insertValues.length = 0
    mocks.updateArgs.length = 0
    mocks.updateSets.length = 0
    mocks.returningResult = []
    mocks.queryResult = []
    mocks.selectArgs.length = 0
    mocks.leftJoinArgs.length = 0
    mocks.innerJoinCount = 0
    mocks.groupByArgs.length = 0
  })

  it('scopes getTags to userId, ordered by createdAt then id asc, and includes archived rows (D-04)', async () => {
    mocks.queryResult = [{ id: 1, userId: 'user-1', archived: true }]

    const result = await getTags('user-1')

    expect(result).toEqual([{ id: 1, userId: 'user-1', archived: true }])
    expectContainsPredicate(mocks.whereArgs[0], { op: 'eq', left: 'tag.userId', right: 'user-1' })
    expect(mocks.orderByArgs[0]).toEqual([
      { op: 'asc', column: 'tag.createdAt' },
      { op: 'asc', column: 'tag.id' },
    ])
  })

  it('resolves to an empty array, never null/throw, for a user with zero tags', async () => {
    mocks.queryResult = []

    await expect(getTags('user-with-none')).resolves.toEqual([])
  })

  it('filters getActiveTagsWithDateRange to archived=false and both range bounds present', async () => {
    mocks.queryResult = []

    await getActiveTagsWithDateRange('user-1')

    expectContainsPredicate(mocks.whereArgs[0], { op: 'eq', left: 'tag.userId', right: 'user-1' })
    expectContainsPredicate(mocks.whereArgs[0], { op: 'eq', left: 'tag.archived', right: false })
    expectContainsPredicate(mocks.whereArgs[0], { op: 'isNotNull', column: 'tag.dateRangeStart' })
    expectContainsPredicate(mocks.whereArgs[0], { op: 'isNotNull', column: 'tag.dateRangeEnd' })
  })

  it('getTagByNormalizedName filters on (userId, normalizedName) and returns the single row', async () => {
    mocks.selectResults.push([{ id: 5, userId: 'user-1', normalizedName: 'sharm' }])

    const result = await getTagByNormalizedName('user-1', 'sharm')

    expect(result).toEqual({ id: 5, userId: 'user-1', normalizedName: 'sharm' })
    expectContainsPredicate(mocks.whereArgs[0], { op: 'eq', left: 'tag.userId', right: 'user-1' })
    expectContainsPredicate(mocks.whereArgs[0], { op: 'eq', left: 'tag.normalizedName', right: 'sharm' })
  })

  it('getTagByNormalizedName returns null when absent', async () => {
    mocks.selectResults.push([])

    await expect(getTagByNormalizedName('user-1', 'nope')).resolves.toBeNull()
  })

  it('getTag scopes to (id, userId) and returns null when not found', async () => {
    mocks.selectResults.push([])

    await expect(getTag('user-1', 99)).resolves.toBeNull()
    expectContainsPredicate(mocks.whereArgs[0], { op: 'eq', left: 'tag.id', right: 99 })
    expectContainsPredicate(mocks.whereArgs[0], { op: 'eq', left: 'tag.userId', right: 'user-1' })
    expect(mocks.limitArgs[0]).toBe(1)
  })

  it('insertTagRow writes the caller-supplied normalizedName verbatim, performing no normalization itself', async () => {
    mocks.returningResult = [{ id: 1, userId: 'user-1', name: '  Sharm ', normalizedName: 'sharm' }]

    const result = await insertTagRow({
      userId: 'user-1',
      name: '  Sharm ',
      normalizedName: 'sharm',
      dateRangeStart: null,
      dateRangeEnd: null,
    })

    expect(result).toEqual({ id: 1, userId: 'user-1', name: '  Sharm ', normalizedName: 'sharm' })
    expect(mocks.insertValues[0]).toEqual({
      userId: 'user-1',
      name: '  Sharm ',
      normalizedName: 'sharm',
      dateRangeStart: null,
      dateRangeEnd: null,
      archived: false,
    })
  })

  it('updateTagRow scopes the update to (id, userId) and returns null when no owned row matches', async () => {
    mocks.returningResult = []

    await expect(updateTagRow('user-1', 5, { name: 'New name' })).resolves.toBeNull()
    expectContainsPredicate(mocks.whereArgs[0], { op: 'eq', left: 'tag.id', right: 5 })
    expectContainsPredicate(mocks.whereArgs[0], { op: 'eq', left: 'tag.userId', right: 'user-1' })
  })

  it('archiveTagRow is the only writer of archived=true and never deletes', async () => {
    mocks.returningResult = [{ id: 5, archived: true }]

    const result = await archiveTagRow('user-1', 5)

    expect(result).toEqual({ id: 5, archived: true })
    expect(mocks.updateSets[0]).toMatchObject({ archived: true })
    expectContainsPredicate(mocks.whereArgs[0], { op: 'eq', left: 'tag.id', right: 5 })
    expectContainsPredicate(mocks.whereArgs[0], { op: 'eq', left: 'tag.userId', right: 'user-1' })
  })

  describe('resolveOwnedTagId (68-01 IDOR defense-in-depth)', () => {
    it('resolves to undefined without calling getTag (no DB call) when candidateTagId is undefined', async () => {
      const result = await resolveOwnedTagId('user-1', undefined)

      expect(result).toBeUndefined()
      expect(mocks.whereArgs).toHaveLength(0)
      expect(mocks.limitArgs).toHaveLength(0)
    })

    it('resolves to undefined (fail-closed) when getTag finds no owned row (foreign or nonexistent tagId)', async () => {
      mocks.selectResults.push([])

      const result = await resolveOwnedTagId('user-1', 999)

      expect(result).toBeUndefined()
      expectContainsPredicate(mocks.whereArgs[0], { op: 'eq', left: 'tag.id', right: 999 })
      expectContainsPredicate(mocks.whereArgs[0], { op: 'eq', left: 'tag.userId', right: 'user-1' })
    })

    it('resolves to the candidateTagId when getTag finds an owned row', async () => {
      mocks.selectResults.push([{ id: 5, userId: 'user-1' }])

      const result = await resolveOwnedTagId('user-1', 5)

      expect(result).toBe(5)
    })
  })

  describe('buildTagTotalsData (pure, unit-testable without a DB)', () => {
    it('shapes a zero-transaction tag row (LEFT JOIN nulls) to count:0, dates null, total 0.00', () => {
      const result = buildTagTotalsData([
        { tagId: 1, name: 'Sharm', archived: false, count: '0', minDate: null, maxDate: null, total: null },
      ])

      expect(result).toEqual([
        { tagId: 1, name: 'Sharm', archived: false, count: 0, minDate: null, maxDate: null, total: '0.00' },
      ])
    })

    it('coerces string count/total from the driver into number/formatted-decimal', () => {
      const result = buildTagTotalsData([
        { tagId: 2, name: 'Viaggi', archived: false, count: '7', minDate: '2026-01-05', maxDate: '2026-03-01', total: '-123.4' },
      ])

      expect(result[0]).toEqual({
        tagId: 2,
        name: 'Viaggi',
        archived: false,
        count: 7,
        minDate: '2026-01-05',
        maxDate: '2026-03-01',
        total: '-123.40',
      })
    })

    it('sorts by absolute total descending, regardless of sign', () => {
      const result = buildTagTotalsData([
        { tagId: 1, name: 'Small positive', archived: false, count: 1, minDate: null, maxDate: null, total: '10.00' },
        { tagId: 2, name: 'Large negative', archived: false, count: 1, minDate: null, maxDate: null, total: '-500.00' },
        { tagId: 3, name: 'Mid positive', archived: false, count: 1, minDate: null, maxDate: null, total: '100.00' },
      ])

      expect(result.map((r) => r.tagId)).toEqual([2, 3, 1])
    })

    it('returns an empty array for zero tags, never null/throw', () => {
      expect(buildTagTotalsData([])).toEqual([])
    })
  })

  describe('buildTagDetailData (pure) — per-category breakdown (TAG-09) + reconciliation (TAG-07/TAG-08)', () => {
    it('groups mixed category rows into one signed-Decimal-summed entry per category with the row count', () => {
      const { breakdown } = buildTagDetailData([
        detailRow({ transactionId: 't1', categoryName: 'Casa', directionCode: 'out', amount: '-100.00' }),
        detailRow({ transactionId: 't2', categoryName: 'Casa', directionCode: 'out', amount: '-50.50' }),
        detailRow({ transactionId: 't3', categoryName: 'Stipendio', directionCode: 'in', amount: '1200.00' }),
      ])

      const casa = breakdown.find((b) => b.categoryName === 'Casa')
      const stipendio = breakdown.find((b) => b.categoryName === 'Stipendio')
      expect(casa).toEqual({ categoryName: 'Casa', total: '-150.50', count: 2 })
      expect(stipendio).toEqual({ categoryName: 'Stipendio', total: '1200.00', count: 1 })
      expect(breakdown).toHaveLength(2)
    })

    it('sorts the breakdown by absolute total descending, regardless of sign', () => {
      const { breakdown } = buildTagDetailData([
        detailRow({ transactionId: 't1', categoryName: 'Small positive', directionCode: 'in', amount: '10.00' }),
        detailRow({ transactionId: 't2', categoryName: 'Large negative', directionCode: 'out', amount: '-500.00' }),
        detailRow({ transactionId: 't3', categoryName: 'Mid positive', directionCode: 'in', amount: '100.00' }),
      ])

      expect(breakdown.map((b) => b.categoryName)).toEqual([
        'Large negative',
        'Mid positive',
        'Small positive',
      ])
    })

    it('reconciles: Σ breakdown.total === net and Σ breakdown.count === count === transactions.length', () => {
      const detail = buildTagDetailData([
        detailRow({ transactionId: 't1', categoryName: 'Casa', directionCode: 'out', amount: '-100.00' }),
        detailRow({ transactionId: 't2', categoryName: 'Stipendio', directionCode: 'in', amount: '1200.00' }),
        detailRow({ transactionId: 't3', categoryName: 'Casa', directionCode: 'out', amount: '-50.50' }),
      ])

      const sumTotal = detail.breakdown.reduce((acc, b) => toDecimal(acc).plus(toDecimal(b.total)).toFixed(2), '0.00')
      const sumCount = detail.breakdown.reduce((acc, b) => acc + b.count, 0)

      expect(sumTotal).toBe(detail.net)
      expect(sumCount).toBe(detail.count)
      expect(sumCount).toBe(detail.transactions.length)
    })

    it('keeps the invariant when an allocation-style row contributes to net but neither inflow nor outflow', () => {
      // directionCode is neither 'in' nor 'out' → it lands in no in/out bucket, yet must still
      // net and land in its category's breakdown bucket (inflow − outflow ≠ net here).
      const detail = buildTagDetailData([
        detailRow({ transactionId: 't1', categoryName: 'Rimborsi', directionCode: 'allocation', amount: '75.00' }),
        detailRow({ transactionId: 't2', categoryName: 'Casa', directionCode: 'out', amount: '-25.00' }),
      ])

      expect(detail.net).toBe('50.00')
      expect(toDecimal(detail.inflow).minus(toDecimal(detail.outflow)).toFixed(2)).not.toBe(detail.net)
      const rimborsi = detail.breakdown.find((b) => b.categoryName === 'Rimborsi')
      expect(rimborsi).toEqual({ categoryName: 'Rimborsi', total: '75.00', count: 1 })
      const sumTotal = detail.breakdown.reduce((acc, b) => toDecimal(acc).plus(toDecimal(b.total)).toFixed(2), '0.00')
      expect(sumTotal).toBe(detail.net)
    })

    it('returns an empty breakdown (and net 0.00, count 0) for zero rows', () => {
      const detail = buildTagDetailData([])

      expect(detail.breakdown).toEqual([])
      expect(detail.net).toBe('0.00')
      expect(detail.count).toBe(0)
    })
  })

  describe('getTagTotals (TAG-05 per-tag aggregate)', () => {
    it('scopes the outer WHERE to ONLY eq(tag.userId, userId) — exclusions live in FILTER, never here', async () => {
      mocks.queryResult = []

      await getTagTotals('user-1')

      expect(mocks.whereArgs).toHaveLength(1)
      expect(mocks.whereArgs[0]).toEqual({ op: 'eq', left: 'tag.userId', right: 'user-1' })
    })

    it('never uses innerJoin (structurally zero-safe — every join is a leftJoin so a zero-transaction tag still surfaces a row)', async () => {
      mocks.queryResult = []

      await getTagTotals('user-1')

      expect(mocks.innerJoinCount).toBe(0)
      expect(mocks.leftJoinArgs.length).toBeGreaterThanOrEqual(7)
    })

    it('embeds the dashboard exclusion set inside a FILTER clause on the select spec, not the outer WHERE', async () => {
      mocks.queryResult = []

      await getTagTotals('user-1')

      const serializedSelect = JSON.stringify(mocks.selectArgs[0])
      expect(serializedSelect).toContain('FILTER')
      // Anti-Pattern guard: the exclusion tokens (status/transfer/pair-netting) must
      // never leak into the outer WHERE — only eq(tag.userId, ...) is asserted there.
      expect(JSON.stringify(mocks.whereArgs[0])).not.toContain('FILTER')
    })

    it('groups by tag.id, tag.name, tag.archived', async () => {
      mocks.queryResult = []

      await getTagTotals('user-1')

      expect(mocks.groupByArgs[0]).toEqual(['tag.id', 'tag.name', 'tag.archived'])
    })

    it('delegates the returned rows through buildTagTotalsData (zero-safe shaping + sort)', async () => {
      mocks.queryResult = [
        { tagId: 1, name: 'Sharm', archived: false, count: '0', minDate: null, maxDate: null, total: '0' },
        { tagId: 2, name: 'Viaggi', archived: true, count: '3', minDate: '2026-01-01', maxDate: '2026-02-01', total: '-250.5' },
      ]

      const result = await getTagTotals('user-1')

      expect(result).toEqual(
        buildTagTotalsData([
          { tagId: 1, name: 'Sharm', archived: false, count: '0', minDate: null, maxDate: null, total: '0' },
          { tagId: 2, name: 'Viaggi', archived: true, count: '3', minDate: '2026-01-01', maxDate: '2026-02-01', total: '-250.5' },
        ]),
      )
      // Viaggi's larger absolute total sorts first.
      expect(result[0].tagId).toBe(2)
      expect(result[0].archived).toBe(true)
    })
  })
})
