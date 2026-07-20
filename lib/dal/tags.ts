import 'server-only'
import { cache } from 'react'
import { db, type DbOrTx } from '@/lib/db'
import { tag } from '@/lib/db/schema'
import { and, asc, eq, isNotNull } from 'drizzle-orm'

// Name it `TagRow`, NOT `Tag` — `Tag` as a bare name would collide with the
// `Tag` icon already imported from `lucide-react` in transaction-table.tsx /
// transaction-detail-client.tsx, both consumed by later plans in this phase.
export type TagRow = typeof tag.$inferSelect

const getTagsForUser = cache(async (userId: string): Promise<TagRow[]> => {
  return db
    .select()
    .from(tag)
    .where(eq(tag.userId, userId))
    .orderBy(asc(tag.createdAt), asc(tag.id))
})

// Accepts `userId` explicitly rather than calling `verifySession()` itself — callers in this
// phase already have `userId` from their own session check, avoiding a second round trip.
export async function getTags(userId: string): Promise<TagRow[]> {
  return getTagsForUser(userId)
}

export async function getTag(
  userId: string,
  tagId: number,
  database: DbOrTx = db,
): Promise<TagRow | null> {
  const rows = await database
    .select()
    .from(tag)
    .where(and(eq(tag.id, tagId), eq(tag.userId, userId)))
    .limit(1)

  return rows[0] ?? null
}

export async function getActiveTagsWithDateRange(userId: string): Promise<TagRow[]> {
  return db
    .select()
    .from(tag)
    .where(
      and(
        eq(tag.userId, userId),
        eq(tag.archived, false),
        isNotNull(tag.dateRangeStart),
        isNotNull(tag.dateRangeEnd),
      ),
    )
    .orderBy(asc(tag.createdAt), asc(tag.id))
}

export async function getTagByNormalizedName(
  userId: string,
  normalizedName: string,
  database: DbOrTx = db,
): Promise<TagRow | null> {
  const rows = await database
    .select()
    .from(tag)
    .where(and(eq(tag.userId, userId), eq(tag.normalizedName, normalizedName)))

  return rows[0] ?? null
}

// The DAL performs no normalization itself — the caller-supplied `normalizedName` is written
// verbatim; normalization is the service layer's responsibility (single-responsibility).
export async function insertTagRow(
  input: {
    userId: string
    name: string
    normalizedName: string
    dateRangeStart: Date | null
    dateRangeEnd: Date | null
  },
  database: DbOrTx = db,
): Promise<TagRow> {
  const rows = await database
    .insert(tag)
    .values({ ...input, archived: false })
    .returning()

  return rows[0]
}

export async function updateTagRow(
  userId: string,
  tagId: number,
  input: {
    name?: string
    normalizedName?: string
    dateRangeStart?: Date | null
    dateRangeEnd?: Date | null
  },
  database: DbOrTx = db,
): Promise<TagRow | null> {
  const rows = await database
    .update(tag)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(tag.id, tagId), eq(tag.userId, userId)))
    .returning()

  return rows[0] ?? null
}

// The ONLY write to `archived` in this file; there is no `db.delete(tag)` call anywhere (D-04).
export async function archiveTagRow(
  userId: string,
  tagId: number,
  database: DbOrTx = db,
): Promise<TagRow | null> {
  const rows = await database
    .update(tag)
    .set({ archived: true, updatedAt: new Date() })
    .where(and(eq(tag.id, tagId), eq(tag.userId, userId)))
    .returning()

  return rows[0] ?? null
}
