import { describe, expect, it, vi, beforeEach } from 'vitest'
import { parseImportFile } from '../lib/services/import-parsers'

// ---------------------------------------------------------------------------
// Mock read-excel-file/node so tests run without a real XLSX file on disk.
// ---------------------------------------------------------------------------
const mockReadSheet = vi.fn()
vi.mock('read-excel-file/node', () => ({ readSheet: (...args: unknown[]) => mockReadSheet(...args) }))

// A minimal Buffer that satisfies the byte-length guard (non-empty, under max).
const FAKE_XLSX_BYTES = Buffer.alloc(16, 0)

describe('parseXlsx — leading junk-row skipping', () => {
  beforeEach(() => {
    mockReadSheet.mockReset()
  })

  it('uses first row as header when no leading junk rows are present', async () => {
    mockReadSheet.mockResolvedValue([
      ['Data', 'Descrizione', 'Importo'],
      ['2024-01-01', 'Supermercato', '-12.34'],
      ['2024-01-02', 'Caffè', '-1.50'],
    ])

    const result = await parseImportFile(FAKE_XLSX_BYTES, { fileName: 'test.xlsx' })

    expect(result.headers).toEqual(['Data', 'Descrizione', 'Importo'])
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toEqual({ Data: '2024-01-01', Descrizione: 'Supermercato', Importo: '-12.34' })
    expect(result.warnings).toEqual([])
    expect(result.errors).toEqual([])
  })

  it('skips a single leading junk row and emits a warning', async () => {
    mockReadSheet.mockResolvedValue([
      ['Estratto conto al 31/01/2024', null, null],
      ['Data', 'Descrizione', 'Importo'],
      ['2024-01-01', 'Supermercato', '-12.34'],
    ])

    const result = await parseImportFile(FAKE_XLSX_BYTES, { fileName: 'test.xlsx' })

    expect(result.headers).toEqual(['Data', 'Descrizione', 'Importo'])
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toEqual({ Data: '2024-01-01', Descrizione: 'Supermercato', Importo: '-12.34' })
    expect(result.warnings).toContain('Skipped 1 leading row(s) before the header row in the spreadsheet.')
    expect(result.errors).toEqual([])
  })

  it('skips multiple leading junk rows and emits a single warning', async () => {
    mockReadSheet.mockResolvedValue([
      ['Banca XYZ', null, null, null],
      [null, null, null, null],
      ['Periodo: gennaio 2024', null, null, null],
      ['Data', 'Descrizione', 'Entrate', 'Uscite'],
      ['2024-01-01', 'Supermercato', null, '12.34'],
      ['2024-01-02', 'Stipendio', '2500.00', null],
    ])

    const result = await parseImportFile(FAKE_XLSX_BYTES, { fileName: 'test.xlsx' })

    expect(result.headers).toEqual(['Data', 'Descrizione', 'Entrate', 'Uscite'])
    expect(result.rows).toHaveLength(2)
    expect(result.warnings).toContain('Skipped 3 leading row(s) before the header row in the spreadsheet.')
    expect(result.errors).toEqual([])
  })

  it('skips fully empty leading rows (null cells only)', async () => {
    mockReadSheet.mockResolvedValue([
      [null, null, null],
      ['Data', 'Descrizione', 'Importo'],
      ['2024-01-01', 'Supermercato', '-12.34'],
    ])

    const result = await parseImportFile(FAKE_XLSX_BYTES, { fileName: 'test.xlsx' })

    expect(result.headers).toEqual(['Data', 'Descrizione', 'Importo'])
    expect(result.rows).toHaveLength(1)
    expect(result.warnings).toContain('Skipped 1 leading row(s) before the header row in the spreadsheet.')
  })

  it('returns no-header error for a completely empty sheet', async () => {
    mockReadSheet.mockResolvedValue([])

    const result = await parseImportFile(FAKE_XLSX_BYTES, { fileName: 'test.xlsx' })

    expect(result.errors).toContain('Spreadsheet has no header row.')
  })

  it('handles a row with a single junk cell followed by a valid header', async () => {
    mockReadSheet.mockResolvedValue([
      ['Report',  null],
      ['Data', 'Descrizione', 'Importo'],
      ['2024-01-01', 'Supermercato', '-12.34'],
    ])

    const result = await parseImportFile(FAKE_XLSX_BYTES, { fileName: 'test.xlsx' })

    // "Report" + null = only 1 non-empty cell → junk row skipped.
    expect(result.headers).toEqual(['Data', 'Descrizione', 'Importo'])
    expect(result.rows).toHaveLength(1)
    expect(result.warnings).toContain('Skipped 1 leading row(s) before the header row in the spreadsheet.')
  })
})
