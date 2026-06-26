import 'server-only'
import { and, eq, inArray, isNull, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { importFormatVersion, platform } from '@/lib/db/schema'
import type { ImportFormatCandidateInput } from '@/lib/services/import-format-detector'
import { PDF_IMPORT_PLATFORM_SLUGS } from '@/lib/services/import-parsers'

export type ImportFormatDatabase = Pick<typeof db, 'select'>

type ImportFormatRow = {
  id: number
  platformId: number
  version: number
  headerSignature: string
  isActive: boolean
  ownerUserId: string | null
  visibility: string
  reviewStatus: string
  // Contract fields sourced from importFormatVersion (ADR 0013)
  delimiter: string
  timestampColumn: string
  descriptionColumn: string
  amountType: 'single' | 'separate'
  amountColumn: string | null
  positiveAmountColumn: string | null
  negativeAmountColumn: string | null
  multiplyBy: number
  descriptionStripPattern: string | null
  // Identity fields sourced from platform
  platformOwnerUserId: string | null
  platformVisibility: string
  platformReviewStatus: string
  platformIsActive: boolean
  platformName: string
  platformSlug: string
  platformCountry: string
}

const GLOBAL_VISIBILITY = 'global'
const PRIVATE_VISIBILITY = 'private'
const APPROVED_REVIEW_STATUS = 'approved'

function hasExpectedRowShape(row: Partial<ImportFormatRow>): row is ImportFormatRow {
  return (
    typeof row.id === 'number' &&
    typeof row.platformId === 'number' &&
    typeof row.version === 'number' &&
    typeof row.headerSignature === 'string' &&
    typeof row.isActive === 'boolean' &&
    (typeof row.ownerUserId === 'string' || row.ownerUserId === null) &&
    typeof row.visibility === 'string' &&
    typeof row.reviewStatus === 'string' &&
    // Contract fields (from importFormatVersion)
    typeof row.delimiter === 'string' &&
    typeof row.timestampColumn === 'string' &&
    typeof row.descriptionColumn === 'string' &&
    (row.amountType === 'single' || row.amountType === 'separate') &&
    (typeof row.amountColumn === 'string' || row.amountColumn === null) &&
    (typeof row.positiveAmountColumn === 'string' || row.positiveAmountColumn === null) &&
    (typeof row.negativeAmountColumn === 'string' || row.negativeAmountColumn === null) &&
    typeof row.multiplyBy === 'number' &&
    (typeof row.descriptionStripPattern === 'string' || row.descriptionStripPattern === null) &&
    // Identity fields (from platform)
    (typeof row.platformOwnerUserId === 'string' || row.platformOwnerUserId === null) &&
    typeof row.platformVisibility === 'string' &&
    typeof row.platformReviewStatus === 'string' &&
    typeof row.platformIsActive === 'boolean' &&
    typeof row.platformName === 'string' &&
    typeof row.platformSlug === 'string' &&
    typeof row.platformCountry === 'string'
  )
}

function isGlobalApproved(row: ImportFormatRow) {
  return (
    row.ownerUserId === null &&
    row.platformOwnerUserId === null &&
    row.visibility === GLOBAL_VISIBILITY &&
    row.platformVisibility === GLOBAL_VISIBILITY &&
    row.reviewStatus === APPROVED_REVIEW_STATUS &&
    row.platformReviewStatus === APPROVED_REVIEW_STATUS
  )
}

function isOwnedBy(row: ImportFormatRow, userId: string) {
  return (
    (row.ownerUserId === userId || row.platformOwnerUserId === userId) &&
    row.visibility === PRIVATE_VISIBILITY &&
    row.platformVisibility === PRIVATE_VISIBILITY
  )
}

function isAccessibleImportFormat(row: ImportFormatRow, userId: string) {
  return row.isActive && row.platformIsActive && (isGlobalApproved(row) || isOwnedBy(row, userId))
}

function toCandidate(row: ImportFormatRow): ImportFormatCandidateInput {
  return {
    id: row.id,
    platformId: row.platformId,
    version: row.version,
    headerSignature: row.headerSignature,
    isActive: row.isActive,
    platform: {
      // Identity from platform
      id: row.platformId,
      name: row.platformName,
      slug: row.platformSlug,
      country: row.platformCountry,
      // Contract from importFormatVersion (ADR 0013)
      delimiter: row.delimiter,
      timestampColumn: row.timestampColumn,
      descriptionColumn: row.descriptionColumn,
      amountType: row.amountType,
      amountColumn: row.amountColumn,
      positiveAmountColumn: row.positiveAmountColumn,
      negativeAmountColumn: row.negativeAmountColumn,
      multiplyBy: row.multiplyBy,
      descriptionStripPattern: row.descriptionStripPattern,
    },
  }
}

function accessibleWhere(userId: string, selectedFormatVersionId?: number) {
  const accessScope = or(
    and(
      isNull(importFormatVersion.ownerUserId),
      isNull(platform.ownerUserId),
      eq(importFormatVersion.visibility, GLOBAL_VISIBILITY),
      eq(platform.visibility, GLOBAL_VISIBILITY),
      eq(importFormatVersion.reviewStatus, APPROVED_REVIEW_STATUS),
      eq(platform.reviewStatus, APPROVED_REVIEW_STATUS),
    ),
    and(
      eq(importFormatVersion.ownerUserId, userId),
      eq(importFormatVersion.visibility, PRIVATE_VISIBILITY),
      eq(platform.visibility, PRIVATE_VISIBILITY),
    ),
    and(
      eq(platform.ownerUserId, userId),
      eq(importFormatVersion.visibility, PRIVATE_VISIBILITY),
      eq(platform.visibility, PRIVATE_VISIBILITY),
    ),
  )

  const base = and(
    eq(importFormatVersion.isActive, true),
    eq(platform.isActive, true),
    accessScope,
  )

  if (selectedFormatVersionId === undefined) return base
  return and(base, eq(importFormatVersion.id, selectedFormatVersionId))
}

export async function loadImportFormatsForDetection(input: {
  userId: string
  selectedFormatVersionId?: number
  database?: ImportFormatDatabase
}): Promise<ImportFormatCandidateInput[]> {
  const database = input.database ?? db
  const rows = await database
    .select({
      id: importFormatVersion.id,
      platformId: importFormatVersion.platformId,
      version: importFormatVersion.version,
      headerSignature: importFormatVersion.headerSignature,
      isActive: importFormatVersion.isActive,
      ownerUserId: importFormatVersion.ownerUserId,
      visibility: importFormatVersion.visibility,
      reviewStatus: importFormatVersion.reviewStatus,
      // Contract columns from importFormatVersion (ADR 0013)
      delimiter: importFormatVersion.delimiter,
      timestampColumn: importFormatVersion.timestampColumn,
      descriptionColumn: importFormatVersion.descriptionColumn,
      amountType: importFormatVersion.amountType,
      amountColumn: importFormatVersion.amountColumn,
      positiveAmountColumn: importFormatVersion.positiveAmountColumn,
      negativeAmountColumn: importFormatVersion.negativeAmountColumn,
      multiplyBy: importFormatVersion.multiplyBy,
      descriptionStripPattern: importFormatVersion.descriptionStripPattern,
      // Identity columns from platform
      platformOwnerUserId: platform.ownerUserId,
      platformVisibility: platform.visibility,
      platformReviewStatus: platform.reviewStatus,
      platformIsActive: platform.isActive,
      platformName: platform.name,
      platformSlug: platform.slug,
      platformCountry: platform.country,
    })
    .from(importFormatVersion)
    .innerJoin(platform, eq(importFormatVersion.platformId, platform.id))
    .where(accessibleWhere(input.userId, input.selectedFormatVersionId))

  return rows
    .filter((row): row is ImportFormatRow => hasExpectedRowShape(row))
    .filter((row) => isAccessibleImportFormat(row, input.userId))
    .map(toCandidate)
}

/**
 * Returns the display names of all active platforms that support PDF import.
 * Filters by PDF_IMPORT_PLATFORM_SLUGS (the allowlist co-located with the .pdf dispatch
 * in import-parsers.ts) — no fileType column on import_format_version required.
 * Results are deduplicated (a platform may have multiple active format versions) and
 * sorted alphabetically for stable output (T-57-05-02).
 *
 * @param input.database - Optional injectable database instance (used in tests).
 */
export async function listPdfImportPlatformNames(input?: {
  database?: ImportFormatDatabase
}): Promise<string[]> {
  const database = input?.database ?? db

  const rows = await database
    .select({ name: platform.name })
    .from(platform)
    .innerJoin(importFormatVersion, eq(importFormatVersion.platformId, platform.id))
    .where(
      and(
        eq(platform.isActive, true),
        eq(importFormatVersion.isActive, true),
        eq(platform.reviewStatus, APPROVED_REVIEW_STATUS),
        eq(importFormatVersion.reviewStatus, APPROVED_REVIEW_STATUS),
        isNull(platform.ownerUserId),
        isNull(importFormatVersion.ownerUserId),
        inArray(platform.slug, [...PDF_IMPORT_PLATFORM_SLUGS]),
      ),
    )

  // Deduplicate names and sort alphabetically for stable output
  const unique = [...new Set(rows.map(r => r.name))].sort()
  return unique
}
