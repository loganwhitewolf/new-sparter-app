import { describe, it, expect } from 'vitest'
import {
  CreateExpenseSchema,
  UpdateExpenseSchema,
  BulkCategorizeSchema,
  parseExpenseFilters,
} from '../expense'

describe('CreateExpenseSchema', () => {
  it('Test 1: fails for empty title with "almeno 2 caratteri" message', () => {
    const result = CreateExpenseSchema.safeParse({ title: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(' ')
      expect(messages).toMatch(/almeno 2 caratteri/)
    }
  })

  it('Test 2: succeeds for title-only input with optional fields undefined', () => {
    const result = CreateExpenseSchema.safeParse({ title: 'Netflix' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.title).toBe('Netflix')
      expect(result.data.subCategoryId).toBeUndefined()
      expect(result.data.notes).toBeUndefined()
    }
  })

  it('Test 3: fails for title exceeding 120 chars with "120 caratteri" message', () => {
    const result = CreateExpenseSchema.safeParse({ title: 'X'.repeat(121) })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(' ')
      expect(messages).toMatch(/120 caratteri/)
    }
  })
})

describe('UpdateExpenseSchema', () => {
  it('Test 4: succeeds with title and id present', () => {
    const result = UpdateExpenseSchema.safeParse({ title: 'Netflix', id: 'abc-123' })
    expect(result.success).toBe(true)
  })

  it('Test 5: fails when id is missing', () => {
    const result = UpdateExpenseSchema.safeParse({ title: 'Netflix' })
    expect(result.success).toBe(false)
  })
})

describe('BulkCategorizeSchema', () => {
  it('Test 6: fails for empty ids array with "almeno una spesa" message', () => {
    const result = BulkCategorizeSchema.safeParse({ ids: [], subCategoryId: 1 })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(' ')
      expect(messages).toMatch(/almeno una spesa/)
    }
  })

  it('Test 7: fails when subCategoryId is 0 (not positive)', () => {
    const result = BulkCategorizeSchema.safeParse({ ids: ['id1'], subCategoryId: 0 })
    expect(result.success).toBe(false)
  })
})

// ─── parseExpenseFilters — cascade filters (lcp-01 Task 3) ───────────────────

describe('parseExpenseFilters — nature/type/subCategory (lcp-01)', () => {
  it('parses a valid nature value', () => {
    const result = parseExpenseFilters({ nature: 'essential' })
    expect(result.nature).toBe('essential')
  })

  it("parses 'unclassified' nature", () => {
    const result = parseExpenseFilters({ nature: 'unclassified' })
    expect(result.nature).toBe('unclassified')
  })

  it('drops invalid nature tokens silently', () => {
    const result = parseExpenseFilters({ nature: 'bogus_nature' })
    expect(result.nature).toBeUndefined()
  })

  it('parses a valid type value', () => {
    const result = parseExpenseFilters({ type: 'out' })
    expect(result.type).toBe('out')
  })

  it('parses in/out/transfer types', () => {
    expect(parseExpenseFilters({ type: 'in' }).type).toBe('in')
    expect(parseExpenseFilters({ type: 'out' }).type).toBe('out')
    expect(parseExpenseFilters({ type: 'transfer' }).type).toBe('transfer')
    expect(parseExpenseFilters({ type: 'unclassified' }).type).toBe('unclassified')
  })

  it('drops invalid type tokens silently', () => {
    const result = parseExpenseFilters({ type: 'badtype' })
    expect(result.type).toBeUndefined()
  })

  it('parses a valid positive integer subCategory as subCategoryId', () => {
    const result = parseExpenseFilters({ subCategory: '42' })
    expect(result.subCategoryId).toBe(42)
  })

  it('drops non-integer subCategory silently', () => {
    expect(parseExpenseFilters({ subCategory: 'abc' }).subCategoryId).toBeUndefined()
    expect(parseExpenseFilters({ subCategory: '0' }).subCategoryId).toBeUndefined()
    expect(parseExpenseFilters({ subCategory: '-1' }).subCategoryId).toBeUndefined()
  })

  it('omits nature/type/subCategoryId when params are absent', () => {
    const result = parseExpenseFilters({})
    expect(result.nature).toBeUndefined()
    expect(result.type).toBeUndefined()
    expect(result.subCategoryId).toBeUndefined()
  })
})
