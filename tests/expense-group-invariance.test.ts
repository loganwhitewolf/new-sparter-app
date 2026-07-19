import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// GRP-09 acceptance test — Phase 66 Plan 03.
//
// Drives the REAL mergeExpenses / categorizeExpenseGroup / dissolveExpenseGroupAction
// / categorizeExpense server actions (lib/actions/expenses.ts) and the REAL
// createExpenseGroup / dissolveExpenseGroup services (lib/services/expense-group.ts)
// against a stateful in-memory fake `db` — only the Postgres boundary is faked.
// The aggregate snapshot uses the REAL buildBreakdownData export from
// lib/dal/dashboard.ts; only the SQL GROUP BY step is hand-computed here.
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  isSubCategoryVisibleToUser: vi.fn(),
  writeClassificationHistory: vi.fn(),
  revalidateCategorizationSurfaces: vi.fn(),
  // Set per-test to a fresh createFixtureDb().db instance (see below). The
  // @/lib/db mock proxies every call to whatever this currently points to,
  // which is how a single hoisted vi.mock factory can still serve fully
  // independent fixture state across the two scenarios in this file.
  // Type-only reference to FixtureDb (declared later in this module) is safe:
  // types are erased at compile time, so this forward reference never needs
  // to exist at vi.hoisted's runtime-hoisted call site.
  currentDb: undefined as unknown as FixtureDb,
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/dal/auth', () => ({
  verifySession: mocks.verifySession,
}))

vi.mock('@/lib/dal/categories', () => ({
  isSubCategoryVisibleToUser: mocks.isSubCategoryVisibleToUser,
}))

vi.mock('@/lib/dal/classification-history', () => ({
  writeClassificationHistory: mocks.writeClassificationHistory,
}))

vi.mock('@/lib/actions/revalidation', () => ({
  revalidateCategorizationSurfaces: mocks.revalidateCategorizationSurfaces,
}))

// Same schema-mock shape as tests/expense-actions.test.ts — lib/actions/expenses.ts
// transitively imports lib/dal/expenses.ts, which computes a few sql`` sort-key
// constants at MODULE SCOPE (expenseTitleSortKey etc.) referencing category.name /
// subCategory.name / userSubcategoryOverride.customName / expense.title directly —
// these table exports must exist (even as minimal stubs) or the import throws.
vi.mock('@/lib/db/schema', () => ({
  expense: {
    id: 'expense.id',
    userId: 'expense.userId',
    subCategoryId: 'expense.subCategoryId',
    status: 'expense.status',
    title: 'expense.title',
    totalAmount: 'expense.totalAmount',
    updatedAt: 'expense.updatedAt',
  },
  expenseGroup: {
    id: 'expenseGroup.id',
    userId: 'expenseGroup.userId',
    subCategoryId: 'expenseGroup.subCategoryId',
    updatedAt: 'expenseGroup.updatedAt',
  },
  expenseGroupMembership: {
    id: 'expenseGroupMembership.id',
    groupId: 'expenseGroupMembership.groupId',
    expenseId: 'expenseGroupMembership.expenseId',
  },
  category: { name: 'category.name' },
  subCategory: { name: 'subCategory.name' },
  userSubcategoryOverride: { customName: 'userSubcategoryOverride.customName' },
  direction: {},
  file: {},
  importFormatVersion: {},
  nature: {},
  platform: {},
  transaction: {},
}))

vi.mock('drizzle-orm', () => ({
  eq: (left: unknown, right: unknown) => ({ op: 'eq', left, right }),
  and: (...args: unknown[]) => ({ op: 'and', args }),
  or: (...args: unknown[]) => ({ op: 'or', args }),
  isNull: (col: unknown) => ({ op: 'isNull', col }),
  inArray: (col: unknown, values: unknown) => ({ op: 'inArray', col, values }),
  count: (col?: unknown) => ({ op: 'count', col }),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({ op: 'sql', strings, values }),
    { raw: (query: string) => ({ op: 'sql.raw', query }) },
  ),
}))

vi.mock('@/lib/db', () => ({
  db: {
    transaction: (fn: (tx: unknown) => Promise<unknown>) => mocks.currentDb.transaction(fn),
    select: (fields?: Record<string, string>) => mocks.currentDb.select(fields),
    update: (table: unknown) => mocks.currentDb.update(table),
    insert: (table: unknown) => mocks.currentDb.insert(table),
    delete: (table: unknown) => mocks.currentDb.delete(table),
  },
}))

import { expense, expenseGroup, expenseGroupMembership } from '@/lib/db/schema'
import {
  mergeExpenses,
  categorizeExpense,
  categorizeExpenseGroup,
  dissolveExpenseGroupAction,
} from '@/lib/actions/expenses'
import { buildBreakdownData, DASHBOARD_TOTAL_EXPENSE_STATUSES } from '@/lib/dal/dashboard'
import type { BreakdownCategory } from '@/lib/dal/dashboard'
import { toDecimal, toDbDecimal } from '@/lib/utils/decimal'

const FIXTURE_USER_ID = 'user-fixture-1'

const EXP_1 = '11111111-1111-4111-8111-111111111111'
const EXP_2 = '22222222-2222-4222-8222-222222222222'
const EXP_3 = '33333333-3333-4333-8333-333333333333'
const EXP_CONTROL = '44444444-4444-4444-8444-444444444444'

// Casa/Bollette (pre-merge shared category), Svago/Cinema (untouched control),
// Casa/Affitto (the recategorize target — same parent category as Bollette so
// Assertion B's per-subcategory movement is the thing under test, not a
// category-level move).
const CAT_A_SUB = 101 // Casa / Bollette
const CAT_B_SUB = 201 // Svago / Cinema (control)
const CAT_C_SUB = 102 // Casa / Affitto (recategorize target)

const CASA_CATEGORY_ID = 1
const SVAGO_CATEGORY_ID = 2

const SUB_CATEGORY_LOOKUP: Record<
  number,
  {
    categoryId: number
    categoryName: string
    categorySlug: string
    categoryType: 'out'
    subCategoryName: string
    subCategorySlug: string
  }
> = {
  [CAT_A_SUB]: {
    categoryId: CASA_CATEGORY_ID,
    categoryName: 'Casa',
    categorySlug: 'casa',
    categoryType: 'out',
    subCategoryName: 'Bollette',
    subCategorySlug: 'bollette',
  },
  [CAT_B_SUB]: {
    categoryId: SVAGO_CATEGORY_ID,
    categoryName: 'Svago',
    categorySlug: 'svago',
    categoryType: 'out',
    subCategoryName: 'Cinema',
    subCategorySlug: 'cinema',
  },
  [CAT_C_SUB]: {
    categoryId: CASA_CATEGORY_ID,
    categoryName: 'Casa',
    categorySlug: 'casa',
    categoryType: 'out',
    subCategoryName: 'Affitto',
    subCategorySlug: 'affitto',
  },
}

// ---------------------------------------------------------------------------
// Stateful in-memory fake db — a STATEFUL variant of the STATIC
// makeDbOrTx precedent in tests/expense-group-service.test.ts: mutations
// from one call must be visible on the next call, and db.transaction(fn)
// is a pass-through (fn(db) directly, no real transactional semantics),
// matching tests/expense-actions.test.ts's mocks.dbTransaction pattern.
// ---------------------------------------------------------------------------

type FixtureExpense = {
  id: string
  userId: string
  subCategoryId: number | null
  status: '1' | '2' | '3' | '4'
  updatedAt?: Date
}

type FixtureGroup = {
  id: number
  userId: string
  title?: string
  subCategoryId: number | null
  updatedAt?: Date
}

type FixtureMembership = {
  id: number
  groupId: number
  expenseId: string
}

type FixtureDb = {
  transaction: (fn: (tx: FixtureDb) => Promise<unknown>) => Promise<unknown>
  select: (fields?: Record<string, string>) => {
    from: (table: unknown) => SelectChain
  }
  update: (table: unknown) => {
    set: (patch: Record<string, unknown>) => {
      where: (cond: Cond | undefined) => ReturningPromise
    }
  }
  insert: (table: unknown) => {
    values: (rowsOrRow: Record<string, unknown> | Record<string, unknown>[]) => ReturningPromise
  }
  delete: (table: unknown) => {
    where: (cond: Cond | undefined) => Promise<undefined>
  }
}

type Cond = { op: string; args?: Cond[]; col?: string; left?: unknown; right?: unknown }

type SelectChain = {
  innerJoin: (otherTable: unknown, cond: Cond) => SelectChain
  where: (cond: Cond | undefined) => SelectChain
  limit: (n: number) => Promise<Record<string, unknown>[]>
  then: <T>(
    resolve: (value: Record<string, unknown>[]) => T,
    reject?: (reason: unknown) => T,
  ) => Promise<T>
}

type ReturningPromise = Promise<unknown> & {
  returning: (fields?: Record<string, string>) => Promise<Record<string, unknown>[]>
}

/** Resolve a mocked drizzle-orm column-ref string (e.g. 'expense.userId') against
 *  either a nested (per-table-keyed) select row or a flat single-table row. */
function getField(row: Record<string, unknown> | undefined, colRef: string): unknown {
  if (!row) return undefined
  const dot = colRef.indexOf('.')
  const tableName = colRef.slice(0, dot)
  const field = colRef.slice(dot + 1)
  const nested = row[tableName]
  if (nested && typeof nested === 'object') {
    return (nested as Record<string, unknown>)[field]
  }
  return row[field]
}

/** Recursive evaluator for the mocked drizzle-orm descriptor tree (and/or/eq/inArray/isNull). */
function evalCond(row: Record<string, unknown>, cond: Cond | undefined): boolean {
  if (!cond) return true
  switch (cond.op) {
    case 'and':
      return (cond.args ?? []).filter(Boolean).every((c) => evalCond(row, c))
    case 'or':
      return (cond.args ?? []).filter(Boolean).some((c) => evalCond(row, c))
    case 'eq': {
      const left = typeof cond.left === 'string' ? getField(row, cond.left) : cond.left
      const right =
        typeof cond.right === 'string' && cond.right.includes('.')
          ? getField(row, cond.right)
          : cond.right
      return left === right
    }
    case 'inArray': {
      const val = getField(row, cond.col as string)
      const values = (cond as unknown as { values?: unknown[] }).values ?? []
      return values.includes(val)
    }
    case 'isNull':
      return getField(row, cond.col as string) == null
    default:
      return true
  }
}

function createFixtureDb(): { db: FixtureDb; expenses: FixtureExpense[]; groups: FixtureGroup[]; memberships: FixtureMembership[] } {
  const expenses: FixtureExpense[] = []
  const groups: FixtureGroup[] = []
  const memberships: FixtureMembership[] = []
  let nextGroupId = 1
  let nextMembershipId = 1

  function tableInfo(table: unknown): { name: string; rows: Array<Record<string, unknown>> } {
    if (table === expense) return { name: 'expense', rows: expenses as unknown as Array<Record<string, unknown>> }
    if (table === expenseGroup) return { name: 'expenseGroup', rows: groups as unknown as Array<Record<string, unknown>> }
    if (table === expenseGroupMembership)
      return { name: 'expenseGroupMembership', rows: memberships as unknown as Array<Record<string, unknown>> }
    throw new Error(`fixture db: unexpected table reference ${String(table)}`)
  }

  function project(
    nestedRow: Record<string, unknown>,
    fields?: Record<string, string>,
  ): Record<string, unknown> {
    if (!fields) return nestedRow
    const out: Record<string, unknown> = {}
    for (const [key, colRef] of Object.entries(fields)) {
      out[key] = getField(nestedRow, colRef)
    }
    return out
  }

  function makeSelectChain(fields: Record<string, string> | undefined, baseTable: unknown): SelectChain {
    const { name: baseName, rows: baseRows } = tableInfo(baseTable)
    let nestedRows: Array<Record<string, unknown>> = baseRows.map((r) => ({ [baseName]: r }))
    let whereCond: Cond | undefined

    const chain: SelectChain = {
      innerJoin(otherTable: unknown, cond: Cond) {
        const { name: otherName, rows: otherRows } = tableInfo(otherTable)
        const joined: Array<Record<string, unknown>> = []
        for (const base of nestedRows) {
          for (const other of otherRows) {
            const candidate = { ...base, [otherName]: other }
            if (evalCond(candidate, cond)) {
              joined.push(candidate)
            }
          }
        }
        nestedRows = joined
        return chain
      },
      where(cond: Cond | undefined) {
        whereCond = cond
        return chain
      },
      limit(n: number) {
        const filtered = nestedRows.filter((r) => evalCond(r, whereCond))
        return Promise.resolve(filtered.slice(0, n).map((r) => project(r, fields)))
      },
      then(resolve, reject) {
        const filtered = nestedRows.filter((r) => evalCond(r, whereCond))
        return Promise.resolve(filtered.map((r) => project(r, fields))).then(resolve, reject)
      },
    }
    return chain
  }

  const db: FixtureDb = {
    select(fields?: Record<string, string>) {
      return {
        from(table: unknown) {
          return makeSelectChain(fields, table)
        },
      }
    },
    update(table: unknown) {
      const { name, rows } = tableInfo(table)
      return {
        set(patch: Record<string, unknown>) {
          return {
            where(cond: Cond | undefined): ReturningPromise {
              const matched = rows.filter((r) => evalCond(r, cond))
              for (const row of matched) Object.assign(row, patch)
              const resultPromise = Promise.resolve(matched.map((r) => ({ ...r }))) as ReturningPromise
              resultPromise.returning = (retFields?: Record<string, string>) => {
                const nested = matched.map((r) => ({ [name]: r }))
                return Promise.resolve(nested.map((r) => project(r, retFields)))
              }
              return resultPromise
            },
          }
        },
      }
    },
    insert(table: unknown) {
      const { name, rows } = tableInfo(table)
      return {
        values(rowsOrRow: Record<string, unknown> | Record<string, unknown>[]): ReturningPromise {
          const toInsert = Array.isArray(rowsOrRow) ? rowsOrRow : [rowsOrRow]

          if (table === expenseGroupMembership) {
            const dup = toInsert.find((v) => rows.some((r) => r.expenseId === v.expenseId))
            if (dup) {
              const err = new Error('duplicate key value violates unique constraint') as Error & {
                cause?: { code: string }
              }
              err.cause = { code: '23505' }
              const rejected = Promise.reject(err) as ReturningPromise
              rejected.returning = () => Promise.reject(err)
              return rejected
            }
          }

          const inserted = toInsert.map((values) => {
            const newRow: Record<string, unknown> =
              table === expenseGroup
                ? { id: nextGroupId++, ...values }
                : table === expenseGroupMembership
                  ? { id: nextMembershipId++, ...values }
                  : { ...values }
            rows.push(newRow)
            return newRow
          })

          const resultPromise = Promise.resolve(inserted) as ReturningPromise
          resultPromise.returning = (retFields?: Record<string, string>) => {
            const nested = inserted.map((r) => ({ [name]: r }))
            return Promise.resolve(nested.map((r) => project(r, retFields)))
          }
          return resultPromise
        },
      }
    },
    delete(table: unknown) {
      const { rows } = tableInfo(table)
      return {
        where(cond: Cond | undefined) {
          for (let i = rows.length - 1; i >= 0; i -= 1) {
            if (evalCond(rows[i], cond)) rows.splice(i, 1)
          }
          return Promise.resolve(undefined)
        },
      }
    },
    transaction(fn: (tx: FixtureDb) => Promise<unknown>) {
      return fn(db)
    },
  }

  return { db, expenses, groups, memberships }
}

// ---------------------------------------------------------------------------
// Local fixture "transaction" rows — never touched by the fake db above (none
// of mergeExpenses/categorizeExpenseGroup/dissolveExpenseGroupAction/
// categorizeExpense read the transaction table), purely fed into
// snapshotBreakdown to mirror getCategoriesBreakdown's GROUP BY by hand.
// ---------------------------------------------------------------------------

type FixtureTransaction = { id: string; expenseId: string; amount: string }

type BreakdownAggregateRow = {
  categoryId: number | null
  categoryName: string | null
  categorySlug: string | null
  categoryType: 'in' | 'out' | 'allocation' | 'system' | 'transfer' | null
  subCategoryId: number | null
  subCategoryName: string | null
  subCategorySlug: string | null
  count: number | string | null
  amount: string | null
}

/** Mirrors getCategoriesBreakdown's grouping semantics: group by (categoryId,
 *  subCategoryId), amount = abs(sum(transaction.amount)) for transactions whose
 *  owning expense.status is in DASHBOARD_TOTAL_EXPENSE_STATUSES and
 *  expense.subCategoryId is not null, count = count distinct expense.id. Then
 *  delegates to the REAL buildBreakdownData for the percentage/shape step. */
function snapshotBreakdown(
  expenses: FixtureExpense[],
  transactions: FixtureTransaction[],
): BreakdownCategory[] {
  const includedStatuses: readonly string[] = DASHBOARD_TOTAL_EXPENSE_STATUSES
  const expenseById = new Map(expenses.map((e) => [e.id, e]))

  const buckets = new Map<
    string,
    {
      categoryId: number
      categoryName: string
      categorySlug: string
      categoryType: 'out'
      subCategoryId: number
      subCategoryName: string
      subCategorySlug: string
      amount: ReturnType<typeof toDecimal>
      expenseIds: Set<string>
    }
  >()

  for (const tx of transactions) {
    const exp = expenseById.get(tx.expenseId)
    if (!exp) continue
    if (!includedStatuses.includes(exp.status)) continue
    if (exp.subCategoryId === null || exp.subCategoryId === undefined) continue

    const lookup = SUB_CATEGORY_LOOKUP[exp.subCategoryId]
    if (!lookup) continue

    const key = `${lookup.categoryId}:${exp.subCategoryId}`
    const amount = toDecimal(tx.amount).abs()
    const existing = buckets.get(key)

    if (existing) {
      existing.amount = existing.amount.plus(amount)
      existing.expenseIds.add(exp.id)
    } else {
      buckets.set(key, {
        categoryId: lookup.categoryId,
        categoryName: lookup.categoryName,
        categorySlug: lookup.categorySlug,
        categoryType: lookup.categoryType,
        subCategoryId: exp.subCategoryId,
        subCategoryName: lookup.subCategoryName,
        subCategorySlug: lookup.subCategorySlug,
        amount,
        expenseIds: new Set([exp.id]),
      })
    }
  }

  const rows: BreakdownAggregateRow[] = Array.from(buckets.values()).map((b) => ({
    categoryId: b.categoryId,
    categoryName: b.categoryName,
    categorySlug: b.categorySlug,
    categoryType: b.categoryType,
    subCategoryId: b.subCategoryId,
    subCategoryName: b.subCategoryName,
    subCategorySlug: b.subCategorySlug,
    count: b.expenseIds.size,
    amount: toDbDecimal(b.amount),
  }))

  return buildBreakdownData(rows)
}

function subCategoryAmount(
  breakdown: BreakdownCategory[],
  categorySlug: string,
  subCategorySlug: string,
): string {
  const cat = breakdown.find((c) => c.slug === categorySlug)
  const sub = cat?.subCategories.find((s) => s.slug === subCategorySlug)
  return sub?.amount ?? '0.00'
}

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    fd.append(key, value)
  }
  return fd
}

// Shared across the two `it` blocks below — Scenario B asserts its result
// against the exact post-recategorize snapshot captured in Scenario A
// (Assertion B, part 2). Vitest runs `it` blocks within one `describe`
// sequentially in declaration order, so Scenario A always populates this
// before Scenario B reads it.
let snapshotT1FromGroupedPath: BreakdownCategory[] | undefined

describe('GRP-09: merge -> recategorize -> dissolve invariance', () => {
  beforeEach(() => {
    mocks.verifySession.mockReset().mockResolvedValue({ userId: FIXTURE_USER_ID })
    mocks.isSubCategoryVisibleToUser.mockReset().mockResolvedValue(true)
    mocks.writeClassificationHistory.mockReset().mockResolvedValue(undefined)
    mocks.revalidateCategorizationSurfaces.mockReset()
  })

  it('Scenario A (grouped path): merge is a no-op, recategorize moves the total, dissolve is a no-op', async () => {
    const fixture = createFixtureDb()
    mocks.currentDb = fixture.db

    fixture.expenses.push(
      { id: EXP_1, userId: FIXTURE_USER_ID, subCategoryId: CAT_A_SUB, status: '3' },
      { id: EXP_2, userId: FIXTURE_USER_ID, subCategoryId: CAT_A_SUB, status: '3' },
      { id: EXP_3, userId: FIXTURE_USER_ID, subCategoryId: CAT_A_SUB, status: '3' },
      { id: EXP_CONTROL, userId: FIXTURE_USER_ID, subCategoryId: CAT_B_SUB, status: '3' },
    )

    const transactions: FixtureTransaction[] = [
      { id: 'tx-1', expenseId: EXP_1, amount: '-30.00' },
      { id: 'tx-2', expenseId: EXP_2, amount: '-20.00' },
      { id: 'tx-3', expenseId: EXP_3, amount: '-10.00' },
      { id: 'tx-control', expenseId: EXP_CONTROL, amount: '-15.00' },
    ]

    const snapshotT0 = snapshotBreakdown(fixture.expenses, transactions)
    // Fixture sanity check.
    expect(subCategoryAmount(snapshotT0, 'casa', 'bollette')).toBe('60.00')
    expect(subCategoryAmount(snapshotT0, 'svago', 'cinema')).toBe('15.00')

    // --- merge ---
    const mergeResult = await mergeExpenses(
      { error: null },
      makeFormData({
        selectedExpenseIds: JSON.stringify([EXP_1, EXP_2, EXP_3]),
        groupTitle: 'Amazon condiviso',
      }),
    )
    expect(mergeResult.error).toBeNull()
    expect(fixture.groups).toHaveLength(1)
    const insertedGroupId = fixture.groups[0].id

    const snapshotAfterMerge = snapshotBreakdown(fixture.expenses, transactions)
    // Assertion A: merge is byte-identical to pre-merge — pure regrouping.
    expect(JSON.stringify(snapshotAfterMerge)).toBe(JSON.stringify(snapshotT0))

    // --- recategorize the group ---
    const categorizeResult = await categorizeExpenseGroup(
      { error: null },
      makeFormData({ groupId: String(insertedGroupId), subCategoryId: String(CAT_C_SUB) }),
    )
    expect(categorizeResult.error).toBeNull()

    const snapshotT1 = snapshotBreakdown(fixture.expenses, transactions)
    // Assertion B (part 1): recategorize DOES move a total.
    expect(JSON.stringify(snapshotT1)).not.toBe(JSON.stringify(snapshotT0))
    expect(subCategoryAmount(snapshotT1, 'casa', 'bollette')).toBe('0.00')
    expect(subCategoryAmount(snapshotT1, 'casa', 'affitto')).toBe('60.00')
    expect(subCategoryAmount(snapshotT1, 'svago', 'cinema')).toBe('15.00')
    snapshotT1FromGroupedPath = snapshotT1

    // --- dissolve ---
    const dissolveResult = await dissolveExpenseGroupAction(
      { error: null },
      makeFormData({ groupId: String(insertedGroupId) }),
    )
    expect(dissolveResult.error).toBeNull()

    const snapshotT2 = snapshotBreakdown(fixture.expenses, transactions)
    // Assertion C: dissolve is byte-identical to the immediately-prior
    // (post-recategorize) state.
    expect(JSON.stringify(snapshotT2)).toBe(JSON.stringify(snapshotT1))

    // D-09 structural assertion: freed members keep the RECATEGORIZED
    // subcategory — nothing reverted to the pre-merge CAT_A_SUB.
    expect(fixture.expenses.find((e) => e.id === EXP_1)?.subCategoryId).toBe(CAT_C_SUB)
    expect(fixture.expenses.find((e) => e.id === EXP_2)?.subCategoryId).toBe(CAT_C_SUB)
    expect(fixture.expenses.find((e) => e.id === EXP_3)?.subCategoryId).toBe(CAT_C_SUB)
    expect(fixture.memberships.filter((m) => m.groupId === insertedGroupId)).toHaveLength(0)
    expect(fixture.groups.some((g) => g.id === insertedGroupId)).toBe(false)
  })

  it('Scenario B (individual comparison path): recategorizing the same members one at a time produces an IDENTICAL aggregate effect', async () => {
    const fixture = createFixtureDb()
    mocks.currentDb = fixture.db

    // Identical starting state to Scenario A — never grouped.
    fixture.expenses.push(
      { id: EXP_1, userId: FIXTURE_USER_ID, subCategoryId: CAT_A_SUB, status: '3' },
      { id: EXP_2, userId: FIXTURE_USER_ID, subCategoryId: CAT_A_SUB, status: '3' },
      { id: EXP_3, userId: FIXTURE_USER_ID, subCategoryId: CAT_A_SUB, status: '3' },
      { id: EXP_CONTROL, userId: FIXTURE_USER_ID, subCategoryId: CAT_B_SUB, status: '3' },
    )

    const transactions: FixtureTransaction[] = [
      { id: 'tx-1', expenseId: EXP_1, amount: '-30.00' },
      { id: 'tx-2', expenseId: EXP_2, amount: '-20.00' },
      { id: 'tx-3', expenseId: EXP_3, amount: '-10.00' },
      { id: 'tx-control', expenseId: EXP_CONTROL, amount: '-15.00' },
    ]

    for (const expenseId of [EXP_1, EXP_2, EXP_3]) {
      const result = await categorizeExpense(
        { error: null },
        makeFormData({ id: expenseId, subCategoryId: String(CAT_C_SUB) }),
      )
      expect(result.error).toBeNull()
    }

    const snapshotIndividual = snapshotBreakdown(fixture.expenses, transactions)

    // Assertion B (part 2, the actual GRP-09 "no hidden movement" proof): the
    // grouped recategorization's aggregate effect (Scenario A's snapshotT1) is
    // IDENTICAL to recategorizing the same three expenses one at a time.
    expect(snapshotT1FromGroupedPath).toBeDefined()
    expect(JSON.stringify(snapshotIndividual)).toBe(JSON.stringify(snapshotT1FromGroupedPath))
  })
})
