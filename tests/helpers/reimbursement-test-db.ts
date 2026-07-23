// Real-Postgres regression harness (Phase 73, ADR 0018 D-07 — the phase's acceptance gate).
//
// This is the ONLY place in the suite that connects to and TRUNCATEs a real Postgres database
// (T-73-03). It is hard-guarded to localhost/127.0.0.1 only — never the app's ambient
// DATABASE_URL, never staging or production, even via TEST_DATABASE_URL override.
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { vi } from 'vitest'
import * as schema from '@/lib/db/schema'
import { transaction as transactionTable } from '@/lib/db/schema'

const DEFAULT_TEST_DATABASE_URL = 'postgres://postgres:sparter@localhost:5432/sparter'
const CONNECT_TIMEOUT_MS = 1500
const MIGRATIONS_FOLDER = path.join(process.cwd(), 'drizzle/migrations')

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
  const pool = new Pool({ connectionString, connectionTimeoutMillis: CONNECT_TIMEOUT_MS })

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
  'transaction_pair',
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

/**
 * Applies drizzle/migrations/0029_reimbursement_backfill.sql verbatim against the harness DB —
 * the ACTUAL migration file, not a hand-duplicated copy that could drift from it. Statements are
 * split on the same `--> statement-breakpoint` marker drizzle-kit uses.
 */
export async function applyReimbursementBackfillMigration(db: ReimbursementTestDb): Promise<void> {
  const migrationPath = path.join(MIGRATIONS_FOLDER, '0029_reimbursement_backfill.sql')
  const fileContents = await readFile(migrationPath, 'utf8')
  const statements = fileContents
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  for (const statement of statements) {
    await db.execute(sql.raw(statement))
  }
}

// The frozen, pre-Task-2 effectiveAmount()/isNotSecondary() implementation — captured from
// lib/dal/transaction-pairs-sql.ts as it read BEFORE this plan's Task 2 rewrite (retrievable via
// `git show HEAD~1:lib/dal/transaction-pairs-sql.ts` once Task 2 has committed). This is the
// regression baseline: what "before" meant, reproduced verbatim rather than assumed.
function frozenEffectiveAmount() {
  return sql`(
    CASE
      WHEN EXISTS (
        SELECT 1 FROM transaction_pair tp WHERE tp.transaction_a_id = ${transactionTable.id}
      )
      THEN ${transactionTable.amount}::numeric + (
        SELECT t2.amount::numeric
        FROM transaction_pair tp2
        INNER JOIN transaction t2 ON t2.id = tp2.transaction_b_id
        WHERE tp2.transaction_a_id = ${transactionTable.id}
      )
      ELSE ${transactionTable.amount}::numeric
    END
  )`
}

function frozenIsNotSecondary() {
  return sql`NOT EXISTS (
    SELECT 1 FROM transaction_pair tp
    WHERE tp.transaction_b_id = ${transactionTable.id}
  )`
}

export type CaptureAggregationSnapshotInput = {
  harnessDb: ReimbursementTestDb
  userId: string
  dateRange: { from: Date; to: Date }
  categoryId: number
  tagId: number
  useFrozenFragment: boolean
}

// Loosely typed on purpose: the 10 functions live across 3 modules with return shapes that are
// partly private (non-exported) types. Callers narrow via the real exported types from
// '@/lib/dal/dashboard' / '@/lib/dal/overview' / '@/lib/dal/tags' at the assertion site.
export type AggregationSnapshot = Record<string, unknown>

/**
 * The reusable technique both this task and Plan 73-02's regression suite use to prove equality
 * across every aggregation function that consumes effectiveAmount()/isNotSecondary() — not only
 * the two research inventoried. Runs the REAL, unmodified production query bodies (dashboard.ts /
 * overview.ts / tags.ts) against the harness's own host-guarded db client, swapping only which
 * netting fragment they read (frozen pre-Task-2 vs the current, Task-2-rewritten one).
 */
export async function captureAggregationSnapshot(
  input: CaptureAggregationSnapshotInput,
): Promise<AggregationSnapshot> {
  const { harnessDb, userId, dateRange, categoryId, tagId, useFrozenFragment } = input

  // CRITICAL: never let the 10 production functions build their own connection off the ambient
  // process.env.DATABASE_URL (lib/db/index.ts constructs a fresh pg.Pool from that env var at
  // module-eval time) — feed them the harness's own already-host-guarded client instead.
  vi.doMock('@/lib/db', () => ({ db: harnessDb }))

  if (useFrozenFragment) {
    vi.doMock('@/lib/dal/transaction-pairs-sql', () => ({
      effectiveAmount: frozenEffectiveAmount,
      isNotSecondary: frozenIsNotSecondary,
    }))
  } else {
    vi.doUnmock('@/lib/dal/transaction-pairs-sql')
  }

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
