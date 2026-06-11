import { describe, expect, it } from 'vitest'
import { STEP_NAMES } from '../scripts/seed-extras'

describe('seed-extras STEPS registry', () => {
  it('includes v2 deployed-DB transform and backfill steps', () => {
    expect(STEP_NAMES).toContain('set-subcategory-nature')
    expect(STEP_NAMES).toContain('v2-backfill-nature-id')
    expect(STEP_NAMES).toContain('v2-backfill-override-nature-id')
    expect(STEP_NAMES).toContain('v2-deactivate-pruned')
    expect(STEP_NAMES).toContain('v2-insert-categories-subcategories')
    expect(STEP_NAMES).toContain('v2-migrate-merges-out')
    expect(STEP_NAMES).toContain('v2-migrate-merges-in-allocation-transfer')
    expect(STEP_NAMES).toContain('v2-rename-categories-subcategories')
  })

  it('runs deactivate before nature_id backfill', () => {
    const deactivateIndex = STEP_NAMES.indexOf('v2-deactivate-pruned')
    const backfillIndex = STEP_NAMES.indexOf('v2-backfill-nature-id')
    expect(deactivateIndex).toBeGreaterThan(-1)
    expect(backfillIndex).toBeGreaterThan(deactivateIndex)
  })
})
