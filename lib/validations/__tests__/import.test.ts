import { describe, expect, it } from 'vitest'

import { parseImportFilters } from '../import'

describe('parseImportFilters', () => {
  it('returns an empty filter object for empty Next searchParams', () => {
    expect(parseImportFilters({})).toEqual({})
  })

  it('accepts trimmed query and date-only ranges with inclusive upper bounds', () => {
    expect(
      parseImportFilters({
        q: '  january import ',
        importedFrom: '2026-01-01',
        importedTo: '2026-01-31',
        referenceFrom: '2025-12-01',
        referenceTo: '2025-12-31',
      }),
    ).toEqual({
      q: 'january import',
      importedFrom: '2026-01-01',
      importedTo: '2026-01-31',
      referenceFrom: '2025-12-01',
      referenceTo: '2025-12-31',
      importedFromDate: new Date('2026-01-01T00:00:00.000Z'),
      importedToDate: new Date('2026-01-31T23:59:59.999Z'),
      referenceFromDate: new Date('2025-12-01T00:00:00.000Z'),
      referenceToDate: new Date('2025-12-31T23:59:59.999Z'),
    })
  })

  it('uses the first array value and ignores malformed filters without throwing', () => {
    expect(() =>
      parseImportFilters({
        q: ['   ', 'later value'],
        importedFrom: ['2026-02-30', '2026-02-01'],
        importedTo: ['not-a-date', '2026-02-28'],
        referenceFrom: ['2026-13-01'],
        referenceTo: ['2026-01-32'],
      }),
    ).not.toThrow()

    expect(
      parseImportFilters({
        q: ['   ', 'later value'],
        importedFrom: ['2026-02-30', '2026-02-01'],
        importedTo: ['not-a-date', '2026-02-28'],
        referenceFrom: ['2026-13-01'],
        referenceTo: ['2026-01-32'],
      }),
    ).toEqual({})
  })

  it('keeps partial ranges when each provided date is valid', () => {
    expect(
      parseImportFilters({
        importedFrom: '2026-03-01',
        referenceTo: '2026-03-31',
      }),
    ).toEqual({
      importedFrom: '2026-03-01',
      referenceTo: '2026-03-31',
      importedFromDate: new Date('2026-03-01T00:00:00.000Z'),
      referenceToDate: new Date('2026-03-31T23:59:59.999Z'),
    })
  })

  it('ignores oversized query strings instead of passing them to SQL', () => {
    expect(parseImportFilters({ q: 'x'.repeat(256) })).toEqual({})
  })
})
