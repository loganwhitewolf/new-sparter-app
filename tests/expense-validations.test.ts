import { describe, expect, it } from 'vitest'
import { CreateExpenseSchema, UpdateExpenseTitleSchema } from '@/lib/validations/expense'

// The expense title bound was widened 120 → 500 when expense.title became `text`,
// so a backfilled long bank description round-trips through the update action.
describe('expense title schema — length bounds (widened to 500)', () => {
  const long185 = 'x'.repeat(185)
  const over500 = 'y'.repeat(501)

  it('accepts a 185-char title (previously truncated at 120)', () => {
    expect(CreateExpenseSchema.safeParse({ title: long185 }).success).toBe(true)
    expect(UpdateExpenseTitleSchema.safeParse({ id: 'e1', title: long185 }).success).toBe(true)
  })

  it('rejects a >500-char title with the Italian 500-char message', () => {
    const res = UpdateExpenseTitleSchema.safeParse({ id: 'e1', title: over500 })
    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.error.issues[0]?.message).toBe('Il titolo non può superare i 500 caratteri.')
    }
  })

  it('still enforces the min(2) lower bound', () => {
    expect(UpdateExpenseTitleSchema.safeParse({ id: 'e1', title: 'a' }).success).toBe(false)
  })
})
