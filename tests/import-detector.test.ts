import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { detectImportFormat } from '../lib/services/import-format-detector'
import { parseImportFile } from '../lib/services/import-parsers'
import { platforms as seedPlatforms } from '../docs/init/seed'

const fixturePath = (name: string) => join(process.cwd(), 'tests', 'fixtures', 'import', name)

const expectedFixtureHeaders = [
  ['general.csv', 'timestamp,description,amount'],
  ['satispay.csv', 'Data,Nome,Importo'],
  ['intesa-sp.csv', 'Data,Operazione,Importo'],
  ['intesa-sp-carta-credito.csv', 'Data operazione,Descrizione,Addebiti'],
  ['revolut.csv', 'Completed Date,Description,Amount'],
  ['fineco.csv', 'Data,Descrizione_Completa,Entrate,Uscite'],
] as const

const formats = seedPlatforms.map((platform) => ({
  id: platform.id * 10,
  platformId: platform.id,
  platform,
  version: 1,
  headerSignature: [
    platform.timestampColumn,
    platform.descriptionColumn,
    platform.amountColumn,
    platform.positiveAmountColumn,
    platform.negativeAmountColumn,
  ].filter((column): column is string => Boolean(column)).join(platform.delimiter),
  isActive: true,
}))

async function detectFixture(fileName: string) {
  const parsed = await parseImportFile(readFileSync(fixturePath(fileName)), { fileName })
  return detectImportFormat({ parsed, formats, userId: 'user-1' })
}

describe('import detector fixture contracts', () => {
  it.each(expectedFixtureHeaders)('tracks %s with its seeded header signature', (fileName, expectedHeader) => {
    const [header] = readFileSync(fixturePath(fileName), 'utf8').split('\n')
    expect(header).toBe(expectedHeader)
  })

  it('keeps duplicate fixture rows for later duplicate detection previews', () => {
    for (const [fileName] of expectedFixtureHeaders) {
      const [, ...dataRows] = readFileSync(fixturePath(fileName), 'utf8').trim().split('\n')
      expect(new Set(dataRows).size).toBeLessThan(dataRows.length)
    }
  })

  it.each([
    ['general.csv', 'general'],
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
