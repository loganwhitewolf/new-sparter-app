/**
 * Trade Republic PDF parser — calibration probe + Wave 2 test scaffold.
 *
 * Calibration source: tests/fixtures/import/trade-republic-sample.pdf
 * (22.7 KB, 4-page real TR statement, Italian locale, exported 2026-06-25)
 *
 * X-coordinate column boundary constants below are derived from logged token
 * positions in the TRANSAZIONI SUL CONTO section of the fixture above.
 * Column header positions confirmed at y=684.1 (page 2) and y=494.8 (page 1).
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

// ---------------------------------------------------------------------------
// X-coordinate column boundary constants
// Calibrated from: tests/fixtures/import/trade-republic-sample.pdf
// ---------------------------------------------------------------------------

/**
 * Left edge of the IN ENTRATA (credit) column.
 * Observed: header "IN ENTRATA" at x=405.8; values at x≈405.8.
 */
export const CREDIT_X_MIN = 395

/**
 * Right edge of the IN ENTRATA (credit) column (exclusive).
 * The IN USCITA header starts at x=448.9, so credit ends before that.
 */
export const CREDIT_X_MAX = 440

/**
 * Left edge of the IN USCITA (debit) column.
 * Observed: header "IN USCITA" at x=448.9; values at x≈448.9.
 */
export const DEBIT_X_MIN = 440

/**
 * Right edge of the IN USCITA (debit) column (exclusive).
 * Balance values start at x≈479.1, so debit ends before that.
 */
export const DEBIT_X_MAX = 470

/**
 * Left edge of the SALDO (running balance) column.
 * Observed: header "SALDO" at x=501.2; values at x≈479.1–483.4
 * (amount width causes left edge to vary — use a lower bound).
 */
export const BALANCE_X_MIN = 470

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
    expect(pdf.numPages).toBeLessThanOrEqual(50) // page ceiling

    const { items } = await extractTextItems(pdf)

    // Collect tokens from TRANSAZIONI SUL CONTO section
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
// Wave 2 behavioral placeholders (RED targets — implement in next wave)
// ---------------------------------------------------------------------------

describe('Trade Republic PDF parser — section extraction', () => {
  it.todo('extracts only TRANSAZIONI SUL CONTO and discards PANORAMICA TRANSAZIONI')
  it.todo('returns correct row count matching the TRANSAZIONI section only')
  it.todo('produces synthetic headers [data, descrizione, importo_entrata, importo_uscita]')
})

describe('Trade Republic PDF parser — sign attribution', () => {
  it.todo('attributes tokens at CREDIT_X_MIN..CREDIT_X_MAX to importo_entrata')
  it.todo('attributes tokens at DEBIT_X_MIN..DEBIT_X_MAX to importo_uscita')
  it.todo('leaves the absent column as empty string for each row')
})

describe('Trade Republic PDF parser — balance chain validation', () => {
  it.todo('passes balance chain for valid TR fixture without error')
  it.todo('throws explicit error when a row is tampered to break the chain')
  it.todo('uses Decimal.js — no floating-point drift across 30+ rows')
})

describe('Trade Republic PDF parser — quantity strip', () => {
  it.todo('quantity: token and value stripped from description before hash computation')
  it.todo('two savings-plan rows differing only in quantity: produce identical descriptionHash')
})

describe('Trade Republic PDF parser — validation', () => {
  it.todo('throws if PDF exceeds 50 pages')
  it.todo('returns ParsedImportFile shape with delimiter: null')
})
