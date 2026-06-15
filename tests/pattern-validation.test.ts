import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  asc: vi.fn((field: unknown) => ({ op: 'asc', field })),
  eq: vi.fn((field: unknown, value: unknown) => ({ op: 'eq', field, value })),
  isNull: vi.fn((field: unknown) => ({ op: 'isNull', field })),
  or: vi.fn((...args: unknown[]) => ({ op: 'or', args })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ op: 'sql', strings, values })),
}))

vi.mock('@/lib/db', () => ({ db: {} }))

vi.mock('@/lib/validations/pattern', async () => {
  const actual = await vi.importActual<typeof import('../lib/validations/pattern')>('../lib/validations/pattern')
  return actual
})

vi.mock('@/lib/db/schema', () => ({
  categorizationPattern: {
    id: 'categorizationPattern.id',
    userId: 'categorizationPattern.userId',
    pattern: 'categorizationPattern.pattern',
    subCategoryId: 'categorizationPattern.subCategoryId',
    amountSign: 'categorizationPattern.amountSign',
    confidence: 'categorizationPattern.confidence',
    priority: 'categorizationPattern.priority',
    description: 'categorizationPattern.description',
    isActive: 'categorizationPattern.isActive',
    updatedAt: 'categorizationPattern.updatedAt',
  },
}))

const { CreatePatternSchema, UpdatePatternSchema, normalizePatternInput } = await import('../lib/validations/pattern')
const { createPattern, updatePattern } = await import('../lib/dal/patterns')

function makeInsertDatabase() {
  const values = vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue([{ id: 1, pattern: 'netflix' }]),
  })

  return {
    values,
    database: {
      insert: vi.fn().mockReturnValue({ values }),
    },
  }
}

function makeUpdateDatabase() {
  const set = vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: 1, pattern: 'netflix' }]),
    }),
  })

  return {
    set,
    database: {
      update: vi.fn().mockReturnValue({ set }),
    },
  }
}

describe('normalizePatternInput', () => {
  it('keeps raw regex sources as canonical source strings', () => {
    expect(normalizePatternInput('netflix')).toBe('netflix')
  })

  it('normalizes slash-delimited /source/i input to source-only storage', () => {
    expect(normalizePatternInput('/netflix/i')).toBe('netflix')
  })

  it('trims whitespace around raw and slash-delimited input', () => {
    expect(normalizePatternInput('  netflix  ')).toBe('netflix')
    expect(normalizePatternInput('  /netflix/i  ')).toBe('netflix')
  })

  it('rejects empty pattern sources', () => {
    expect(() => normalizePatternInput('   ')).toThrow('Pattern regex non valido.')
    expect(() => normalizePatternInput('//i')).toThrow('Pattern regex non valido.')
  })

  it('rejects malformed regex sources as validation failures', () => {
    expect(() => normalizePatternInput('([')).toThrow('Pattern regex non valido.')
  })

  it('rejects unsupported slash-delimited flags before storage', () => {
    expect(() => normalizePatternInput('/netflix/g')).toThrow('Flag regex non supportati. Usa solo /pattern/i oppure pattern.')
  })

  it('treats raw strings containing slashes as raw regex sources unless they are slash-delimited wrappers', () => {
    expect(normalizePatternInput('netflix/payment')).toBe('netflix/payment')
  })
})

describe('pattern validation schemas', () => {
  it('transforms create pattern values to canonical source strings', () => {
    const result = CreatePatternSchema.parse({
      pattern: ' /netflix/i ',
      subCategoryId: 42,
      amountSign: 'negative',
      confidence: 0.95,
    })

    expect(result.pattern).toBe('netflix')
  })

  it('transforms update pattern values to canonical source strings when pattern is present', () => {
    const result = UpdatePatternSchema.parse({ pattern: ' /netflix/i ' })

    expect(result.pattern).toBe('netflix')
  })
})

describe('pattern DAL normalization', () => {
  it('normalizes slash-delimited createPattern input before DB writes', async () => {
    const { database, values } = makeInsertDatabase()

    // Phase 46: amountSign removed (ADR 0012)
    await createPattern({
      userId: 'user-1',
      pattern: '/netflix/i',
      subCategoryId: 42,
      confidence: 0.95,
    }, database as never)

    expect(values).toHaveBeenCalledWith(expect.objectContaining({ pattern: 'netflix' }))
  })

  it('normalizes slash-delimited updatePattern input before DB writes', async () => {
    const { database, set } = makeUpdateDatabase()

    await updatePattern(1, 'user-1', { pattern: '/netflix/i' }, database as never)

    expect(set).toHaveBeenCalledWith(expect.objectContaining({ pattern: 'netflix' }))
  })
})
