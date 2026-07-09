/**
 * Shared import lifecycle status utilities.
 *
 * This module is client-safe: it does NOT import `server-only` and may be
 * consumed by both server components and client components.
 */

import type { ImportListRow } from '@/lib/dal/imports'

/**
 * The canonical substring that identifies an unknown-format analysis failure.
 * Used by the analyze page and the import row-action matrix to keep configure-CTA
 * visibility in sync without duplicating the predicate.
 */
export const UNKNOWN_FORMAT_ERROR = 'No supported import format matched'

/**
 * Returns true when a failed import row failed because no format could be
 * detected — indicating that the user may recover by configuring a private
 * import format and retrying analysis.
 */
export function isUnknownFormatFailed(row: Pick<ImportListRow, 'status' | 'errorMessage'>): boolean {
  return (
    row.status === 'failed' &&
    row.errorMessage !== null &&
    row.errorMessage !== undefined &&
    row.errorMessage.includes(UNKNOWN_FORMAT_ERROR)
  )
}

/** True when analysis parsed the file but no import format matched. */
export function isUnknownFormatAnalysis(result: {
  formatVersionId: number | null
  errors: string[]
}): boolean {
  return (
    result.formatVersionId === null &&
    result.errors.some((error) => error.includes(UNKNOWN_FORMAT_ERROR))
  )
}

/**
 * The error message thrown when analyze is attempted on a file in a non-analyzable
 * status (e.g. already 'imported'). Surfaced by analyzeImportAction so callers
 * can distinguish this case from generic failures.
 */
export const ANALYZE_STATUS_ERROR =
  'Analisi non consentita per questo file nel suo stato attuale.'

/** Statuses where the file is actively being processed server-side. */
export const IN_PROGRESS_STATUSES = new Set<ImportListRow['status']>(['analyzing', 'importing'])

/** Returns true when a file is actively being processed (primary CTAs hidden). */
export function isInProgress(row: Pick<ImportListRow, 'status'>): boolean {
  return IN_PROGRESS_STATUSES.has(row.status)
}

/** Non-imported file statuses that can be removed via deleteStaleFileAction. */
export const STALE_DELETABLE_STATUSES = [
  'pending_upload',
  'uploaded',
  'analyzed',
  'failed',
  'analyzing',
] as const satisfies readonly ImportListRow['status'][]

export function isStaleDeletableStatus(status: ImportListRow['status']): boolean {
  return (STALE_DELETABLE_STATUSES as readonly string[]).includes(status)
}

/**
 * The only file status that blocks a re-upload of the same content hash. A
 * completed import (`imported`) is the intended guard against re-importing
 * duplicate data; every other status means the previous import never
 * finished (including a stuck `importing`), so re-initiating should replace
 * the stale row instead of returning 409.
 */
export const BLOCKS_REUPLOAD_STATUSES = ['imported'] as const satisfies readonly ImportListRow['status'][]

export function blocksReupload(status: ImportListRow['status']): boolean {
  return (BLOCKS_REUPLOAD_STATUSES as readonly string[]).includes(status)
}

const DOWNLOADABLE_STATUSES = new Set<ImportListRow['status']>([
  'uploaded',
  'analyzing',
  'analyzed',
  'importing',
  'imported',
  'failed',
])

/** Returns true when the original upload should exist in object storage. */
export function canDownloadImportFile(row: Pick<ImportListRow, 'status'>): boolean {
  return DOWNLOADABLE_STATUSES.has(row.status)
}
