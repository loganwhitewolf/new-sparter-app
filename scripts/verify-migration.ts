// Run with: yarn db:verify | db:verify:staging | db:verify:production (see scripts/db-config.ts)
// Operator verification script for Phase 48 post-migration assertions (D-04, MIG-03).
// Read-only — never mutates rows, never touches transaction table (D-09).
// Re-runnable: safe to execute multiple times against staging or production (D-08).
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { and, isNull, isNotNull, not, sql } from 'drizzle-orm'
import { subCategory, userSubcategoryOverride, categorizationPattern } from '../lib/db/schema'
import {
  getOperatorDatabaseConfig,
  isDirectSupabaseHost,
  loadOperatorEnv,
  operatorConnectionFailureHint,
  pgPoolConfigFromOperatorConfig,
  resolveOperatorDatabaseTarget,
  type OperatorDatabaseDiagnostics,
} from './db-config'

type Db = ReturnType<typeof drizzle>

// ---------------------------------------------------------------------------
// Verification result types
// ---------------------------------------------------------------------------

export type VerificationCounts = {
  /** Active system subcategories (user_id IS NULL, is_active=true) with nature_id IS NULL. Expect 0 (D-04/MIG-02). */
  activeSystemNullNatureCount: number
  /** (pattern, sub_category_id) groups in categorization_pattern with count > 1. Expect 0 (MIG-03/D-11). */
  patternDuplicateCount: number
  /** user_subcategory_override rows with nature_id IS NOT NULL (backfill coverage). Informational (D-02). */
  overrideBackfilledCount: number
  /** User-owned subcategories (user_id IS NOT NULL) with nature_id IS NULL. Allowed (D-03). */
  userOwnedNullNatureCount: number
}

export type ClassificationResult = {
  ok: boolean
  fatal: string[]
  info: string[]
}

// ---------------------------------------------------------------------------
// Pure classifier — testable without DB
// ---------------------------------------------------------------------------

/**
 * Classify collected verification counts into fatal and informational buckets.
 * FATAL: activeSystemNullNatureCount > 0 (D-04) or patternDuplicateCount > 0 (MIG-03).
 * INFORMATIONAL: userOwnedNullNatureCount and overrideBackfilledCount (D-01/D-02/D-03).
 */
export function classifyResults(counts: VerificationCounts): ClassificationResult {
  const fatal: string[] = []
  const info: string[] = []

  if (counts.activeSystemNullNatureCount > 0) {
    fatal.push(
      `D-04 FAIL: ${counts.activeSystemNullNatureCount} active system subcategory row(s) have null nature_id — v2-backfill-nature-id did not complete cleanly`,
    )
  }

  if (counts.patternDuplicateCount > 0) {
    fatal.push(
      `MIG-03 FAIL: ${counts.patternDuplicateCount} (pattern, sub_category_id) duplicate group(s) remain in categorization_pattern — sign-agnostic dedup did not complete cleanly`,
    )
  }

  if (counts.userOwnedNullNatureCount > 0) {
    info.push(
      `INFO: ${counts.userOwnedNullNatureCount} user-owned subcategory row(s) have null nature_id — allowed per D-03 (user-created subcategories may remain unclassified)`,
    )
  }

  info.push(
    `INFO: ${counts.overrideBackfilledCount} user_subcategory_override row(s) have nature_id set (override backfill coverage, D-02)`,
  )

  return {
    ok: fatal.length === 0,
    fatal,
    info,
  }
}

// ---------------------------------------------------------------------------
// DB assertions — read-only queries (D-09: never reads transaction table)
// ---------------------------------------------------------------------------

/**
 * Run targeted SQL assertions against the migrated database.
 * Returns collected counts and the classification result.
 * Never mutates any row; never references the transaction table.
 */
export async function runVerification(database: Db): Promise<{
  counts: VerificationCounts
  classification: ClassificationResult
}> {
  // Assertion 1: active system subcategories with null nature_id (D-04/MIG-02)
  const systemNullResult = await database
    .select({ count: sql<string>`count(*)` })
    .from(subCategory)
    .where(
      and(
        isNull(subCategory.userId),
        sql`${subCategory.isActive} = true`,
        isNull(subCategory.natureId),
      ),
    )
  const activeSystemNullNatureCount = Number(systemNullResult[0]?.count ?? '0')

  // Assertion 2: override backfill coverage — user_subcategory_override rows with nature_id (D-02)
  const overrideResult = await database
    .select({ count: sql<string>`count(*)` })
    .from(userSubcategoryOverride)
    .where(isNotNull(userSubcategoryOverride.natureId))
  const overrideBackfilledCount = Number(overrideResult[0]?.count ?? '0')

  // Assertion 3: user-owned subcategories with null nature_id (D-03 — informational, not fatal)
  const userOwnedNullResult = await database
    .select({ count: sql<string>`count(*)` })
    .from(subCategory)
    .where(and(not(isNull(subCategory.userId)), isNull(subCategory.natureId)))
  const userOwnedNullNatureCount = Number(userOwnedNullResult[0]?.count ?? '0')

  // Assertion 4: (pattern, sub_category_id) duplicates in categorization_pattern (MIG-03/D-11)
  // Subquery counts groups having more than one row per (pattern, sub_category_id)
  const duplicateResult = await database.execute(sql`
    SELECT count(*) AS count
    FROM (
      SELECT 1
      FROM ${categorizationPattern}
      GROUP BY pattern, sub_category_id
      HAVING count(*) > 1
    ) d
  `)
  const patternDuplicateCount = Number((duplicateResult.rows?.[0] as { count?: string } | undefined)?.count ?? '0')

  const counts: VerificationCounts = {
    activeSystemNullNatureCount,
    patternDuplicateCount,
    overrideBackfilledCount,
    userOwnedNullNatureCount,
  }

  const classification = classifyResults(counts)

  return { counts, classification }
}

// ---------------------------------------------------------------------------
// Sanitized diagnostics helper (mirrors migrate.ts safeStatusFields)
// ---------------------------------------------------------------------------

function safeStatusFields(diagnostics: OperatorDatabaseDiagnostics) {
  return {
    target: diagnostics.target,
    sslEnabled: diagnostics.sslEnabled,
    poolMax: diagnostics.poolMax,
    host: diagnostics.host,
  }
}

// ---------------------------------------------------------------------------
// Runner (only when executed directly — tests import without DB)
// ---------------------------------------------------------------------------

const executedDirectly =
  typeof process.argv[1] === 'string' &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])

if (executedDirectly) {
  loadOperatorEnv()

  const verifyTarget = resolveOperatorDatabaseTarget()
  const verifyConfigResult = getOperatorDatabaseConfig({ target: verifyTarget })

  if (!verifyConfigResult.ok) {
    console.error(
      JSON.stringify({
        event: 'verification_failed',
        target: verifyTarget,
        error: verifyConfigResult.error,
      }),
    )
    process.exit(1)
  }

  const { config: verifyConfig, diagnostics: verifyDiagnostics } = verifyConfigResult

  console.log(
    JSON.stringify({
      event: 'verification_started',
      ...safeStatusFields(verifyDiagnostics),
    }),
  )

  if (isDirectSupabaseHost(verifyDiagnostics.host)) {
    const hint = operatorConnectionFailureHint(verifyDiagnostics.host, verifyDiagnostics.target)
    if (hint) console.warn(JSON.stringify({ event: 'verification_connection_warning', message: hint }))
  }

  const pool = new Pool(pgPoolConfigFromOperatorConfig(verifyConfig))
  const db = drizzle(pool)

  runVerification(db)
    .then(({ counts, classification }) => {
      console.log(
        JSON.stringify({
          event: 'verification_results',
          ...safeStatusFields(verifyDiagnostics),
          counts,
          ok: classification.ok,
          fatal: classification.fatal,
          info: classification.info,
        }),
      )

      if (!classification.ok) {
        for (const msg of classification.fatal) {
          console.error(JSON.stringify({ event: 'verification_failed', message: msg }))
        }
        process.exitCode = 1
      }
    })
    .catch((error: unknown) => {
      console.error(
        JSON.stringify({
          event: 'verification_failed',
          ...safeStatusFields(verifyDiagnostics),
          error: String(error),
        }),
      )
      process.exitCode = 1
    })
    .finally(() => pool.end())
}
