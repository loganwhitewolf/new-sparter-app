import { describe, expect, it } from 'vitest'
import {
  bucketOfPreviewRow,
  countPreviewBuckets,
  type PreviewRowFlags,
} from '@/lib/utils/import-preview-buckets'

describe('bucketOfPreviewRow', () => {
  it('returns error for an invalid row (invalid always wins over duplicate)', () => {
    expect(bucketOfPreviewRow({ valid: false, duplicate: false })).toBe('error')
    expect(bucketOfPreviewRow({ valid: false, duplicate: true })).toBe('error')
  })

  it('returns duplicate for a valid duplicate row', () => {
    expect(bucketOfPreviewRow({ valid: true, duplicate: true })).toBe('duplicate')
  })

  it('returns valid for a valid non-duplicate row', () => {
    expect(bucketOfPreviewRow({ valid: true, duplicate: false })).toBe('valid')
  })
})

describe('countPreviewBuckets', () => {
  it('partitions rows exactly: all === length and valid + duplicate + error === all', () => {
    const rows: PreviewRowFlags[] = [
      { valid: true, duplicate: false }, // valid
      { valid: true, duplicate: false }, // valid
      { valid: true, duplicate: true }, // duplicate
      { valid: false, duplicate: false }, // error
      { valid: false, duplicate: true }, // error (invalid wins)
    ]

    const counts = countPreviewBuckets(rows)

    expect(counts.all).toBe(rows.length)
    expect(counts).toEqual({ all: 5, valid: 2, duplicate: 1, error: 2 })
    expect(counts.valid + counts.duplicate + counts.error).toBe(counts.all)
  })

  it('returns all-zero buckets for an empty input', () => {
    expect(countPreviewBuckets([])).toEqual({ all: 0, valid: 0, duplicate: 0, error: 0 })
  })
})
