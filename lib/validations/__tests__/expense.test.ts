import { describe, it, expect } from 'vitest'
import {
  CreateExpenseSchema,
  UpdateExpenseSchema,
  BulkCategorizeSchema,
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
