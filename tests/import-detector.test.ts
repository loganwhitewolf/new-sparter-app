import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import Decimal from 'decimal.js'
import { detectImportFormat } from '../lib/services/import-format-detector'
import { parseImportFile } from '../lib/services/import-parsers'
import { normalizeTransactionRow } from '../lib/utils/import'
import { TR_SYNTHETIC_HEADERS } from '../lib/services/trade-republic-pdf-parser'
import { importFormatVersions as seedFormatVersions, platforms as seedPlatforms } from '../scripts/seed-data'

const fixturePath = (name: string) => join(process.cwd(), 'tests', 'fixtures', 'import', name)

const expectedFixtureHeaders = [
  ['general.csv', 'timestamp,description,amount'],
  ['crypto-com.csv', 'Timestamp (UTC),Transaction Description,Amount'],
  ['satispay.csv', 'Data,Nome,Importo'],
  ['intesa-sp.csv', 'Data,Operazione,Importo'],
  ['intesa-sp-carta-credito.csv', 'Data operazione,Descrizione,Addebiti'],
  ['revolut.csv', 'Completed Date,Description,Amount'],
  ['fineco.csv', 'Data,Descrizione_Completa,Entrate,Uscite'],
] as const

// Build candidate fixtures from version-sourced contract (ADR 0013).
// Contract fields come from importFormatVersions; identity (id, name, slug, country) from platforms.
const formats = seedPlatforms.map((p) => {
  const fv = seedFormatVersions.find((v) => v.platformId === p.id)
  if (!fv) throw new Error(`No format version found for platform id ${p.id}`)
  return {
    id: p.id * 10,
    platformId: p.id,
    platform: {
      id: p.id,
      name: p.name,
      slug: p.slug,
      country: p.country,
      // Contract from importFormatVersion
      delimiter: fv.delimiter,
      timestampColumn: fv.timestampColumn,
      descriptionColumn: fv.descriptionColumn,
      amountType: fv.amountType,
      amountColumn: fv.amountColumn ?? null,
      positiveAmountColumn: fv.positiveAmountColumn ?? null,
      negativeAmountColumn: fv.negativeAmountColumn ?? null,
      multiplyBy: fv.multiplyBy,
      descriptionStripPattern: fv.descriptionStripPattern ?? null,
    },
    version: 1,
    headerSignature: [
      fv.timestampColumn,
      fv.descriptionColumn,
      fv.amountColumn,
      fv.positiveAmountColumn,
      fv.negativeAmountColumn,
    ].filter((column): column is string => Boolean(column)).join(fv.delimiter),
    isActive: true,
  }
})

async function detectFixture(fileName: string) {
  const parsed = await parseImportFile(readFileSync(fixturePath(fileName)), { fileName })
  return detectImportFormat({ parsed, formats, userId: 'user-1' })
}

describe('import detector fixture contracts', () => {
  it.each(expectedFixtureHeaders)('tracks %s with its seeded header signature', (fileName, expectedHeader) => {
    const [header] = readFileSync(fixturePath(fileName), 'utf8').split('\n')
    expect(header).toBe(expectedHeader)
  })

  it('keeps seeded platform countries within the database varchar(2) constraint', () => {
    expect(seedPlatforms.map((platform) => [platform.slug, platform.country])).toEqual(
      expect.arrayContaining([['general', 'ZZ']]),
    )
    for (const platform of seedPlatforms) {
      expect(platform.country).toHaveLength(2)
    }
  })

  it('keeps duplicate fixture rows for later duplicate detection previews', () => {
    for (const [fileName] of expectedFixtureHeaders) {
      const [, ...dataRows] = readFileSync(fixturePath(fileName), 'utf8').trim().split('\n')
      expect(new Set(dataRows).size).toBeLessThan(dataRows.length)
    }
  })

  it.each([
    ['general.csv', 'general'],
    ['crypto-com.csv', 'crypto-com'],
    ['satispay.csv', 'satispay'],
    ['intesa-sp.csv', 'intesa-sp'],
    ['intesa-sp-carta-credito.csv', 'intesa-sp-carta-credito'],
    ['revolut.csv', 'revolut'],
    ['fineco.csv', 'fineco'],
  ] as const)('detects %s by seeded columns, parseability, and amount shape', async (fileName, slug) => {
    const result = await detectFixture(fileName)

    expect(result.bestCandidate?.platform.slug).toBe(slug)
    expect(result.bestCandidate?.confidence).toBeGreaterThanOrEqual(0.8)
    expect(result.candidates[0]?.platform.slug).toBe(slug)
    expect(result.preview.rowCount).toBe(3)
    expect(result.preview.sampleRows).toHaveLength(3)
    expect(result.preview.duplicateCount).toBe(1)
    expect(result.errors).toEqual([])
  })

  it('parses BOM-prefixed CSV headers without poisoning detection', async () => {
    const csv = `\uFEFF${readFileSync(fixturePath('general.csv'), 'utf8')}`
    const parsed = await parseImportFile(Buffer.from(csv, 'utf8'), { fileName: 'general.csv' })
    const result = detectImportFormat({ parsed, formats, userId: 'user-1' })

    expect(parsed.headers).toEqual(['timestamp', 'description', 'amount'])
    expect(result.bestCandidate?.platform.slug).toBe('general')
  })

  it('detects an inline user-private format without relying on seeded global formats', async () => {
    const parsed = await parseImportFile(Buffer.from('Quando;Cosa;Valore\n2026-01-02;Nuovo negozio;-12,30\n', 'utf8'), {
      fileName: 'private-format.csv',
    })
    const result = detectImportFormat({
      parsed,
      userId: 'user-private-1',
      formats: [
        {
          id: 901,
          platformId: 801,
          version: 1,
          headerSignature: 'Quando;Cosa;Valore',
          isActive: true,
          platform: {
            id: 801,
            name: 'Private Bank',
            slug: 'private-bank-user-private-1',
            delimiter: ';',
            country: 'IT',
            timestampColumn: 'Quando',
            descriptionColumn: 'Cosa',
            descriptionStripPattern: null,
            amountType: 'single',
            amountColumn: 'Valore',
            positiveAmountColumn: null,
            negativeAmountColumn: null,
            multiplyBy: 1,
          },
        },
      ],
    })

    expect(result.bestCandidate).toMatchObject({
      formatVersionId: 901,
      platformId: 801,
      platform: { slug: 'private-bank-user-private-1' },
    })
    expect(result.preview.sampleRows[0]).toMatchObject({
      description: 'Nuovo negozio',
      amount: '-12.30',
      valid: true,
    })
    expect(result.errors).toEqual([])
  })

  it('returns a structured non-secret error when no seeded format matches', async () => {
    const parsed = await parseImportFile(Buffer.from('Quando;Cosa;Valore\nfoo;bar;baz\n', 'utf8'), {
      fileName: 'unknown.csv',
    })
    const result = detectImportFormat({ parsed, formats, userId: 'user-1' })

    expect(result.bestCandidate).toBeNull()
    expect(result.errors).toContain('No supported import format matched the uploaded file headers and sample rows.')
    expect(result.candidates).toHaveLength(formats.length)
  })

  it('bounds oversized file parsing before parser work', async () => {
    const parsed = await parseImportFile(Buffer.from('timestamp,description,amount\n', 'utf8'), {
      fileName: 'oversized.csv',
      maxBytes: 5,
    })

    expect(parsed.rows).toEqual([])
    expect(parsed.errors[0]).toContain('exceeds the maximum import size')
  })
})

// ---------------------------------------------------------------------------
// Trade Republic PDF — detector + normalizeTransactionRow (Task 2, Plan 57-04)
// ---------------------------------------------------------------------------

// Build the TR format config mirroring the seeded import_format_version for platformId 8.
const trPlatform = seedPlatforms.find((p) => p.slug === 'trade-republic')!
const trFormatVersion = seedFormatVersions.find((fv) => fv.platformId === trPlatform.id)!

// headerSignature matches seeded value: "data,descrizione,importo_entrata,importo_uscita"
const trHeaderSignature = [
  trFormatVersion.timestampColumn,
  trFormatVersion.descriptionColumn,
  trFormatVersion.positiveAmountColumn,
  trFormatVersion.negativeAmountColumn,
].filter((c): c is string => Boolean(c)).join(trFormatVersion.delimiter)

const trFormat = {
  id: trPlatform.id * 10,
  platformId: trPlatform.id,
  version: 1,
  headerSignature: trHeaderSignature,
  isActive: true,
  platform: {
    id: trPlatform.id,
    name: trPlatform.name,
    slug: trPlatform.slug,
    country: trPlatform.country,
    delimiter: trFormatVersion.delimiter,
    timestampColumn: trFormatVersion.timestampColumn,
    descriptionColumn: trFormatVersion.descriptionColumn,
    amountType: trFormatVersion.amountType,
    amountColumn: trFormatVersion.amountColumn ?? null,
    positiveAmountColumn: trFormatVersion.positiveAmountColumn ?? null,
    negativeAmountColumn: trFormatVersion.negativeAmountColumn ?? null,
    multiplyBy: trFormatVersion.multiplyBy,
    descriptionStripPattern: trFormatVersion.descriptionStripPattern ?? null,
  },
}

// Synthetic ParsedImportFile matching the parser output (delimiter: null, TR synthetic headers)
function buildTrParsedFile() {
  // Credit row: importo_entrata populated, importo_uscita empty
  const creditRow = {
    data: '01 gen 2026',
    descrizione: 'Deposito conto',
    importo_entrata: '100,00',
    importo_uscita: '',
  }
  // Debit row: importo_uscita populated, importo_entrata empty
  const debitRow = {
    data: '02 gen 2026',
    descrizione: 'Acquisto ETF',
    importo_entrata: '',
    importo_uscita: '50,00',
  }
  const rows = [creditRow, debitRow]
  return {
    fileName: 'trade-republic-sample.pdf',
    byteLength: 23000,
    encoding: null,
    delimiter: null, // Pitfall 5: null → delimiterScore = 1.0
    headers: [...TR_SYNTHETIC_HEADERS],
    rows,
    rowCount: rows.length,
    sampleRows: rows,
    warnings: [],
    errors: [],
  }
}

describe('Trade Republic PDF — detector', () => {
  it('detects TR synthetic headers with confidence >= 0.8 against the seeded import_format_version', () => {
    const parsed = buildTrParsedFile()
    const result = detectImportFormat({ parsed, formats: [trFormat], userId: 'user-tr-1' })

    expect(result.bestCandidate).not.toBeNull()
    expect(result.bestCandidate?.platform.slug).toBe('trade-republic')
    expect(result.bestCandidate?.confidence).toBeGreaterThanOrEqual(0.8)
    expect(result.errors).toHaveLength(0)
  })

  it('headerSignature exact match gives signatureScore 1.0 (confidence >= 0.9)', () => {
    const parsed = buildTrParsedFile()
    const result = detectImportFormat({ parsed, formats: [trFormat], userId: 'user-tr-1' })

    // Research Q3 prediction: headerScore 1.0 + signatureScore 1.0 + delimiterScore 1.0
    // → confidence = 0.45 * 1 + 0.3 * validRows + 0.15 * amountShape + 0.05 * 1 + 0.05 * 1 = >= 0.9
    expect(result.bestCandidate?.confidence).toBeGreaterThanOrEqual(0.9)
  })

  it('TR format detects correctly when seeded alongside all other CSV/XLSX formats', () => {
    // Include all seeded formats + the TR format; TR PDF must still win
    const allFormats = [
      ...formats, // the existing seeded CSV/XLSX formats built in the outer scope
      trFormat,
    ]
    const parsed = buildTrParsedFile()
    const result = detectImportFormat({ parsed, formats: allFormats, userId: 'user-tr-2' })

    expect(result.bestCandidate?.platform.slug).toBe('trade-republic')
    expect(result.bestCandidate?.confidence).toBeGreaterThanOrEqual(0.8)
  })

  it('detector still resolves all CSV/XLSX formats correctly (no regression)', async () => {
    // Run the full existing CSV fixture battery to confirm nothing broke
    const csvFixtures = [
      ['general.csv', 'general'],
      ['satispay.csv', 'satispay'],
      ['intesa-sp.csv', 'intesa-sp'],
      ['revolut.csv', 'revolut'],
      ['fineco.csv', 'fineco'],
    ] as const

    for (const [fileName, slug] of csvFixtures) {
      const result = await detectFixture(fileName)
      expect(result.bestCandidate?.platform.slug).toBe(slug)
      expect(result.bestCandidate?.confidence).toBeGreaterThanOrEqual(0.8)
    }
  })
})

describe('Trade Republic PDF — normalizeTransactionRow sign attribution', () => {
  const trPlatformConfig = {
    ...trFormat.platform,
    platformId: trFormat.platformId,
  }

  it('credit row (importo_entrata populated) produces a positive amount', () => {
    const creditRow = {
      data: '01 gen 2026',
      descrizione: 'Deposito conto',
      importo_entrata: '100,00',
      importo_uscita: '',
    }
    const normalized = normalizeTransactionRow(creditRow, trPlatformConfig, { userId: 'user-tr-1', rowIndex: 1 })

    expect(normalized.errors).toHaveLength(0)
    expect(normalized.amount).not.toBeNull()
    // Credit row: amount must be positive
    expect(new Decimal(normalized.amount!).isPositive()).toBe(true)
    expect(new Decimal(normalized.amount!).toFixed(2)).toBe('100.00')
  })

  it('debit row (importo_uscita populated) produces a negative amount', () => {
    const debitRow = {
      data: '02 gen 2026',
      descrizione: 'Acquisto ETF',
      importo_entrata: '',
      importo_uscita: '50,00',
    }
    const normalized = normalizeTransactionRow(debitRow, trPlatformConfig, { userId: 'user-tr-1', rowIndex: 2 })

    expect(normalized.errors).toHaveLength(0)
    expect(normalized.amount).not.toBeNull()
    // Debit row: amount must be negative
    expect(new Decimal(normalized.amount!).isNegative()).toBe(true)
    expect(new Decimal(normalized.amount!).toFixed(2)).toBe('-50.00')
  })

  it('credit row and debit row produce opposite-signed amounts', () => {
    const creditRow = { data: '01 gen 2026', descrizione: 'Stipendio', importo_entrata: '200,00', importo_uscita: '' }
    const debitRow = { data: '03 gen 2026', descrizione: 'Bolletta', importo_entrata: '', importo_uscita: '80,00' }

    const credit = normalizeTransactionRow(creditRow, trPlatformConfig, { userId: 'user-tr-1', rowIndex: 1 })
    const debit = normalizeTransactionRow(debitRow, trPlatformConfig, { userId: 'user-tr-1', rowIndex: 2 })

    expect(new Decimal(credit.amount!).isPositive()).toBe(true)
    expect(new Decimal(debit.amount!).isNegative()).toBe(true)
  })

  it('data column parses to a valid Date via parseBankDate (Italian month format)', () => {
    const row = {
      data: '15 mar 2026',
      descrizione: 'Pagamento',
      importo_entrata: '',
      importo_uscita: '30,00',
    }
    const normalized = normalizeTransactionRow(row, trPlatformConfig, { userId: 'user-tr-1', rowIndex: 1 })

    expect(normalized.errors).toHaveLength(0)
    expect(normalized.occurredAt).not.toBeNull()
    expect(normalized.occurredAt).toBeInstanceOf(Date)
    expect(normalized.occurredAt!.getUTCFullYear()).toBe(2026)
    expect(normalized.occurredAt!.getUTCMonth()).toBe(2) // March = index 2
    expect(normalized.occurredAt!.getUTCDate()).toBe(15)
  })

  it('end-to-end: fixture rows through parseImportFile → detectImportFormat → preview has correct signs', async () => {
    const bytes = readFileSync(join(process.cwd(), 'tests', 'fixtures', 'import', 'trade-republic-sample.pdf'))
    const parsed = await parseImportFile(bytes, { fileName: 'trade-republic-sample.pdf' })

    expect(parsed.errors).toHaveLength(0)
    expect(parsed.rowCount).toBeGreaterThan(0)

    const allFormats = [...formats, trFormat]
    const result = detectImportFormat({ parsed, formats: allFormats, userId: 'user-tr-e2e' })

    expect(result.bestCandidate?.platform.slug).toBe('trade-republic')

    // At least one preview row must be valid (some TR rows may lack description — those are expected invalid)
    const validRows = result.preview.sampleRows.filter(r => r.valid)
    expect(validRows.length).toBeGreaterThan(0)

    // For all valid rows: amount must be non-null, non-zero, and correctly signed
    for (const row of validRows) {
      expect(row.amount).not.toBeNull()
      const amount = new Decimal(row.amount!)
      // Amount must be non-zero
      expect(amount.isZero()).toBe(false)
      // Either positive (credit) or negative (debit)
      expect(amount.isPositive() || amount.isNegative()).toBe(true)
    }

    // At least one credit (positive) and one debit (negative) row must appear
    const positiveRows = validRows.filter(r => r.amount && new Decimal(r.amount).isPositive())
    const negativeRows = validRows.filter(r => r.amount && new Decimal(r.amount).isNegative())
    expect(positiveRows.length).toBeGreaterThan(0)
    expect(negativeRows.length).toBeGreaterThan(0)
  })
})
