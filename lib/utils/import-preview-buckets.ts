/**
 * Pure, dependency-free partitioning of import-preview rows into mutually
 * exclusive buckets. Shared by the analyze service (authoritative counts) and
 * the preview component (client-side filtering + fallback counts). No
 * `server-only` — it must be importable from a client component.
 */

export type PreviewRowFlags = {
  valid: boolean
  duplicate: boolean
}

export type PreviewBucket = 'valid' | 'duplicate' | 'error'

export type PreviewBucketCounts = {
  all: number
  valid: number
  duplicate: number
  error: number
}

/**
 * Classify a preview row. Invalid always wins (an invalid row is never counted
 * as a duplicate), so the three buckets partition the rows exactly.
 */
export function bucketOfPreviewRow(row: PreviewRowFlags): PreviewBucket {
  if (!row.valid) return 'error'
  if (row.duplicate) return 'duplicate'
  return 'valid'
}

/** Count rows per bucket. `all` equals `rows.length`; the three buckets sum to `all`. */
export function countPreviewBuckets(rows: PreviewRowFlags[]): PreviewBucketCounts {
  const counts: PreviewBucketCounts = { all: rows.length, valid: 0, duplicate: 0, error: 0 }
  for (const row of rows) {
    counts[bucketOfPreviewRow(row)] += 1
  }
  return counts
}
