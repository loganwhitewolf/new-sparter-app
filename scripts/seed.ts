// Operator seed (reads .env only, not .env.local). Target from yarn script / CLI flag:
//   yarn db:seed              → DATABASE_URL
//   yarn db:seed:staging      → STAGING_DATABASE_URL
//   yarn db:seed:production   → PRODUCTION_DATABASE_URL + PRODUCTION_MIGRATION_CONFIRM
// Same resolution as yarn db:migrate* (scripts/db-config.ts). Idempotent (onConflictDoNothing).
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { inArray, sql } from 'drizzle-orm'
import { category, direction, nature, subCategory, platform, importFormatVersion } from '../lib/db/schema'
import {
  getOperatorDatabaseConfig,
  isDirectSupabaseHost,
  loadOperatorEnv,
  operatorConnectionFailureHint,
  pgPoolConfigFromOperatorConfig,
  resolveOperatorDatabaseTarget,
} from './db-config'
import {
  categories,
  directions,
  importFormatVersions as seedFormatVersions,
  natures,
  platforms as seedPlatforms,
  subCategories,
} from './seed-data'

loadOperatorEnv()

const seedTarget = resolveOperatorDatabaseTarget()
const seedConfigResult = getOperatorDatabaseConfig({ target: seedTarget })

if (!seedConfigResult.ok) {
  console.error(JSON.stringify({ event: 'seed_failed', target: seedTarget, error: seedConfigResult.error }))
  process.exit(1)
}

const { config: seedConfig, diagnostics: seedDiagnostics } = seedConfigResult

console.log(
  JSON.stringify({
    event: 'seed_connection',
    target: seedDiagnostics.target,
    host: seedDiagnostics.host,
    sslEnabled: seedDiagnostics.sslEnabled,
    poolMax: seedDiagnostics.poolMax,
  }),
)

if (isDirectSupabaseHost(seedDiagnostics.host)) {
  const hint = operatorConnectionFailureHint(seedDiagnostics.host, seedDiagnostics.target)
  if (hint) {
    console.warn(JSON.stringify({ event: 'seed_connection_warning', message: hint }))
  }
}

const pool = new Pool(pgPoolConfigFromOperatorConfig(seedConfig))
const db = drizzle(pool)

function headerSignatureFor(formatVersionSeed: (typeof seedFormatVersions)[number]) {
  const columns = [
    formatVersionSeed.timestampColumn,
    formatVersionSeed.descriptionColumn,
    formatVersionSeed.amountColumn,
    formatVersionSeed.positiveAmountColumn,
    formatVersionSeed.negativeAmountColumn,
  ].filter((column): column is string => Boolean(column))

  return columns.join(formatVersionSeed.delimiter)
}

async function seed() {
  console.log(JSON.stringify({ event: 'seed_started', target: seedDiagnostics.target }))

  console.log('Seeding directions...')
  await db.insert(direction).values(directions as Array<typeof direction.$inferInsert>).onConflictDoNothing()
  await db.execute(sql`select setval('direction_id_seq', coalesce((select max(${direction.id}) from ${direction}), 0) + 1, false)`)
  console.log(`  ${directions.length} directions inserted (or already present).`)

  console.log('Seeding natures...')
  await db.insert(nature).values(natures as Array<typeof nature.$inferInsert>).onConflictDoNothing()
  await db.execute(sql`select setval('nature_id_seq', coalesce((select max(${nature.id}) from ${nature}), 0) + 1, false)`)
  console.log(`  ${natures.length} natures inserted (or already present).`)

  console.log('Seeding categories...')
  // Phase 46: category.type column removed (ADR 0012 — direction is now derived from nature, not category)
  await db.insert(category).values(categories.map(({ type: _type, ...rest }) => rest) as Array<typeof category.$inferInsert>).onConflictDoNothing()
  console.log(`  ${categories.length} categories inserted (or already present).`)

  console.log('Seeding subcategories...')
  // v2 literals include natureId; cast passes it through to sub_category.nature_id (D-11, D-13)
  await db.insert(subCategory).values(subCategories as Array<typeof subCategory.$inferInsert>).onConflictDoNothing()
  console.log(`  ${subCategories.length} sottocategories inserted (or already present).`)

  // Phase 49: exclude_from_totals column dropped (D-10); transfer exclusion now via direction.included_in_totals
  // Phase 56: platform holds identity only (ADR 0013); parsing contract moved to importFormatVersion
  console.log('Seeding import platforms...')
  await db
    .insert(platform)
    .values(seedPlatforms.map((platformSeed) => ({ ...platformSeed, isActive: true })))
    .onConflictDoNothing()
  await db.execute(sql`select setval('platform_id_seq', coalesce((select max(${platform.id}) from ${platform}), 0) + 1, false)`)
  console.log(`  ${seedPlatforms.length} platforms inserted (or already present).`)

  console.log('Seeding import format versions...')
  await db
    .insert(importFormatVersion)
    .values(
      seedFormatVersions.map((fv) => ({
        platformId: fv.platformId,
        version: fv.version,
        headerSignature: headerSignatureFor(fv),
        notes: fv.notes,
        isActive: true,
        delimiter: fv.delimiter,
        descriptionColumn: fv.descriptionColumn,
        amountType: fv.amountType,
        amountColumn: fv.amountColumn,
        positiveAmountColumn: fv.positiveAmountColumn,
        negativeAmountColumn: fv.negativeAmountColumn,
        timestampColumn: fv.timestampColumn,
        dateFormat: fv.dateFormat,
        dateReplace: fv.dateReplace,
        decimalReplace: fv.decimalReplace,
        multiplyBy: fv.multiplyBy,
        descriptionStripPattern: fv.descriptionStripPattern,
      })),
    )
    .onConflictDoNothing()
  console.log(`  ${seedFormatVersions.length} format versions inserted (or already present).`)

  console.log(JSON.stringify({ event: 'seed_succeeded', target: seedDiagnostics.target }))
}

seed()
  .catch((error: unknown) => {
    const cause = error && typeof error === 'object' && 'cause' in error ? (error as { cause?: unknown }).cause : error
    const code =
      cause && typeof cause === 'object' && 'code' in cause && typeof (cause as { code?: unknown }).code === 'string'
        ? (cause as { code: string }).code
        : undefined

    if (code === 'ENOTFOUND') {
      const hint = operatorConnectionFailureHint(seedDiagnostics.host, seedDiagnostics.target)
      console.error(
        JSON.stringify({
          event: 'seed_failed',
          target: seedDiagnostics.target,
          host: seedDiagnostics.host,
          error: { code, message: 'Database host could not be resolved (DNS).' },
          hint,
        }),
      )
      return
    }

    console.error(error)
  })
  .finally(() => pool.end())
