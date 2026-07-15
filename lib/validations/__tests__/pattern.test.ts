import { describe, it, expect } from 'vitest'
import { normalizePatternInput, CreatePatternSchema } from '../pattern'

describe('normalizePatternInput — ReDoS guard (H-3)', () => {
  it('rejects catastrophic-backtracking patterns (nested quantifiers)', () => {
    // The exploit from docs/security/audit-2026-07-14.md finding H-3.
    for (const evil of ['(a+)+$', '(x+x+)+y', '(a*)*', '(.*a){20}']) {
      expect(() => normalizePatternInput(evil)).toThrow(/costosa/)
    }
  })

  it('rejects patterns longer than the length cap', () => {
    const long = 'a'.repeat(201)
    expect(() => normalizePatternInput(long)).toThrow(/troppo lungo/)
  })

  it('accepts legitimate merchant patterns unchanged', () => {
    for (const ok of ['amazon|amzn', 'paypal \\*', 'satispay', '\\bnetflix\\b', 'foo.*bar']) {
      expect(normalizePatternInput(ok)).toBe(ok)
    }
  })

  it('strips /.../i delimiters and preserves the source', () => {
    expect(normalizePatternInput('/amazon/i')).toBe('amazon')
  })
})

describe('CreatePatternSchema — surfaces the ReDoS rejection', () => {
  it('fails to parse a payload carrying an unsafe pattern', () => {
    const result = CreatePatternSchema.safeParse({
      pattern: '(a+)+$',
      subCategoryId: 1,
      confidence: 0.9,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((i) => i.message).join(' ')).toMatch(/costosa/)
    }
  })

  it('parses a payload with a safe pattern', () => {
    const result = CreatePatternSchema.safeParse({
      pattern: 'amazon',
      subCategoryId: 1,
      confidence: 0.9,
    })
    expect(result.success).toBe(true)
  })
})
