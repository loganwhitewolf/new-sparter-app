// System categorization pattern seed — full replace of global patterns (userId = null).
// User-created patterns (userId set) are never touched.
//
//   yarn db:seed-patterns              → DATABASE_URL
//   yarn db:seed-patterns:staging      → STAGING_DATABASE_URL
//   yarn db:seed-patterns:production   → PRODUCTION_DATABASE_URL + PRODUCTION_MIGRATION_CONFIRM
//
// Run after yarn db:seed (taxonomy) and yarn db:seed-extras (taxonomy migrations).
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { isNull, sql } from 'drizzle-orm'
import { categorizationPattern, subCategory } from '../lib/db/schema'
import {
  getOperatorDatabaseConfig,
  isDirectSupabaseHost,
  loadOperatorEnv,
  operatorConnectionFailureHint,
  pgPoolConfigFromOperatorConfig,
  resolveOperatorDatabaseTarget,
} from './db-config'
import {
  systemCategorizationPatterns,
  validateSystemCategorizationPatterns,
} from './seed-patterns-data'

loadOperatorEnv()

const seedTarget = resolveOperatorDatabaseTarget()
const seedConfigResult = getOperatorDatabaseConfig({ target: seedTarget })

if (!seedConfigResult.ok) {
  console.error(JSON.stringify({ event: 'seed_patterns_failed', target: seedTarget, error: seedConfigResult.error }))
  process.exit(1)
}

const { config: seedConfig, diagnostics: seedDiagnostics } = seedConfigResult

console.log(
  JSON.stringify({
    event: 'seed_patterns_connection',
    target: seedDiagnostics.target,
    host: seedDiagnostics.host,
    sslEnabled: seedDiagnostics.sslEnabled,
  }),
)

if (isDirectSupabaseHost(seedDiagnostics.host)) {
  const hint = operatorConnectionFailureHint(seedDiagnostics.host, seedDiagnostics.target)
  if (hint) {
    console.warn(JSON.stringify({ event: 'seed_patterns_connection_warning', message: hint }))
  }
}

const pool = new Pool(pgPoolConfigFromOperatorConfig(seedConfig))
const db = drizzle(pool)

async function seedPatterns() {
  console.log(JSON.stringify({ event: 'seed_patterns_started', target: seedDiagnostics.target }))

  const seededSubCategories = await db
    .select({ id: subCategory.id, slug: subCategory.slug })
    .from(subCategory)
    .where(isNull(subCategory.userId))

  const subCategoryIdBySlug = new Map(seededSubCategories.map((row) => [row.slug, row.id]))
  const validation = validateSystemCategorizationPatterns(new Set(subCategoryIdBySlug.keys()))

  if (validation.missingSlugs.length > 0) {
    throw new Error(`Missing subcategory slugs for system patterns: ${validation.missingSlugs.join(', ')}`)
  }
  if (validation.duplicateKeys.length > 0) {
    throw new Error(`Duplicate (pattern, subCategorySlug) in seed-patterns-data: ${validation.duplicateKeys.join('; ')}`)
  }
  if (validation.invalidRegex.length > 0) {
    throw new Error(`Invalid regex in seed-patterns-data: ${validation.invalidRegex.join('; ')}`)
  }

  const deleted = await db.delete(categorizationPattern).where(isNull(categorizationPattern.userId))
  const deletedCount = (deleted as unknown as { rowCount?: number }).rowCount ?? 0
  console.log(`  deleted ${deletedCount} existing system pattern(s)`)

  await db.insert(categorizationPattern).values(
    systemCategorizationPatterns.map((row) => ({
      userId: null,
      pattern: row.pattern,
      subCategoryId: subCategoryIdBySlug.get(row.subCategorySlug)!,
      confidence: row.confidence.toFixed(2),
      priority: row.priority,
      description: row.description,
      isActive: true,
    })),
  )

  await db.execute(
    sql`select setval(pg_get_serial_sequence('categorization_pattern', 'id'), coalesce((select max(id) from categorization_pattern), 0) + 1, false)`,
  )

  console.log(`  inserted ${systemCategorizationPatterns.length} system pattern(s)`)
  console.log(JSON.stringify({ event: 'seed_patterns_succeeded', target: seedDiagnostics.target }))
}

seedPatterns()
  .catch((error: unknown) => {
    console.error(JSON.stringify({ event: 'seed_patterns_failed', error: String(error) }))
    process.exit(1)
  })
  .finally(() => pool.end())
