import { describe, expect, it } from 'vitest'

import {
  CreatePrivateImportFormatSchema,
  UpdateImportDisplayNameSchema,
  getPrivateImportFormatColumnValidationError,
  parseImportFilters,
} from '../import'

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

  it('parses sort and dir allowlist keys for table ordering', () => {
    expect(parseImportFilters({ sort: 'displayName', dir: 'asc' })).toEqual({
      sort: 'displayName',
      dir: 'asc',
    })
    expect(parseImportFilters({ sort: 'negativeTotal', dir: 'desc' })).toEqual({
      sort: 'negativeTotal',
      dir: 'desc',
    })
    expect(parseImportFilters({ sort: 'bogus', dir: 'sideways' })).toEqual({})
  })
})

describe('CreatePrivateImportFormatSchema', () => {
  const validFileId = '11111111-1111-4111-8111-111111111111'

  it('trims wizard fields and accepts a single amount-column configuration', () => {
    expect(
      CreatePrivateImportFormatSchema.parse({
        fileId: validFileId,
        platformName: '  My Bank  ',
        delimiter: ';',
        timestampColumn: '  Data  ',
        descriptionColumn: 'Descrizione',
        amountMode: 'single',
        amountColumn: ' Importo ',
      }),
    ).toEqual({
      fileId: validFileId,
      platformName: 'My Bank',
      delimiter: ';',
      timestampColumn: 'Data',
      descriptionColumn: 'Descrizione',
      amountMode: 'single',
      amountColumn: 'Importo',
    })
  })

  it('rejects malformed wizard inputs and inconsistent amount modes', () => {
    expect(() =>
      CreatePrivateImportFormatSchema.parse({
        fileId: validFileId,
        platformName: '',
        delimiter: ':',
        timestampColumn: '',
        descriptionColumn: 'Descrizione',
        amountMode: 'single',
      }),
    ).toThrow()

    expect(() =>
      CreatePrivateImportFormatSchema.parse({
        fileId: validFileId,
        platformName: 'My Bank',
        delimiter: ',',
        timestampColumn: 'Data',
        descriptionColumn: 'Descrizione',
        amountMode: 'separate',
        amountColumn: 'Importo',
      }),
    ).toThrow()
  })

  it('validates selected columns against parsed file headers', () => {
    const parsed = CreatePrivateImportFormatSchema.parse({
      fileId: validFileId,
      platformName: 'My Bank',
      delimiter: ',',
      timestampColumn: 'Data',
      descriptionColumn: 'Descrizione',
      amountMode: 'separate',
      positiveAmountColumn: 'Entrate',
      negativeAmountColumn: 'Uscite',
    })

    expect(getPrivateImportFormatColumnValidationError(parsed, ['Data', 'Descrizione', 'Entrate', 'Uscite'])).toBeNull()
    expect(getPrivateImportFormatColumnValidationError(parsed, ['Data', 'Descrizione', 'Entrate'])).toBe(
      'Selected column does not exist in uploaded file: Uscite',
    )
  })
})

describe('UpdateImportDisplayNameSchema', () => {
  const validFileId = '11111111-1111-4111-8111-111111111111'

  it('accepts a UUID file id and trims nullable display names', () => {
    expect(
      UpdateImportDisplayNameSchema.parse({
        fileId: validFileId,
        displayName: '  January import  ',
      }),
    ).toEqual({ fileId: validFileId, displayName: 'January import' })

    expect(
      UpdateImportDisplayNameSchema.parse({
        fileId: validFileId,
        displayName: null,
      }),
    ).toEqual({ fileId: validFileId, displayName: null })
  })

  it('rejects invalid UUIDs and oversized display names while allowing the 255 character limit', () => {
    expect(() =>
      UpdateImportDisplayNameSchema.parse({ fileId: 'not-a-uuid', displayName: 'Name' }),
    ).toThrow()

    expect(
      UpdateImportDisplayNameSchema.parse({
        fileId: validFileId,
        displayName: 'x'.repeat(255),
      }).displayName,
    ).toHaveLength(255)

    expect(() =>
      UpdateImportDisplayNameSchema.parse({
        fileId: validFileId,
        displayName: 'x'.repeat(256),
      }),
    ).toThrow()
  })
})
