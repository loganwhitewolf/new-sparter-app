// Real-Postgres regression harness (Phase 73, ADR 0018 D-07 — the phase's acceptance gate).
//
// This is the ONLY place in the suite that connects to and TRUNCATEs a real Postgres database
// (T-73-03). It is hard-guarded to localhost/127.0.0.1 only — never the app's ambient
// DATABASE_URL, never staging or production, even via TEST_DATABASE_URL override.
import path from 'node:path'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { vi } from 'vitest'
import * as schema from '@/lib/db/schema'

const DEFAULT_TEST_DATABASE_URL = 'postgres://postgres:sparter@localhost:5432/sparter'
const CONNECT_TIMEOUT_MS = 1500
const MIGRATIONS_FOLDER = path.join(process.cwd(), 'drizzle/migrations')

// Arbitrary fixed key (Phase 73 Plan 02) for a session-level Postgres advisory lock — see the
// serialization comment in connectReimbursementTestDb() below.
const HARNESS_ADVISORY_LOCK_KEY = 731_302

export type ReimbursementTestDb = ReturnType<typeof drizzle<typeof schema>>

export type ReimbursementTestDbHandle =
  | { ok: true; db: ReimbursementTestDb; pool: Pool }
  | { ok: false }

/**
 * Resolves the harness's connection string and asserts it targets localhost. Throws (never
 * silently falls back) if TEST_DATABASE_URL points anywhere else — this guard is what keeps
 * "TRUNCATE a real database" scoped to a disposable local dev instance (T-73-03).
 */
function resolveConnectionString(): string {
  const url = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL
  let hostname: string
  try {
    hostname = new URL(url).hostname
  } catch {
    throw new Error(
      `reimbursement-test-db: TEST_DATABASE_URL is not a valid connection string: "${url}"`,
    )
  }
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    throw new Error(
      `reimbursement-test-db: refusing to connect to non-local host "${hostname}". ` +
        'This harness must never target a real dev/staging/production database.',
    )
  }
  return url
}

/**
 * Connects to the local Postgres container, running the real migration set against it
 * (idempotent — safe against an already-migrated or a completely fresh container). Returns
 * `{ ok: false }` instead of throwing when the container is unreachable, so the calling test
 * file can skip gracefully (with a console warning) rather than fail the whole suite when
 * Docker is not running.
 */
export async function connectReimbursementTestDb(): Promise<ReimbursementTestDbHandle> {
  const connectionString = resolveConnectionString()
  // idleTimeoutMillis: 0 disables pg's default 10s idle-connection reaping. Required so the
  // advisory-lock-holding connection below is never silently closed (which would release the
  // lock early) purely because it sat idle between this file's queries.
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    idleTimeoutMillis: 0,
  })

  try {
    await pool.query('SELECT 1')
  } catch {
    await pool.end().catch(() => undefined)
    console.warn(
      '[reimbursement-test-db] Local Postgres unreachable at ' +
        `${connectionString.replace(/:[^:@]+@/, ':***@')} — run \`yarn db:up\` to start it.`,
    )
    return { ok: false }
  }

  // Serialize cross-FILE access to this shared local Postgres instance (Phase 73 Plan 02,
  // discovered during Task 2): vitest runs separate test files in parallel worker
  // processes/threads by default, and each file that uses this harness opens its OWN pool and
  // calls resetReimbursementFixtures() (TRUNCATE) independently. Without serialization, two
  // files' resets/inserts against overlapping tables interleave and corrupt each other's
  // fixtures (observed: FK violations, unique-constraint violations across
  // reimbursement-regression.test.ts and migration-backfill.test.ts running together).
  //
  // A session-level Postgres advisory lock, acquired on a dedicated connection and held for
  // this pool's entire lifetime, guarantees only one file's suite touches the harness DB at a
  // time — a second file's connectReimbursementTestDb() call blocks here until the first file's
  // afterAll calls pool.end() and the lock-holding connection closes (which releases every
  // session-level advisory lock it held, per Postgres semantics — no explicit unlock needed).
  try {
    const lockClient = await pool.connect()
    await lockClient.query('SELECT pg_advisory_lock($1)', [HARNESS_ADVISORY_LOCK_KEY])
    lockClient.release()
  } catch (error) {
    await pool.end().catch(() => undefined)
    console.warn('[reimbursement-test-db] Failed to acquire the harness advisory lock:', error)
    return { ok: false }
  }

  const db = drizzle(pool, { schema })

  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
  } catch (error) {
    await pool.end().catch(() => undefined)
    console.warn('[reimbursement-test-db] Migration against the local harness DB failed:', error)
    return { ok: false }
  }

  return { ok: true, db, pool }
}

// Every table this harness seeds (Task 3 fixtures) — RESTART IDENTITY resets serial PKs so
// tests get deterministic, low-valued ids run to run. CASCADE handles FK ordering.
const FIXTURE_TABLES = [
  'transaction_tag',
  'tag',
  'reimbursement_refund',
  'reimbursement',
  'transaction',
  'expense_group_membership',
  'expense_group',
  'expense',
  'file',
  'import_format_version',
  'platform',
  'sub_category',
  'category',
  'nature',
  'direction',
  'user',
] as const

export async function resetReimbursementFixtures(db: ReimbursementTestDb): Promise<void> {
  const tableList = FIXTURE_TABLES.map((t) => `"${t}"`).join(', ')
  await db.execute(sql.raw(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE;`))
}

// `applyReimbursementBackfillMigration` (re-applying drizzle/migrations/0029_reimbursement_
// backfill.sql standalone against an already-migrated harness DB) was retired in Plan 73-04
// Task 3: migration 0029 reads FROM transaction_pair, which no longer exists once migration
// 0030_drop_transaction_pair.sql has run (locked option-b, applied automatically by this
// harness's own migrate() call above) — there is nothing left to re-apply it against. Its only
// callers (tests/migration-backfill.test.ts, the N=1 regression's "before" capture) are retired
// alongside it; the numeric correctness it proved is preserved in 73-01-SUMMARY.md /
// 73-02-SUMMARY.md.

// The frozen, pre-Task-2 effectiveAmount()/isNotSecondary() implementation that used to read
// transaction_pair directly (Phase 73 Plan 01/02's "before" comparison baseline) was retired
// in Plan 73-04 Task 3, alongside the `useFrozenFragment` snapshot mode below: transaction_pair
// no longer exists once migration 0030_drop_transaction_pair.sql has run (locked option-b), so
// there is no longer a live "before" data source to construct that comparison from. The
// before/after byte-identical proof this mode enabled is preserved historically in
// 73-01-SUMMARY.md / 73-02-SUMMARY.md (test run 177d200 / 8306086); this harness now only proves
// the CURRENT reimbursement/reimbursement_refund read path.

export type CaptureAggregationSnapshotInput = {
  harnessDb: ReimbursementTestDb
  userId: string
  dateRange: { from: Date; to: Date }
  categoryId: number
  tagId: number
}

// Loosely typed on purpose: the 10 functions live across 3 modules with return shapes that are
// partly private (non-exported) types. Callers narrow via the real exported types from
// '@/lib/dal/dashboard' / '@/lib/dal/overview' / '@/lib/dal/tags' at the assertion site.
export type AggregationSnapshot = Record<string, unknown>

/**
 * The reusable technique the regression suite uses to prove correctness across every
 * aggregation function that consumes effectiveAmount()/isNotSecondary() — not only the two
 * research inventoried. Runs the REAL, unmodified production query bodies (dashboard.ts /
 * overview.ts / tags.ts) against the harness's own host-guarded db client.
 */
export async function captureAggregationSnapshot(
  input: CaptureAggregationSnapshotInput,
): Promise<AggregationSnapshot> {
  const { harnessDb, userId, dateRange, categoryId, tagId } = input

  // CRITICAL: never let the 10 production functions build their own connection off the ambient
  // process.env.DATABASE_URL (lib/db/index.ts constructs a fresh pg.Pool from that env var at
  // module-eval time) — feed them the harness's own already-host-guarded client instead.
  vi.doMock('@/lib/db', () => ({ db: harnessDb }))
  vi.doUnmock('@/lib/dal/transaction-pairs-sql')

  vi.resetModules()

  const dashboardModule = await import('@/lib/dal/dashboard')
  const overviewModule = await import('@/lib/dal/overview')
  const tagsModule = await import('@/lib/dal/tags')

  const filters = { preset: 'last-month' as const, type: 'all' as const, sort: 'amount' as const }
  const year = dateRange.from.getFullYear()
  const monthIndex = dateRange.from.getMonth()

  const [
    overviewAmountTotals,
    categoriesBreakdown,
    categoryRanking,
    categoryDeviations,
    categoryDetail,
    monthlyTrendByNature,
    monthOverMonthCategoryChanges,
    overviewChart,
    tagTotals,
    tagDetail,
  ] = await Promise.all([
    dashboardModule.getOverviewAmountTotals(userId, dateRange.from, dateRange.to),
    dashboardModule.getCategoriesBreakdown(filters),
    dashboardModule.getCategoryRanking(filters),
    dashboardModule.getCategoryDeviations({ type: 'all' }),
    dashboardModule.getCategoryDetail(categoryId, filters),
    dashboardModule.getMonthlyTrendByNature(filters.preset),
    overviewModule.getMonthOverMonthCategoryChanges(year, monthIndex, 'out', 10),
    overviewModule.getOverviewChart(year),
    tagsModule.getTagTotals(userId),
    tagsModule.getTagDetail(userId, tagId),
  ])

  return {
    getOverviewAmountTotals: overviewAmountTotals,
    getCategoriesBreakdown: categoriesBreakdown,
    getCategoryRanking: categoryRanking,
    getCategoryDeviations: categoryDeviations,
    getCategoryDetail: categoryDetail,
    getMonthlyTrendByNature: monthlyTrendByNature,
    getMonthOverMonthCategoryChanges: monthOverMonthCategoryChanges,
    getOverviewChart: overviewChart,
    getTagTotals: tagTotals,
    getTagDetail: tagDetail,
  }
}
