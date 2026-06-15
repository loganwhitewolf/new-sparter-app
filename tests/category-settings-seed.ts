import { randomUUID } from 'node:crypto'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { and, eq, isNull, like, or, sql } from 'drizzle-orm'
import { getDatabasePoolConfig } from '@/lib/db/config'
import {
  categorizationPattern,
  category,
  expense,
  subCategory,
  user,
  userSubcategoryOverride,
} from '@/lib/db/schema'

export type CategorySettingsSeed = {
  userId: string
  runId: string
  prefix: string
  createdCategoryName: string
  createdCategoryRenamedName: string
  createdSubcategoryName: string
  createdSubcategoryRenamedName: string
  linkedCategoryName: string
  linkedSubcategoryName: string
  unlinkedCategoryName: string
  unlinkedSubcategoryName: string
  systemSubcategoryOriginalName: string
  systemSubcategoryOverrideName: string
  pattern: string
  patternDescription: string
}

type SeedDatabase = ReturnType<typeof makeDatabase>

function makeDatabase() {
  const pool = new Pool({ ...getDatabasePoolConfig(), max: 1 })

  return {
    pool,
    db: drizzle(pool),
  }
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function canRunCategorySettingsFlow() {
  return Boolean(process.env.DATABASE_URL && process.env.STAGING_KEY)
}

export function categorySettingsSkipReason() {
  const missing = [
    !process.env.DATABASE_URL && 'DATABASE_URL',
    !process.env.STAGING_KEY && 'STAGING_KEY',
  ].filter(Boolean)

  return `Skipping /settings/categories browser flow: missing ${missing.join(', ')}.`
}

export function makeCategorySettingsSeed(): CategorySettingsSeed {
  const runId = Date.now().toString(36)
  const prefix = `S03 ${runId}`

  return {
    userId: process.env.STAGING_USER_ID ?? 'staging-user',
    runId,
    prefix,
    createdCategoryName: `${prefix} creata`,
    createdCategoryRenamedName: `${prefix} categoria rinominata`,
    createdSubcategoryName: `${prefix} sottocategoria creata`,
    createdSubcategoryRenamedName: `${prefix} sottocategoria rinominata`,
    linkedCategoryName: `${prefix} categoria collegata`,
    linkedSubcategoryName: `${prefix} sottocategoria collegata`,
    unlinkedCategoryName: `${prefix} categoria eliminabile`,
    unlinkedSubcategoryName: `${prefix} sottocategoria eliminabile`,
    systemSubcategoryOriginalName: '',
    systemSubcategoryOverrideName: `${prefix} sistema personalizzato`,
    pattern: `s03-${runId}-negozio`,
    patternDescription: `${prefix} pattern`,
  }
}

async function syncSerialSequences(database: SeedDatabase) {
  await database.db.execute(sql`select setval(pg_get_serial_sequence('category', 'id'), coalesce((select max(id) from category), 0) + 1, false)`)
  await database.db.execute(sql`select setval(pg_get_serial_sequence('sub_category', 'id'), coalesce((select max(id) from sub_category), 0) + 1, false)`)
  await database.db.execute(sql`select setval(pg_get_serial_sequence('categorization_pattern', 'id'), coalesce((select max(id) from categorization_pattern), 0) + 1, false)`)
}

async function cleanupRows(database: SeedDatabase, seed: Pick<CategorySettingsSeed, 'userId' | 'prefix' | 'pattern'>) {
  const namePattern = `${seed.prefix}%`
  const patternPattern = `s03-%`

  await database.db
    .delete(categorizationPattern)
    .where(
      and(
        eq(categorizationPattern.userId, seed.userId),
        or(like(categorizationPattern.pattern, patternPattern), like(categorizationPattern.description, namePattern)),
      ),
    )

  await database.db
    .delete(userSubcategoryOverride)
    .where(
      and(
        eq(userSubcategoryOverride.userId, seed.userId),
        like(userSubcategoryOverride.customName, namePattern),
      ),
    )

  await database.db
    .delete(expense)
    .where(and(eq(expense.userId, seed.userId), like(expense.title, namePattern)))

  await database.db
    .delete(subCategory)
    .where(and(eq(subCategory.userId, seed.userId), like(subCategory.name, namePattern)))

  await database.db
    .delete(category)
    .where(and(eq(category.userId, seed.userId), like(category.name, namePattern)))
}

export async function prepareCategorySettingsSeed(seed: CategorySettingsSeed) {
  const database = makeDatabase()

  try {
    await cleanupRows(database, seed)
    await syncSerialSequences(database)

    await database.db
      .insert(user)
      .values({
        id: seed.userId,
        name: 'Staging User',
        email: `${seed.userId}@example.local`,
        emailVerified: true,
        subscriptionPlan: 'basic',
        role: 'user',
      })
      .onConflictDoUpdate({
        target: user.id,
        set: { subscriptionPlan: 'basic', role: 'user' },
      })

    const [systemTarget] = await database.db
      .select({ id: subCategory.id, name: subCategory.name })
      .from(subCategory)
      .innerJoin(category, eq(category.id, subCategory.categoryId))
      .where(
        and(
          isNull(subCategory.userId),
          eq(subCategory.isActive, true),
          eq(category.isActive, true),
        ),
      )
      .limit(1)

    if (!systemTarget) {
      throw new Error('No active system subcategory found for personal override test.')
    }

    seed.systemSubcategoryOriginalName = systemTarget.name

    // Phase 46: category.type column removed (ADR 0012)
    const [linkedCategory] = await database.db
      .insert(category)
      .values({
        userId: seed.userId,
        name: seed.linkedCategoryName,
        slug: slugify(seed.linkedCategoryName),
        isActive: true,
      })
      .returning({ id: category.id })

    const [linkedSubcategory] = await database.db
      .insert(subCategory)
      .values({
        userId: seed.userId,
        categoryId: linkedCategory.id,
        name: seed.linkedSubcategoryName,
        slug: slugify(seed.linkedSubcategoryName),
        isActive: true,
      })
      .returning({ id: subCategory.id })

    // Phase 46: category.type column removed (ADR 0012)
    const [unlinkedCategory] = await database.db
      .insert(category)
      .values({
        userId: seed.userId,
        name: seed.unlinkedCategoryName,
        slug: slugify(seed.unlinkedCategoryName),
        isActive: true,
      })
      .returning({ id: category.id })

    await database.db.insert(subCategory).values({
      userId: seed.userId,
      categoryId: unlinkedCategory.id,
      name: seed.unlinkedSubcategoryName,
      slug: slugify(seed.unlinkedSubcategoryName),
      isActive: true,
    })

    await database.db.insert(expense).values({
      id: randomUUID(),
      userId: seed.userId,
      title: `${seed.prefix} spesa collegata`,
      descriptionHash: randomUUID(),
      subCategoryId: linkedSubcategory.id,
      totalAmount: '12.34',
      transactionCount: 1,
      status: '3',
    })
  } finally {
    await database.pool.end()
  }
}

export async function cleanupCategorySettingsSeed(seed: CategorySettingsSeed) {
  const database = makeDatabase()

  try {
    await cleanupRows(database, seed)
  } finally {
    await database.pool.end()
  }
}

// R-FN-03 — static seed nature assignment assertions (Phase 47)
import { describe, it, expect } from 'vitest'
import { subCategories, natures } from '../scripts/seed-data'
import { FlowNature } from '@/lib/utils/nature-labels'

const NATURE_BY_ID = Object.fromEntries(natures.map((n) => [n.id, n.code]))

const TRANSFER_SUBCATEGORY_SLUGS = [
  'trasferimento-tra-conti',
  'addebito-carta-di-credito',
  'contante',
] as const

function activeSystemSubcategories() {
  return subCategories.filter((s) => s.isActive !== false)
}

describe('seed nature assignment (R-FN-03)', () => {
  // Phase 46: FlowNature v2.0 — 8 codes (operational dissolved, financial→investment, extraordinary→savings)
  it('FlowNature import from @/lib/utils/nature-labels succeeds (regression guard)', () => {
    const validNatures: FlowNature[] = ['essential', 'discretionary', 'income', 'income_extraordinary', 'debt', 'transfer', 'savings', 'investment']
    expect(validNatures).toHaveLength(8)
  })

  it('at least 1 system subcategory has nature essential', () => {
    const essentialSubs = activeSystemSubcategories().filter(
      (s) => s.natureId !== undefined && NATURE_BY_ID[s.natureId] === 'essential',
    )
    expect(essentialSubs.length).toBeGreaterThanOrEqual(1)
  })

  it('at least 1 system subcategory has nature discretionary', () => {
    const discretionarySubs = activeSystemSubcategories().filter(
      (s) => s.natureId !== undefined && NATURE_BY_ID[s.natureId] === 'discretionary',
    )
    expect(discretionarySubs.length).toBeGreaterThanOrEqual(1)
  })

  it('transfer subcategories have nature transfer', () => {
    const transferSubs = activeSystemSubcategories().filter((s) =>
      TRANSFER_SUBCATEGORY_SLUGS.includes(s.slug as (typeof TRANSFER_SUBCATEGORY_SLUGS)[number]),
    )

    expect(transferSubs).toHaveLength(TRANSFER_SUBCATEGORY_SLUGS.length)

    for (const sub of transferSubs) {
      expect(sub.natureId, sub.slug).toBe(6)
      expect(NATURE_BY_ID[sub.natureId!], sub.slug).toBe('transfer')
    }
  })
})
