import 'server-only'
import { and, eq, isNull, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { importFormatVersion, platform } from '@/lib/db/schema'
import type { ImportFormatCandidateInput } from '@/lib/services/import-format-detector'

type ImportFormatDatabase = Pick<typeof db, 'select'>

type ImportFormatRow = {
  id: number
  platformId: number
  version: number
  headerSignature: string
  isActive: boolean
  ownerUserId: string | null
  visibility: string
  reviewStatus: string
  platformOwnerUserId: string | null
  platformVisibility: string
  platformReviewStatus: string
  platformIsActive: boolean
  platformName: string
  platformSlug: string
  platformDelimiter: string
  platformCountry: string
  platformTimestampColumn: string
  platformDescriptionColumn: string
  platformAmountType: 'single' | 'separate'
  platformAmountColumn: string | null
  platformPositiveAmountColumn: string | null
  platformNegativeAmountColumn: string | null
  platformMultiplyBy: number
  platformDescriptionStripPattern: string | null
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
    (typeof row.platformOwnerUserId === 'string' || row.platformOwnerUserId === null) &&
    typeof row.platformVisibility === 'string' &&
    typeof row.platformReviewStatus === 'string' &&
    typeof row.platformIsActive === 'boolean' &&
    typeof row.platformName === 'string' &&
    typeof row.platformSlug === 'string' &&
    typeof row.platformDelimiter === 'string' &&
    typeof row.platformCountry === 'string' &&
    typeof row.platformTimestampColumn === 'string' &&
    typeof row.platformDescriptionColumn === 'string' &&
    (row.platformAmountType === 'single' || row.platformAmountType === 'separate') &&
    (typeof row.platformAmountColumn === 'string' || row.platformAmountColumn === null) &&
    (typeof row.platformPositiveAmountColumn === 'string' || row.platformPositiveAmountColumn === null) &&
    (typeof row.platformNegativeAmountColumn === 'string' || row.platformNegativeAmountColumn === null) &&
    typeof row.platformMultiplyBy === 'number' &&
    (typeof row.platformDescriptionStripPattern === 'string' || row.platformDescriptionStripPattern === null)
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
      id: row.platformId,
      name: row.platformName,
      slug: row.platformSlug,
      delimiter: row.platformDelimiter,
      country: row.platformCountry,
      timestampColumn: row.platformTimestampColumn,
      descriptionColumn: row.platformDescriptionColumn,
      amountType: row.platformAmountType,
      amountColumn: row.platformAmountColumn,
      positiveAmountColumn: row.platformPositiveAmountColumn,
      negativeAmountColumn: row.platformNegativeAmountColumn,
      multiplyBy: row.platformMultiplyBy,
      descriptionStripPattern: row.platformDescriptionStripPattern,
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
      platformOwnerUserId: platform.ownerUserId,
      platformVisibility: platform.visibility,
      platformReviewStatus: platform.reviewStatus,
      platformIsActive: platform.isActive,
      platformName: platform.name,
      platformSlug: platform.slug,
      platformDelimiter: platform.delimiter,
      platformCountry: platform.country,
      platformTimestampColumn: platform.timestampColumn,
      platformDescriptionColumn: platform.descriptionColumn,
      platformAmountType: platform.amountType,
      platformAmountColumn: platform.amountColumn,
      platformPositiveAmountColumn: platform.positiveAmountColumn,
      platformNegativeAmountColumn: platform.negativeAmountColumn,
      platformMultiplyBy: platform.multiplyBy,
      platformDescriptionStripPattern: platform.descriptionStripPattern,
    })
    .from(importFormatVersion)
    .innerJoin(platform, eq(importFormatVersion.platformId, platform.id))
    .where(accessibleWhere(input.userId, input.selectedFormatVersionId))

  return rows
    .filter((row): row is ImportFormatRow => hasExpectedRowShape(row))
    .filter((row) => isAccessibleImportFormat(row, input.userId))
    .map(toCandidate)
}
