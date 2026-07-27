// buildPairGuardMessage() (RMB-09, Phase 74) — pure-function unit test, no vi.mock needed at
// all ('server-only' is globally aliased to an empty stub in vitest.config.ts, and this
// function has zero DB/service dependencies of its own). Mirrors this codebase's established
// "exported pure function for direct unit testing" pattern (e.g. computeMergeEligibility,
// isGroupTitleValid).
import { describe, expect, it } from 'vitest'
import { buildPairGuardMessage } from '@/lib/services/transaction-edit'

describe('buildPairGuardMessage', () => {
  it('returns the exact plain message at N=1 (title never interpolated)', () => {
    expect(
      buildPairGuardMessage({ refundCount: 1, reimbursementTitle: 'Cena di gruppo' }),
    ).toBe('Scollega prima il rimborso')
  })

  it('returns the plain message for the defensive N=0 fallback shape', () => {
    expect(buildPairGuardMessage({ refundCount: 0, reimbursementTitle: '' })).toBe(
      'Scollega prima il rimborso',
    )
  })

  it('names the blocking reimbursement by title when N>1 (RMB-09/encoding)', () => {
    const message = buildPairGuardMessage({
      refundCount: 2,
      reimbursementTitle: 'Cena di gruppo',
    })

    expect(message).toContain('Scollega prima il rimborso')
    expect(message).toContain('Cena di gruppo')
  })

  it('interpolates a title containing embedded double-quotes unmangled', () => {
    // Title text is plain Italian display copy, never re-parsed as a structured format, so no
    // escaping/sanitization is attempted or required here.
    const message = buildPairGuardMessage({
      refundCount: 3,
      reimbursementTitle: 'Regalo per "Mario"',
    })

    expect(message).toContain('Regalo per "Mario"')
  })
})
