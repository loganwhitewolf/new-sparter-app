// Run with: yarn db:seed (PRODUCTION_* in .env — shared with yarn db:migrate via scripts/db-config.ts)
// Uses onConflictDoNothing() — safe to run multiple times (idempotent).
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { inArray, sql } from 'drizzle-orm'
import { category, subCategory, platform, importFormatVersion, categorizationPattern } from '../lib/db/schema'
import {
  getOperatorDatabaseConfig,
  isDirectSupabaseHost,
  loadOperatorEnv,
  operatorConnectionFailureHint,
  pgPoolConfigFromOperatorConfig,
} from './db-config'
import {
  categories,
  categorizationPatterns as seedCategorizationPatterns,
  platforms as seedPlatforms,
  subCategories,
} from './seed-data'

loadOperatorEnv()

const seedConfigResult = getOperatorDatabaseConfig()

if (!seedConfigResult.ok) {
  console.error(
    JSON.stringify({ event: 'seed_failed', targetClass: 'production', error: seedConfigResult.error }),
  )
  process.exit(1)
}

const { config: seedConfig, diagnostics: seedDiagnostics } = seedConfigResult

console.log(
  JSON.stringify({
    event: 'seed_connection',
    targetClass: seedDiagnostics.targetClass,
    host: seedDiagnostics.host,
    sslEnabled: seedDiagnostics.sslEnabled,
    poolMax: seedDiagnostics.poolMax,
  }),
)

if (isDirectSupabaseHost(seedDiagnostics.host)) {
  const hint = operatorConnectionFailureHint(seedDiagnostics.host)
  if (hint) {
    console.warn(JSON.stringify({ event: 'seed_connection_warning', message: hint }))
  }
}

const pool = new Pool(pgPoolConfigFromOperatorConfig(seedConfig))
const db = drizzle(pool)

function headerSignatureFor(platformSeed: (typeof seedPlatforms)[number]) {
  const columns = [
    platformSeed.timestampColumn,
    platformSeed.descriptionColumn,
    platformSeed.amountColumn,
    platformSeed.positiveAmountColumn,
    platformSeed.negativeAmountColumn,
  ].filter((column): column is string => Boolean(column))

  return columns.join(platformSeed.delimiter)
}

async function seed() {
  console.log(JSON.stringify({ event: 'seed_started', targetClass: 'production' }))
  console.log('Seeding categories...')
  await db.insert(category).values(categories as Array<typeof category.$inferInsert>).onConflictDoNothing()
  console.log(`  ${categories.length} categories inserted (or already present).`)

  console.log('Seeding subcategories...')
  await db.insert(subCategory).values(subCategories as Array<typeof subCategory.$inferInsert>).onConflictDoNothing()
  console.log(`  ${subCategories.length} sottocategories inserted (or already present).`)

  await db
    .update(subCategory)
    .set({ excludeFromTotals: true })
    .where(inArray(subCategory.slug, ['ricariche-conti', 'addebito-carta-di-credito']))
  console.log('  excludeFromTotals=true set for ricariche-conti and addebito-carta-di-credito.')

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
      seedPlatforms.map((platformSeed) => ({
        platformId: platformSeed.id,
        version: 1,
        headerSignature: headerSignatureFor(platformSeed),
        notes: `Initial ${platformSeed.name} CSV import contract`,
        isActive: true,
      })),
    )
    .onConflictDoNothing()
  console.log(`  ${seedPlatforms.length} format versions inserted (or already present).`)

  console.log('Seeding system categorization patterns...')
  const seededSubCategories = await db.select({ id: subCategory.id, slug: subCategory.slug }).from(subCategory)
  const subCategoryIdBySlug = new Map(seededSubCategories.map((row) => [row.slug, row.id]))
  const missingSlugs = Array.from(
    new Set(
      seedCategorizationPatterns
        .map((patternSeed) => patternSeed.subCategorySlug)
        .filter((slug) => !subCategoryIdBySlug.has(slug)),
    ),
  )

  if (missingSlugs.length > 0) {
    throw new Error(
      `Missing subcategory slugs for system categorization patterns: ${missingSlugs.join(', ')}`,
    )
  }

  await db
    .insert(categorizationPattern)
    .values(
      seedCategorizationPatterns.map((patternSeed) => ({
        userId: null,
        pattern: patternSeed.pattern,
        subCategoryId: subCategoryIdBySlug.get(patternSeed.subCategorySlug)!,
        amountSign: patternSeed.amountSign,
        confidence: patternSeed.confidence.toFixed(2),
        priority: patternSeed.priority,
        description: patternSeed.description,
        isActive: true,
      })),
    )
    .onConflictDoNothing()
  console.log(`  ${seedCategorizationPatterns.length} system patterns inserted (or already present).`)

  console.log(JSON.stringify({ event: 'seed_succeeded', targetClass: 'production' }))
}

seed()
  .catch((error: unknown) => {
    const cause = error && typeof error === 'object' && 'cause' in error ? (error as { cause?: unknown }).cause : error
    const code =
      cause && typeof cause === 'object' && 'code' in cause && typeof (cause as { code?: unknown }).code === 'string'
        ? (cause as { code: string }).code
        : undefined

    if (code === 'ENOTFOUND') {
      const hint = operatorConnectionFailureHint(seedDiagnostics.host)
      console.error(
        JSON.stringify({
          event: 'seed_failed',
          targetClass: 'production',
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
