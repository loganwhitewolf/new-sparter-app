// Unit tests for sortReimbursementRows (components/reimbursements/reimbursement-table.tsx) and
// formatResidualBadgeLabel (lib/utils/reimbursement-format.ts) — the pure helpers the
// ReimbursementTable client component wires into HeaderSortButton/DataTableToolbar (RMB-10).
// Extracted as standalone exports precisely so they are testable without jsdom (this repo has
// none) — mirrors the reimbursement-panel.test.ts / computeMergeEligibility precedent.
import { describe, expect, it } from 'vitest'
import { sortReimbursementRows } from '@/components/reimbursements/reimbursement-table'
import { formatResidualBadgeLabel } from '@/lib/utils/reimbursement-format'
import type { ReimbursementListRow } from '@/lib/dal/reimbursement'

function makeRow(overrides: Partial<ReimbursementListRow>): ReimbursementListRow {
  return {
    id: 1,
    title: 'Row',
    displayTitle: 'Row',
    anchorExpenseId: 'exp-1',
    anchorTitle: 'Anchor',
    anchorDate: new Date('2026-01-01'),
    outflowSum: '0.00',
    refundSum: '0.00',
    residual: '0.00',
    state: 'settled',
    ...overrides,
  }
}

describe('sortReimbursementRows', () => {
  it('sorts by residual ascending using Decimal comparison, not string comparison', () => {
    // A naive string sort would misorder '-100.00' vs '20.00' (string compare: '-' < '2').
    const rows = [
      makeRow({ id: 1, residual: '20.00', state: 'surplus' }),
      makeRow({ id: 2, residual: '-100.00', state: 'owed' }),
    ]

    const sorted = sortReimbursementRows(rows, 'residual', 'asc')

    expect(sorted.map((r) => r.id)).toEqual([2, 1])
  })

  it('sorts by anchorDate descending with equal dates preserving array order (stable sort)', () => {
    const sameDate = new Date('2026-05-01')
    const rows = [
      makeRow({ id: 1, anchorDate: sameDate }),
      makeRow({ id: 2, anchorDate: sameDate }),
      makeRow({ id: 3, anchorDate: sameDate }),
    ]

    const sorted = sortReimbursementRows(rows, 'anchorDate', 'desc')

    expect(sorted.map((r) => r.id)).toEqual([1, 2, 3])
  })

  it('sorts by title using localeCompare', () => {
    const rows = [
      makeRow({ id: 1, displayTitle: 'Zaino' }),
      makeRow({ id: 2, displayTitle: 'Alfa' }),
    ]

    const sorted = sortReimbursementRows(rows, 'title', 'asc')

    expect(sorted.map((r) => r.id)).toEqual([2, 1])
  })
})

describe('formatResidualBadgeLabel exact-zero boundary (RMB-10 adjacency)', () => {
  it('returns exactly "Saldato" for a 0.00 residual, never a Dovuti/Surplus string', () => {
    const label = formatResidualBadgeLabel('0.00', 'settled')

    expect(label).toBe('Saldato')
    expect(label).not.toContain('Dovuti')
    expect(label).not.toContain('Surplus')
  })
})
