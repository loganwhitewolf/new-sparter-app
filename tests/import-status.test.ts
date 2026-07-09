import { describe, expect, it } from 'vitest'
import { blocksReupload } from '../lib/utils/import-status'
import type { ImportListRow } from '../lib/dal/imports'

describe('blocksReupload', () => {
  it('blocks re-upload only for a completed import', () => {
    expect(blocksReupload('imported')).toBe(true)
  })

  const nonBlockingStatuses: ImportListRow['status'][] = [
    'pending_upload',
    'uploaded',
    'analyzing',
    'analyzed',
    'importing',
    'failed',
  ]

  it.each(nonBlockingStatuses)('does not block re-upload for status %s', (status) => {
    expect(blocksReupload(status)).toBe(false)
  })
})
