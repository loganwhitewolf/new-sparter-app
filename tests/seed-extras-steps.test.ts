import { describe, expect, it } from 'vitest'
import { DROPPED_SUBCATEGORY_SLUGS, V2_SUBCATEGORY_MANIFEST } from './fixtures/v2-taxonomy-manifest'
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

  it('drops step-4 historical orphan slugs (CR-01)', () => {
    expect(DROPPED_SUBCATEGORY_SLUGS).toContain('rimborso-da-persona')
    expect(DROPPED_SUBCATEGORY_SLUGS).toContain('rimborso-abbonamento-e-canoni')
  })

  // D-16: rebucket-income-natures step is still registered (not deleted) and in correct order
  it('D-16: rebucket-income-natures step is present in registry', () => {
    expect(STEP_NAMES).toContain('rebucket-income-natures')
  })

  it('D-16: rebucket-income-natures runs before v2-backfill-nature-id (append-only invariant)', () => {
    const rebucketIndex = STEP_NAMES.indexOf('rebucket-income-natures')
    const backfillIndex = STEP_NAMES.indexOf('v2-backfill-nature-id')
    expect(rebucketIndex).toBeGreaterThan(-1)
    expect(backfillIndex).toBeGreaterThan(rebucketIndex)
  })

  // D-16: the income_extraordinary slug set is non-empty in the manifest oracle
  // This confirms the old "PO confirmation pending" skip guard was based on a stale assumption.
  // The manifest is the authoritative source consumed by v2-backfill-nature-id.
  it('D-16: manifest income_extraordinary entries are non-empty (guard precondition was always false)', () => {
    const incomeExtraordinarySlugs = V2_SUBCATEGORY_MANIFEST.filter(
      (entry) => entry.natureCode === 'income_extraordinary',
    )
    expect(incomeExtraordinarySlugs.length).toBeGreaterThan(0)
  })

  it('registers backfill-truncated-expense-titles LAST (append-only invariant)', () => {
    expect(STEP_NAMES).toContain('backfill-truncated-expense-titles')
    expect(STEP_NAMES.indexOf('backfill-truncated-expense-titles')).toBe(STEP_NAMES.length - 1)
  })
})
