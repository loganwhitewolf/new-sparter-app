// Real-Postgres regression proof for the manual-entry create+amortize atomic path (Phase 77,
// D-10). Uses the same local Postgres harness as tests/amortization-undo.test.ts — the Server
// Action under test (createTransaction, lib/actions/transactions.ts) imports `db` from
// `@/lib/db` at module scope (used directly for the combined db.transaction), so we mock it
// before the dynamic import — same technique as tests/reimbursement-regression.test.ts.
//
// Requires local Docker Postgres (`yarn db:up`). Skips gracefully (console warning, no failure)
// when unreachable, so `vitest run` stays green in sandboxes without Docker.
import { and, count, eq } from 'drizzle-orm'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { verifySession } from '@/lib/dal/auth'
import type { createTransaction as CreateTransaction } from '@/lib/actions/transactions'
import {
  amortizationInstalment as amortizationInstalmentTable,
  amortizationPlan as amortizationPlanTable,
  transaction as transactionTable,
} from '@/lib/db/schema'
import { toDecimal } from '@/lib/utils/decimal'
import {
  connectReimbursementTestDb,
  resetReimbursementFixtures,
  type ReimbursementTestDb,
} from './helpers/reimbursement-test-db'
import { seedUser } from './fixtures/reimbursement-seed'

vi.mock('@/lib/dal/auth', () => ({ verifySession: vi.fn() }))
vi.mock('@/lib/actions/revalidation', () => ({ revalidateCategorizationSurfaces: vi.fn() }))
vi.mock('react', () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }))

const harness = await connectReimbursementTestDb()

// createTransaction composes insertManualTransactionTx (lib/dal/transactions.ts) and
// activatePlanTx (lib/services/amortization-activation.ts -> transaction-detach.ts), all of
// which import the REAL `db` singleton at module scope — never let them build their own
// connection off the ambient process.env.DATABASE_URL.
let createTransaction: typeof CreateTransaction

if (harness.ok) {
  vi.doMock('@/lib/db', () => ({ db: harness.db }))
  vi.resetModules()
  const actionsModule = await import('@/lib/actions/transactions')
  createTransaction = actionsModule.createTransaction
} else {
  console.warn(
    '[amortization-manual-entry] Local Postgres unreachable — run `yarn db:up` to enable this suite. Skipping.',
  )
}

const describeIfReachable = harness.ok ? describe : describe.skip

function requireHarnessDb(): ReimbursementTestDb {
  if (!harness.ok) {
    throw new Error('amortization-manual-entry: harness unreachable — this must be unreachable when skipped')
  }
  return harness.db
}

afterAll(async () => {
  if (harness.ok) {
    await harness.pool.end()
  }
})

function buildFormData(fields: Record<string, string>): FormData {
  const formData = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value)
  }
  return formData
}

async function transactionCountForDescription(
  db: ReimbursementTestDb,
  userId: string,
  description: string,
): Promise<number> {
  const rows = await db
    .select({ count: count() })
    .from(transactionTable)
    .where(and(eq(transactionTable.userId, userId), eq(transactionTable.description, description)))
  return Number(rows[0]?.count ?? 0)
}

async function amortizationPlanCountForTransaction(
  db: ReimbursementTestDb,
  transactionId: string,
): Promise<number> {
  const rows = await db
    .select({ count: count() })
    .from(amortizationPlanTable)
    .where(eq(amortizationPlanTable.transactionId, transactionId))
  return Number(rows[0]?.count ?? 0)
}

describeIfReachable('createTransaction manual-entry create+amortize (Phase 77, D-10)', () => {
  it('creates transaction + plan + instalments in one atomic write when amortizationEnabled is on', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    vi.mocked(verifySession).mockResolvedValue({ userId } as never)

    const description = 'Lavatrice nuova'
    const result = await createTransaction(
      { error: null },
      buildFormData({
        description,
        amount: '-300.00',
        currency: 'EUR',
        occurredAt: '2026-01-15',
        amortizationEnabled: 'on',
        amortizationMonths: '3',
      }),
    )

    expect(result.error).toBeNull()
    expect(result.amortized).toBe(true)
    expect(result.months).toBe(3)

    const txRows = await db
      .select()
      .from(transactionTable)
      .where(and(eq(transactionTable.userId, userId), eq(transactionTable.description, description)))
    expect(txRows).toHaveLength(1)
    const transactionId = txRows[0]!.id

    const planRows = await db
      .select()
      .from(amortizationPlanTable)
      .where(eq(amortizationPlanTable.transactionId, transactionId))
    expect(planRows).toHaveLength(1)
    expect(planRows[0]?.months).toBe(3)

    const instalmentRows = await db
      .select()
      .from(amortizationInstalmentTable)
      .where(eq(amortizationInstalmentTable.planId, planRows[0]!.id))
    expect(instalmentRows).toHaveLength(3)

    const instalmentTotal = instalmentRows.reduce(
      (sum, instalment) => sum.plus(toDecimal(instalment.amount)),
      toDecimal('0'),
    )
    expect(instalmentTotal.equals(toDecimal('-300.00'))).toBe(true)
  })

  it('returns the outflow-only error and creates nothing for a positive amount', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    vi.mocked(verifySession).mockResolvedValue({ userId } as never)

    const description = 'Rimborso positivo'
    const result = await createTransaction(
      { error: null },
      buildFormData({
        description,
        amount: '300.00',
        currency: 'EUR',
        occurredAt: '2026-01-15',
        amortizationEnabled: 'on',
        amortizationMonths: '3',
      }),
    )

    expect(result.error).toBe('Puoi dilazionare solo transazioni in uscita.')
    expect(await transactionCountForDescription(db, userId, description)).toBe(0)
  })

  it('returns the minimum-months error and creates nothing when amortizationMonths is 1', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    vi.mocked(verifySession).mockResolvedValue({ userId } as never)

    const description = 'Un solo mese'
    const result = await createTransaction(
      { error: null },
      buildFormData({
        description,
        amount: '-50.00',
        currency: 'EUR',
        occurredAt: '2026-01-15',
        amortizationEnabled: 'on',
        amortizationMonths: '1',
      }),
    )

    expect(result.error).toBe('Minimo 2 mesi.')
    expect(await transactionCountForDescription(db, userId, description)).toBe(0)
  })

  it('behaves exactly as before this plan when amortizationEnabled is unset (regression safety)', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    vi.mocked(verifySession).mockResolvedValue({ userId } as never)

    const description = 'Spesa manuale normale'
    const result = await createTransaction(
      { error: null },
      buildFormData({
        description,
        amount: '-20.00',
        currency: 'EUR',
        occurredAt: '2026-01-15',
      }),
    )

    expect(result.error).toBeNull()
    expect(result.amortized).toBeUndefined()

    const txRows = await db
      .select()
      .from(transactionTable)
      .where(and(eq(transactionTable.userId, userId), eq(transactionTable.description, description)))
    expect(txRows).toHaveLength(1)

    expect(await amortizationPlanCountForTransaction(db, txRows[0]!.id)).toBe(0)
  })
})
