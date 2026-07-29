import { describe, expect, it } from 'vitest'
import {
  applyImportModeFilter,
  defaultRangeWindow,
  periodSpan,
} from '@/lib/utils/import-mode-filter'

type Row = {
  rowIndex: number
  description: string
  occurredAt: string | null
}

function row(rowIndex: number, occurredAt: string | null, description = `r${rowIndex}`): Row {
  return { rowIndex, description, occurredAt }
}

describe('applyImportModeFilter', () => {
  const rows = [
    row(1, '2026-07-14T10:00:00.000Z'),
    row(2, '2026-07-15T08:00:00.000Z'),
    row(3, '2026-07-16T12:00:00.000Z'),
    row(4, null),
  ]

  it('from-last keeps only calendar days strictly after lastImportedDate (D-01)', () => {
    const filtered = applyImportModeFilter({
      rows,
      mode: 'from-last',
      lastImportedDate: '2026-07-14',
    })
    expect(filtered.map((r) => r.rowIndex)).toEqual([2, 3])
  })

  it('from-last with lastImportedDate=null keeps every row with a parseable date (D-02)', () => {
    const filtered = applyImportModeFilter({
      rows,
      mode: 'from-last',
      lastImportedDate: null,
    })
    expect(filtered.map((r) => r.rowIndex)).toEqual([1, 2, 3])
  })

  it('all keeps every row regardless of lastImportedDate', () => {
    const filtered = applyImportModeFilter({
      rows,
      mode: 'all',
      lastImportedDate: '2026-07-14',
    })
    expect(filtered.map((r) => r.rowIndex)).toEqual([1, 2, 3, 4])
  })

  it('range is inclusive on calendar days and drops undated rows', () => {
    const filtered = applyImportModeFilter({
      rows,
      mode: 'range',
      lastImportedDate: null,
      rangeStart: '2026-07-14',
      rangeEnd: '2026-07-15',
    })
    expect(filtered.map((r) => r.rowIndex)).toEqual([1, 2])
  })
})

describe('defaultRangeWindow', () => {
  it('defaults to day-after-last → fileEnd when last is set (D-04)', () => {
    expect(defaultRangeWindow('2026-07-14', '2026-07-01', '2026-07-20')).toEqual({
      start: '2026-07-15',
      end: '2026-07-20',
    })
  })

  it('uses fileStart when last is null', () => {
    expect(defaultRangeWindow(null, '2026-07-01', '2026-07-20')).toEqual({
      start: '2026-07-01',
      end: '2026-07-20',
    })
  })
})

describe('periodSpan', () => {
  it('returns min/max calendar dates of dated rows', () => {
    expect(
      periodSpan([
        row(1, '2026-07-16T12:00:00.000Z'),
        row(2, '2026-07-14T10:00:00.000Z'),
        row(3, null),
      ]),
    ).toEqual({ start: '2026-07-14', end: '2026-07-16' })
  })

  it('returns nulls when empty or undated', () => {
    expect(periodSpan([])).toEqual({ start: null, end: null })
    expect(periodSpan([row(1, null)])).toEqual({ start: null, end: null })
  })
})
