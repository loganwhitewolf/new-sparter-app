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

/**
 * The error message thrown when analyze is attempted on a file in a non-analyzable
 * status (e.g. already 'imported'). Surfaced by analyzeImportAction so callers
 * can distinguish this case from generic failures.
 */
export const ANALYZE_STATUS_ERROR =
  'Analisi non consentita per questo file nel suo stato attuale.'

/** Statuses where the file is actively being processed server-side. */
export const IN_PROGRESS_STATUSES = new Set<ImportListRow['status']>(['analyzing', 'importing'])

/** Returns true when a file is actively being processed and no user action is possible. */
export function isInProgress(row: Pick<ImportListRow, 'status'>): boolean {
  return IN_PROGRESS_STATUSES.has(row.status)
}
