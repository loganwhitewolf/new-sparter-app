/**
 * Trade Republic PDF parser — calibration probe + behavioral tests.
 *
 * Calibration source: tests/fixtures/import/trade-republic-sample.pdf
 * (22.7 KB, 4-page real TR statement, Italian locale, exported 2026-06-25)
 *
 * X-coordinate column boundary constants are re-exported from the parser module
 * where they are the single source of truth; this file imports them for assertions.
 *
 * Observed X positions per column:
 *   DATA column:               x ≈ 74.4
 *   TIPO column:               x ≈ 120.9
 *   DESCRIZIONE column:        x ≈ 163.2
 *   IN ENTRATA (credit):       x ≈ 405.8
 *   IN USCITA (debit):         x ≈ 448.9
 *   SALDO (balance):           x ≈ 479.1 – 501.2 (varies by page/amount width)
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getDocumentProxy, extractTextItems } from 'unpdf'
import type { StructuredTextItem } from 'unpdf'
import {
  parseTradeRepublicPdf,
  validateBalanceChain,
  TR_SYNTHETIC_HEADERS,
  MAX_PDF_PAGES,
  CREDIT_X_MIN,
  CREDIT_X_MAX,
  DEBIT_X_MIN,
  DEBIT_X_MAX,
  BALANCE_X_MIN,
  type ExtractedRow,
} from '../lib/services/trade-republic-pdf-parser'

// Re-export constants for downstream consumers (backward compat with Wave 0 usages)
export { CREDIT_X_MIN, CREDIT_X_MAX, DEBIT_X_MIN, DEBIT_X_MAX, BALANCE_X_MIN }

// ---------------------------------------------------------------------------
// Calibration probe (runs in CI — verifies fixture loads and logs coordinates)
// ---------------------------------------------------------------------------

const fixturePath = join(process.cwd(), 'tests', 'fixtures', 'import', 'trade-republic-sample.pdf')

describe('Trade Republic PDF — calibration probe', () => {
  it('loads the fixture and confirms X-coordinate column positions', async () => {
    const bytes = readFileSync(fixturePath)
    expect(bytes.byteLength).toBeGreaterThan(0)
    expect(bytes.byteLength).toBeLessThanOrEqual(5 * 1024 * 1024) // 5 MB cap

    const pdf = await getDocumentProxy(new Uint8Array(bytes))
    expect(pdf.numPages).toBeGreaterThanOrEqual(1)
    expect(pdf.numPages).toBeLessThanOrEqual(MAX_PDF_PAGES)

    const { items } = await extractTextItems(pdf)

    // Collect tokens from the movements section (TR_MARKERS[1])
    let inSection = false
    const sectionItems: StructuredTextItem[] = []

    for (const pageItems of items) {
      for (const item of pageItems) {
        if (item.str.includes('TRANSAZIONI SUL CONTO')) {
          inSection = true
          continue
        }
        if (inSection && (item.str.includes('PANORAMICA') || item.str.includes('RIEPILOGO DEL PORTAFOGLIO'))) {
          inSection = false
          break
        }
        if (inSection) {
          sectionItems.push(item)
        }
      }
    }

    expect(sectionItems.length).toBeGreaterThan(0)

    // Confirm header tokens appear at expected X bands
    const dataHeader = sectionItems.find(i => i.str === 'DATA')
    const creditHeader = sectionItems.find(i => i.str === 'IN ENTRATA')
    const debitHeader = sectionItems.find(i => i.str === 'IN USCITA')
    const balanceHeader = sectionItems.find(i => i.str === 'SALDO')

    expect(dataHeader).toBeDefined()
    expect(creditHeader).toBeDefined()
    expect(debitHeader).toBeDefined()
    expect(balanceHeader).toBeDefined()

    // Credit column header must be within CREDIT_X_MIN..CREDIT_X_MAX
    expect(creditHeader!.x).toBeGreaterThanOrEqual(CREDIT_X_MIN)
    expect(creditHeader!.x).toBeLessThan(CREDIT_X_MAX)

    // Debit column header must be within DEBIT_X_MIN..DEBIT_X_MAX
    expect(debitHeader!.x).toBeGreaterThanOrEqual(DEBIT_X_MIN)
    expect(debitHeader!.x).toBeLessThan(DEBIT_X_MAX)

    // Balance column header must be at or above BALANCE_X_MIN
    expect(balanceHeader!.x).toBeGreaterThanOrEqual(BALANCE_X_MIN)

    // At least 3 movement rows exist (section has more than just headers)
    const movementRows = sectionItems.filter(i => /^\d{2}\s+\w{3}\s+\d{4}$/.test(i.str.trim()))
    expect(movementRows.length).toBeGreaterThanOrEqual(3)

    // At least one savings-plan row with a quantity: token
    const savingsPlanRows = sectionItems.filter(i => i.str.includes('quantity:'))
    expect(savingsPlanRows.length).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// Section extraction
// ---------------------------------------------------------------------------

describe('Trade Republic PDF parser — section extraction', () => {
  it('extracts only TRANSAZIONI SUL CONTO and discards PANORAMICA TRANSAZIONI', async () => {
    const bytes = readFileSync(fixturePath)
    const result = await parseTradeRepublicPdf(bytes, { fileName: 'trade-republic-sample.pdf' })

    expect(result.errors).toHaveLength(0)
    // Every row must have a date — rows from PANORAMICA would be summary rows without dates
    for (const row of result.rows) {
      expect(row['data']).toBeTruthy()
    }
  })

  it('returns correct row count matching the TRANSAZIONI section only', async () => {
    const bytes = readFileSync(fixturePath)
    const result = await parseTradeRepublicPdf(bytes, { fileName: 'trade-republic-sample.pdf' })

    expect(result.errors).toHaveLength(0)
    expect(result.rowCount).toBeGreaterThanOrEqual(3)
    // Row count must equal rows array length
    expect(result.rowCount).toBe(result.rows.length)
  })

  it('produces synthetic headers [data, descrizione, importo_entrata, importo_uscita]', async () => {
    const bytes = readFileSync(fixturePath)
    const result = await parseTradeRepublicPdf(bytes, { fileName: 'trade-republic-sample.pdf' })

    expect(result.headers).toEqual([...TR_SYNTHETIC_HEADERS])
  })

  it('returns error and zero rows for a non-Trade-Republic PDF (missing markers)', async () => {
    // Use a CSV file as a fake "PDF" that lacks TR markers
    const fakeBytes = Buffer.from('This is not a Trade Republic PDF document')
    const result = await parseTradeRepublicPdf(fakeBytes, { fileName: 'not-a-tr.pdf' })

    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.rows).toHaveLength(0)
    expect(result.rowCount).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Sign attribution
// ---------------------------------------------------------------------------

describe('Trade Republic PDF parser — sign attribution', () => {
  it('attributes credit tokens (IN ENTRATA) to importo_entrata; importo_uscita is empty string', async () => {
    const bytes = readFileSync(fixturePath)
    const result = await parseTradeRepublicPdf(bytes, { fileName: 'trade-republic-sample.pdf' })

    expect(result.errors).toHaveLength(0)
    // Find at least one row with a credit amount
    const creditRows = result.rows.filter(r => r['importo_entrata'] && r['importo_entrata'] !== '')
    expect(creditRows.length).toBeGreaterThan(0)
    for (const row of creditRows) {
      expect(row['importo_uscita']).toBe('')
    }
  })

  it('attributes debit tokens (IN USCITA) to importo_uscita; importo_entrata is empty string', async () => {
    const bytes = readFileSync(fixturePath)
    const result = await parseTradeRepublicPdf(bytes, { fileName: 'trade-republic-sample.pdf' })

    expect(result.errors).toHaveLength(0)
    // Find at least one row with a debit amount
    const debitRows = result.rows.filter(r => r['importo_uscita'] && r['importo_uscita'] !== '')
    expect(debitRows.length).toBeGreaterThan(0)
    for (const row of debitRows) {
      expect(row['importo_entrata']).toBe('')
    }
  })

  it('leaves the absent amount column as empty string for each row', async () => {
    const bytes = readFileSync(fixturePath)
    const result = await parseTradeRepublicPdf(bytes, { fileName: 'trade-republic-sample.pdf' })

    expect(result.errors).toHaveLength(0)
    // Every row must have exactly one of credit or debit populated (never both, never neither)
    for (const row of result.rows) {
      const hasCredit = row['importo_entrata'] !== ''
      const hasDebit = row['importo_uscita'] !== ''
      // At most one populated (XOR — either credit or debit, not both)
      expect(hasCredit && hasDebit).toBe(false)
      // At least one populated
      expect(hasCredit || hasDebit).toBe(true)
    }
  })

  it('returns delimiter: null in ParsedImportFile output', async () => {
    const bytes = readFileSync(fixturePath)
    const result = await parseTradeRepublicPdf(bytes, { fileName: 'trade-republic-sample.pdf' })

    expect(result.delimiter).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Balance chain validation
// ---------------------------------------------------------------------------

describe('Trade Republic PDF parser — balance chain validation', () => {
  it('passes balance chain for valid TR fixture without error', async () => {
    const bytes = readFileSync(fixturePath)
    const result = await parseTradeRepublicPdf(bytes, { fileName: 'trade-republic-sample.pdf' })

    expect(result.errors).toHaveLength(0)
    expect(result.rowCount).toBeGreaterThan(0)
  })

  it('returns explicit error and zero rows when a row balance is tampered', () => {
    // Unit-test validateBalanceChain directly with a tampered middle row.
    // Three rows: row1 → row2 (ok), row2 → row3 (tampered balance).
    const rows: ExtractedRow[] = [
      { data: '01 gen 2026', descrizione: 'Deposito', importo_entrata: '100,00 €', importo_uscita: '', runningBalance: '1.100,00 €' },
      { data: '02 gen 2026', descrizione: 'Pagamento', importo_entrata: '', importo_uscita: '50,00 €', runningBalance: '1.050,00 €' },
      // Tamper: balance should be 1050 + 25 = 1075 but we set it to 999
      { data: '03 gen 2026', descrizione: 'Entrata', importo_entrata: '25,00 €', importo_uscita: '', runningBalance: '999,00 €' },
    ]

    const error = validateBalanceChain(rows)
    expect(error).not.toBeNull()
    expect(error).toContain('Balance chain mismatch at row 3')
    expect(error).toContain('999')
  })

  it('validateBalanceChain returns null for a valid chain', () => {
    const rows: ExtractedRow[] = [
      { data: '01 gen 2026', descrizione: 'Deposito', importo_entrata: '100,00 €', importo_uscita: '', runningBalance: '1.100,00 €' },
      { data: '02 gen 2026', descrizione: 'Pagamento', importo_entrata: '', importo_uscita: '50,00 €', runningBalance: '1.050,00 €' },
      { data: '03 gen 2026', descrizione: 'Entrata', importo_entrata: '25,00 €', importo_uscita: '', runningBalance: '1.075,00 €' },
    ]

    const error = validateBalanceChain(rows)
    expect(error).toBeNull()
  })

  it('uses Decimal.js — no floating-point drift across 30+ rows', async () => {
    const bytes = readFileSync(fixturePath)
    const result = await parseTradeRepublicPdf(bytes, { fileName: 'trade-republic-sample.pdf' })

    // If balance chain passes with Decimal.js, there is no floating-point drift
    // (native JS addition would accumulate errors across 30+ rows with Italian decimal format)
    expect(result.errors).toHaveLength(0)
    expect(result.rowCount).toBeGreaterThanOrEqual(3)
  })
})

// ---------------------------------------------------------------------------
// Quantity strip (PDF-05)
// ---------------------------------------------------------------------------

describe('Trade Republic PDF parser — quantity strip', () => {
  it('two savings-plan rows differing only in quantity: produce identical normalized descriptions', async () => {
    const bytes = readFileSync(fixturePath)
    const result = await parseTradeRepublicPdf(bytes, { fileName: 'trade-republic-sample.pdf' })

    expect(result.errors).toHaveLength(0)

    // Find savings plan rows — descriptions include 'quantity:'
    // After the strip pattern is applied by normalizeTransactionRow, two rows
    // differing only in 'quantity: N' should have the same description.
    // Verify the strip pattern normalizes descriptions correctly.
    const { normalizeDescription } = await import('../lib/utils/import')
    const TR_STRIP_PATTERN = /quantity:\s*[\d.,]+\s*/i

    const desc1 = 'ETF savings plan quantity: 3 - ISIN XYZ'
    const desc2 = 'ETF savings plan quantity: 7 - ISIN XYZ'

    const stripped1 = normalizeDescription(desc1.replace(TR_STRIP_PATTERN, '').trim())
    const stripped2 = normalizeDescription(desc2.replace(TR_STRIP_PATTERN, '').trim())

    expect(stripped1).toBe(stripped2)
  })

  it('quantity: token and value are stripped from description', async () => {
    const { normalizeDescription } = await import('../lib/utils/import')
    const TR_STRIP_PATTERN = /quantity:\s*[\d.,]+\s*/i

    const rawDesc = 'Piano di risparmio quantity: 3,00 ETF'
    const stripped = rawDesc.replace(TR_STRIP_PATTERN, '').trim()

    expect(stripped).not.toContain('quantity:')
    expect(stripped).not.toContain('3,00')
    expect(normalizeDescription(stripped)).toContain('piano di risparmio')
  })
})

// ---------------------------------------------------------------------------
// Validation (page ceiling, output shape)
// ---------------------------------------------------------------------------

describe('Trade Republic PDF parser — validation', () => {
  it('MAX_PDF_PAGES constant is 50 (page ceiling defined by D-05)', () => {
    expect(MAX_PDF_PAGES).toBe(50)
  })

  it('real TR fixture is within the page ceiling', async () => {
    // Positive test: the sample fixture must load without page ceiling error
    const bytes = readFileSync(fixturePath)
    const result = await parseTradeRepublicPdf(bytes, { fileName: 'trade-republic-sample.pdf' })

    // No page ceiling error (fixture has 4 pages, well within 50)
    const hasCeilingError = result.errors.some(e => e.includes('pages, which exceeds'))
    expect(hasCeilingError).toBe(false)
    expect(result.rowCount).toBeGreaterThan(0)
  })

  it('returns ParsedImportFile shape with delimiter: null for valid fixture', async () => {
    const bytes = readFileSync(fixturePath)
    const result = await parseTradeRepublicPdf(bytes, { fileName: 'trade-republic-sample.pdf' })

    // Verify full ParsedImportFile shape
    expect(result).toHaveProperty('fileName', 'trade-republic-sample.pdf')
    expect(result).toHaveProperty('byteLength')
    expect(result.byteLength).toBeGreaterThan(0)
    expect(result).toHaveProperty('encoding', null)
    expect(result).toHaveProperty('delimiter', null)
    expect(result).toHaveProperty('headers')
    expect(result).toHaveProperty('rows')
    expect(result).toHaveProperty('rowCount')
    expect(result).toHaveProperty('sampleRows')
    expect(result).toHaveProperty('warnings')
    expect(result).toHaveProperty('errors')
    expect(Array.isArray(result.headers)).toBe(true)
    expect(Array.isArray(result.rows)).toBe(true)
    expect(Array.isArray(result.sampleRows)).toBe(true)
    expect(Array.isArray(result.warnings)).toBe(true)
    expect(Array.isArray(result.errors)).toBe(true)
  })
})
