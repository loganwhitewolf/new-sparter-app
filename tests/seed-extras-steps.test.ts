import { describe, expect, it } from 'vitest'
import { STEP_NAMES } from '../scripts/seed-extras'

describe('seed-extras STEPS registry', () => {
  it('exports the known taxonomy migration step names', () => {
    expect(STEP_NAMES).toContain('set-subcategory-nature')
    expect(STEP_NAMES).toContain('v2-backfill-nature-id')
    expect(STEP_NAMES).toContain('v2-backfill-override-nature-id')
    expect(STEP_NAMES).toContain('v2-deactivate-pruned')
    expect(STEP_NAMES).toContain('v2-insert-categories-subcategories')
    expect(STEP_NAMES).toContain('v2-migrate-merges-out')
    expect(STEP_NAMES).toContain('v2-migrate-merges-in-allocation-transfer')
    expect(STEP_NAMES).toContain('v2-rename-categories-subcategories')
  })

  it('runs v2-backfill-nature-id after v2-deactivate-pruned', () => {
    const deactivateIndex = STEP_NAMES.indexOf('v2-deactivate-pruned')
    const backfillIndex = STEP_NAMES.indexOf('v2-backfill-nature-id')
    expect(deactivateIndex).toBeGreaterThan(-1)
    expect(backfillIndex).toBeGreaterThan(deactivateIndex)
  })

  it('registers rebucket-income-natures before v2-backfill-nature-id', () => {
    expect(STEP_NAMES).toContain('rebucket-income-natures')
    const rebucketIndex = STEP_NAMES.indexOf('rebucket-income-natures')
    const backfillIndex = STEP_NAMES.indexOf('v2-backfill-nature-id')
    expect(rebucketIndex).toBeGreaterThan(-1)
    expect(rebucketIndex).toBeLessThan(backfillIndex)
  })

  it('registers backfill-truncated-expense-titles', () => {
    expect(STEP_NAMES).toContain('backfill-truncated-expense-titles')
  })

  it('registers ensure-trade-republic-csv-global-format after truncated-title backfill', () => {
    expect(STEP_NAMES).toContain('ensure-trade-republic-csv-global-format')
    expect(STEP_NAMES.indexOf('ensure-trade-republic-csv-global-format')).toBeGreaterThan(
      STEP_NAMES.indexOf('backfill-truncated-expense-titles'),
    )
  })

  it('registers vacanze-audit after ensure-trade-republic-csv-global-format', () => {
    expect(STEP_NAMES.indexOf('vacanze-audit-deactivate-subcategories')).toBeGreaterThan(
      STEP_NAMES.indexOf('ensure-trade-republic-csv-global-format'),
    )
  })

  it('registers reorganize-leisure-subcategories after vacanze-audit-deactivate-subcategories (append-only invariant)', () => {
    expect(STEP_NAMES.indexOf('reorganize-leisure-subcategories')).toBeGreaterThan(
      STEP_NAMES.indexOf('vacanze-audit-deactivate-subcategories'),
    )
  })

  it('D-13: registers vacanze-audit-deactivate-subcategories (TAG-06 additive taxonomy step)', () => {
    expect(STEP_NAMES).toContain('vacanze-audit-deactivate-subcategories')
  })

  // Quick task 260728-mpo: Fineco platform + format cleanup (D-01/D-02/D-03)
  it('registers both Fineco cleanup steps, merge before consolidate (D-01 before D-02)', () => {
    expect(STEP_NAMES).toContain('merge-duplicate-fineco-platforms')
    expect(STEP_NAMES).toContain('ensure-fineco-moneymap-global-format')
    expect(STEP_NAMES.indexOf('merge-duplicate-fineco-platforms')).toBeLessThan(
      STEP_NAMES.indexOf('ensure-fineco-moneymap-global-format'),
    )
  })

  it('registers insert-pacchetto-vacanze after ensure-fineco-moneymap-global-format (append-only)', () => {
    expect(STEP_NAMES).toContain('insert-pacchetto-vacanze')
    expect(STEP_NAMES.indexOf('insert-pacchetto-vacanze')).toBeGreaterThan(
      STEP_NAMES.indexOf('ensure-fineco-moneymap-global-format'),
    )
  })

  it('registers sync-category-serial-sequences last (bug 3.7 / append-only)', () => {
    expect(STEP_NAMES).toContain('sync-category-serial-sequences')
    expect(STEP_NAMES.indexOf('sync-category-serial-sequences')).toBeGreaterThan(
      STEP_NAMES.indexOf('insert-pacchetto-vacanze'),
    )
    expect(STEP_NAMES.indexOf('sync-category-serial-sequences')).toBe(STEP_NAMES.length - 1)
  })
})
