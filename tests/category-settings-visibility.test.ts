// Real-Postgres guard for getCategoriesForSettings' visibility rule: a soft-disabled (isActive =
// false) subcategory must surface in the settings view ONLY when it belongs to the user. Disabled
// GLOBAL (userId = null) subcategories must never show up there, for any user.
//
// Why this needs real Postgres and not a mocked db: lib/dal/categories.ts:getCategoriesForUser
// used to drop the isActive predicate ENTIRELY when includeInactive was true, exposing every
// globally-retired system subcategory (e.g. old dropped taxonomy rows) to every user in Settings.
// A mocked-db test only proves the query SHAPE is right (see tests/categories-dal.test.ts); it
// can't prove Postgres actually returns the right ROWS for a real ownership mix. This file is that
// proof.
//
// Harness pattern copied from tests/pace-engine-lens-regression.test.ts (host-guarded test db,
// graceful local skip, fatal in CI).
import { afterAll, describe, expect, it, vi } from 'vitest'
import { category as categoryTable, subCategory as subCategoryTable } from '@/lib/db/schema'
import { verifySession } from '@/lib/dal/auth'
import {
  assertHarnessReachableInCi,
  connectReimbursementTestDb,
  resetReimbursementFixtures,
  type ReimbursementTestDb,
} from './helpers/reimbursement-test-db'
import { seedMinimalTaxonomy, seedUser } from './fixtures/reimbursement-seed'

vi.mock('@/lib/dal/auth', () => ({ verifySession: vi.fn() }))
vi.mock('react', () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }))

const harness = await connectReimbursementTestDb()

assertHarnessReachableInCi(harness, '[category-settings-visibility]')

if (!harness.ok) {
  console.warn(
    '[category-settings-visibility] Local Postgres unreachable — run `yarn db:up` to enable this suite. Skipping.',
  )
}

const describeIfReachable = harness.ok ? describe : describe.skip

function requireHarnessDb(): ReimbursementTestDb {
  if (!harness.ok) {
    throw new Error('category-settings-visibility: harness unreachable — unreachable when skipped')
  }
  return harness.db
}

afterAll(async () => {
  if (harness.ok) {
    await harness.pool.end()
  }
})

describeIfReachable('getCategoriesForSettings — disabled subcategory visibility', () => {
  it('hides a disabled GLOBAL subcategory but shows a disabled OWNED one, for the same user', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    vi.mocked(verifySession).mockResolvedValue({ userId } as never)
    const taxonomy = await seedMinimalTaxonomy(db, userId)

    // A globally-retired system subcategory (userId null) — must never surface, for any user.
    const [globalDisabled] = await db
      .insert(subCategoryTable)
      .values({
        userId: null,
        categoryId: taxonomy.essentialCategoryId,
        name: 'Retired Global Sub',
        slug: 'retired-global-sub',
        natureId: taxonomy.essentialNatureId,
        isActive: false,
      })
      .returning({ id: subCategoryTable.id })

    // The user's own soft-disabled subcategory — must still surface so they can reactivate it.
    const [ownedDisabled] = await db
      .insert(subCategoryTable)
      .values({
        userId,
        categoryId: taxonomy.essentialCategoryId,
        name: 'My Retired Sub',
        slug: 'my-retired-sub',
        natureId: taxonomy.essentialNatureId,
        isActive: false,
      })
      .returning({ id: subCategoryTable.id })

    vi.doMock('@/lib/db', () => ({ db }))
    vi.resetModules()
    const categoriesModule = await import('@/lib/dal/categories')

    const categories = await categoriesModule.getCategoriesForSettings()
    const essentialCategory = categories.find((c) => c.id === taxonomy.essentialCategoryId)
    const subCategoryIds = essentialCategory?.subCategories.map((s) => s.id) ?? []

    expect(subCategoryIds).not.toContain(globalDisabled.id)
    expect(subCategoryIds).toContain(ownedDisabled.id)

    const ownedRow = essentialCategory?.subCategories.find((s) => s.id === ownedDisabled.id)
    expect(ownedRow?.isActive).toBe(false)
  })

  it("a second user never sees another user's disabled owned subcategory either", async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId: ownerId } = await seedUser(db, { email: 'owner@example.test' })
    const { userId: otherId } = await seedUser(db, { email: 'other@example.test' })
    const taxonomy = await seedMinimalTaxonomy(db, ownerId)

    const [ownedDisabled] = await db
      .insert(subCategoryTable)
      .values({
        userId: ownerId,
        categoryId: taxonomy.essentialCategoryId,
        name: "Owner's Retired Sub",
        slug: 'owners-retired-sub',
        natureId: taxonomy.essentialNatureId,
        isActive: false,
      })
      .returning({ id: subCategoryTable.id })

    vi.mocked(verifySession).mockResolvedValue({ userId: otherId } as never)
    vi.doMock('@/lib/db', () => ({ db }))
    vi.resetModules()
    const categoriesModule = await import('@/lib/dal/categories')

    const categories = await categoriesModule.getCategoriesForSettings()
    // The owner's private category itself is invisible to `otherId` (userId scoping on
    // category, not just subcategory) — so its subcategory can't appear under any category here.
    const allSubCategoryIds = categories.flatMap((c) => c.subCategories.map((s) => s.id))

    expect(allSubCategoryIds).not.toContain(ownedDisabled.id)
  })
})

describeIfReachable('getCategoriesForSettings — disabled CATEGORY visibility (parity fix)', () => {
  it('hides a disabled GLOBAL category but shows a disabled OWNED one, for the same user', async () => {
    const db = requireHarnessDb()
    await resetReimbursementFixtures(db)

    const { userId } = await seedUser(db)
    vi.mocked(verifySession).mockResolvedValue({ userId } as never)

    // No system category is ever disabled in production today (verified against the real seed
    // baseline) — this synthesizes the case directly so the fix has a live proof instead of
    // waiting for the first real dissolved system category to expose it.
    const [globalDisabled] = await db
      .insert(categoryTable)
      .values({ userId: null, name: 'Retired Global Category', slug: 'retired-global-category', isActive: false })
      .returning({ id: categoryTable.id })

    const [ownedDisabled] = await db
      .insert(categoryTable)
      .values({ userId, name: 'My Retired Category', slug: 'my-retired-category', isActive: false })
      .returning({ id: categoryTable.id })

    vi.doMock('@/lib/db', () => ({ db }))
    vi.resetModules()
    const categoriesModule = await import('@/lib/dal/categories')

    const categories = await categoriesModule.getCategoriesForSettings()
    const categoryIds = categories.map((c) => c.id)

    expect(categoryIds).not.toContain(globalDisabled.id)
    expect(categoryIds).toContain(ownedDisabled.id)

    const ownedRow = categories.find((c) => c.id === ownedDisabled.id)
    expect(ownedRow?.isActive).toBe(false)
  })
})
