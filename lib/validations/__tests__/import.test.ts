import { describe, expect, it } from 'vitest'

import {
  CreatePrivateImportFormatSchema,
  InitiateUploadSchema,
  MAX_IMPORT_FILE_SIZE_BYTES,
  UpdateImportDisplayNameSchema,
  getPrivateImportFormatColumnValidationError,
  parseImportFilters,
} from '../import'

describe('InitiateUploadSchema — PDF support', () => {
  it('accepts a PDF with application/pdf content type', () => {
    const result = InitiateUploadSchema.safeParse({
      name: 'statement.pdf',
      size: 1_000_000,
      type: 'application/pdf',
    })
    expect(result.success).toBe(true)
  })

  it('accepts a PDF with application/octet-stream as a defensive fallback', () => {
    const result = InitiateUploadSchema.safeParse({
      name: 'statement.pdf',
      size: 1_000_000,
      type: 'application/octet-stream',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a PDF over the 5 MB size cap', () => {
    const result = InitiateUploadSchema.safeParse({
      name: 'statement.pdf',
      size: MAX_IMPORT_FILE_SIZE_BYTES + 1,
      type: 'application/pdf',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toMatch(/maximum import size/i)
  })

  it('rejects a file with .txt extension even if content type is application/pdf', () => {
    const result = InitiateUploadSchema.safeParse({
      name: 'statement.txt',
      size: 1_000_000,
      type: 'application/pdf',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toMatch(/CSV.*XLSX.*PDF|PDF.*CSV.*XLSX/i)
  })

  it('still accepts an existing CSV file (regression)', () => {
    const result = InitiateUploadSchema.safeParse({
      name: 'import.csv',
      size: 50_000,
      type: 'text/csv',
    })
    expect(result.success).toBe(true)
  })

  it('still accepts an existing XLSX file (regression)', () => {
    const result = InitiateUploadSchema.safeParse({
      name: 'import.xlsx',
      size: 50_000,
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    expect(result.success).toBe(true)
  })

  it('still rejects an XLSX file over the 5 MB cap (regression)', () => {
    const result = InitiateUploadSchema.safeParse({
      name: 'big.xlsx',
      size: MAX_IMPORT_FILE_SIZE_BYTES + 1,
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toMatch(/maximum import size/i)
  })
})

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

describe('CreatePrivateImportFormatSchema — existingPlatformId optional field (Plan 59-02)', () => {
  const validFileId = '11111111-1111-4111-8111-111111111111'
  const baseColumnFields = {
    delimiter: ',',
    timestampColumn: 'Data',
    descriptionColumn: 'Descrizione',
    amountMode: 'single',
    amountColumn: 'Importo',
  }

  it('accepts existingPlatformId without platformName (attach branch)', () => {
    const result = CreatePrivateImportFormatSchema.safeParse({
      fileId: validFileId,
      existingPlatformId: 7,
      ...baseColumnFields,
    })
    expect(result.success).toBe(true)
  })

  it('rejects when neither existingPlatformId nor platformName is provided (platformName path)', () => {
    const result = CreatePrivateImportFormatSchema.safeParse({
      fileId: validFileId,
      ...baseColumnFields,
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues.some(i => i.path[0] === 'platformName')).toBe(true)
  })

  it('accepts platformName without existingPlatformId (create branch regression)', () => {
    const result = CreatePrivateImportFormatSchema.safeParse({
      fileId: validFileId,
      platformName: 'My Bank',
      ...baseColumnFields,
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-integer existingPlatformId', () => {
    const result = CreatePrivateImportFormatSchema.safeParse({
      fileId: validFileId,
      existingPlatformId: 1.5,
      platformName: 'My Bank',
      ...baseColumnFields,
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-positive (zero) existingPlatformId', () => {
    const result = CreatePrivateImportFormatSchema.safeParse({
      fileId: validFileId,
      existingPlatformId: 0,
      platformName: 'My Bank',
      ...baseColumnFields,
    })
    expect(result.success).toBe(false)
  })

  it('still fires amountMode superRefine rules in attach branch', () => {
    const result = CreatePrivateImportFormatSchema.safeParse({
      fileId: validFileId,
      existingPlatformId: 7,
      delimiter: ',',
      timestampColumn: 'Data',
      descriptionColumn: 'Descrizione',
      amountMode: 'single',
      // amountColumn absent — should trigger amountColumn issue
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues.some(i => i.path[0] === 'amountColumn')).toBe(true)
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
