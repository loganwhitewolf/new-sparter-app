import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  computeDescriptionHash,
  computeTransactionHash,
  normalizeDescription,
  normalizeTransactionRow,
  parseBankDate,
  parseItalianAmount,
} from '../lib/utils/import'

const fixturePath = (name: string) => join(process.cwd(), 'tests', 'fixtures', 'import', name)

describe('import utility fixture contracts', () => {
  it('keeps duplicate General rows available for duplicate preview tests', () => {
    const csv = readFileSync(fixturePath('general.csv'), 'utf8')
    expect(csv.match(/Coop Torino,-12\.34/g)).toHaveLength(2)
  })

  it('keeps decimal-comma Intesa rows available for amount parsing tests', () => {
    const csv = readFileSync(fixturePath('intesa-sp.csv'), 'utf8')
    expect(csv).toContain('"-12,34"')
    expect(csv).toContain('"1.250,00"')
  })

  it('keeps separate Fineco inflow/outflow columns available for amount parsing tests', () => {
    const csv = readFileSync(fixturePath('fineco.csv'), 'utf8')
    expect(csv).toContain('Entrate,Uscite')
    expect(csv).toContain('ACCREDITO STIPENDIO,2500.00,')
    expect(csv).toContain('PAGAMENTO CARTA SUPERMERCATO,,12.34')
  })

  it('normalizes descriptions by trimming, collapsing spaces, lowercasing, and preserving meaningful accents', () => {
    expect(normalizeDescription('  Caffè   Torino\tCentro  ')).toBe('caffè torino centro')
  })

  it('hashes normalized transaction identity from user, platform, date, amount, and description', () => {
    const first = computeTransactionHash({
      userId: 'user-1',
      platformId: 4,
      occurredAt: parseBankDate('02-01-2026')!,
      amount: parseItalianAmount(' -12,340 ')!,
      description: ' PAGAMENTO   POS SUPERMERCATO ',
    })
    const second = computeTransactionHash({
      userId: 'user-1',
      platformId: 4,
      occurredAt: parseBankDate('2026-01-02')!,
      amount: '-12.34',
      description: 'pagamento pos supermercato',
    })

    expect(first).toMatch(/^[a-f0-9]{64}$/)
    expect(first).toBe(second)
  })

  it('hashes normalized descriptions consistently for expense aggregation', () => {
    expect(computeDescriptionHash(' Coop   Torino ')).toBe(computeDescriptionHash('coop torino'))
    expect(computeDescriptionHash('Caffè Torino')).not.toBe(computeDescriptionHash('Caffe Torino'))
  })

  it('parses ISO, Italian numeric, and Italian month-name dates into UTC-safe Date values', () => {
    expect(parseBankDate('2026-01-02T10:30:00.000Z')?.toISOString()).toBe('2026-01-02T10:30:00.000Z')
    expect(parseBankDate('02/01/2026')?.toISOString()).toBe('2026-01-02T00:00:00.000Z')
    expect(parseBankDate('02 gen 2026. 10:30:00')?.toISOString()).toBe('2026-01-02T10:30:00.000Z')
  })

  it('parses decimal comma, thousands separators, and signed single amount columns', () => {
    expect(parseItalianAmount('"-12,34"')).toBe('-12.34')
    expect(parseItalianAmount('"1.250,00"')).toBe('1250.00')
    expect(parseItalianAmount('2,500.50')).toBe('2500.50')
  })

  it('applies Intesa credit-card charge polarity by multiplying Addebiti by -1', () => {
    const normalized = normalizeTransactionRow(
      { 'Data operazione': '02/01/2026', Descrizione: 'AMAZON MARKETPLACE', Addebiti: '12,34' },
      {
        platformId: 5,
        timestampColumn: 'Data operazione',
        descriptionColumn: 'Descrizione',
        amountType: 'single',
        amountColumn: 'Addebiti',
        positiveAmountColumn: null,
        negativeAmountColumn: null,
        multiplyBy: -1,
      },
      { userId: 'user-1', rowIndex: 1 },
    )

    expect(normalized.valid).toBe(true)
    expect(normalized.amount).toBe('-12.34')
    expect(normalized.transactionHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('parses Fineco separate Entrate/Uscite columns with positive income and negative outflow', () => {
    const income = normalizeTransactionRow(
      { Data: '03/01/2026', Descrizione_Completa: 'ACCREDITO STIPENDIO', Entrate: '2500.00', Uscite: '' },
      {
        platformId: 7,
        timestampColumn: 'Data',
        descriptionColumn: 'Descrizione_Completa',
        amountType: 'separate',
        amountColumn: null,
        positiveAmountColumn: 'Entrate',
        negativeAmountColumn: 'Uscite',
        multiplyBy: 1,
      },
      { userId: 'user-1', rowIndex: 2 },
    )
    const outflow = normalizeTransactionRow(
      { Data: '02/01/2026', Descrizione_Completa: 'PAGAMENTO CARTA SUPERMERCATO', Entrate: '', Uscite: '12.34' },
      {
        platformId: 7,
        timestampColumn: 'Data',
        descriptionColumn: 'Descrizione_Completa',
        amountType: 'separate',
        amountColumn: null,
        positiveAmountColumn: 'Entrate',
        negativeAmountColumn: 'Uscite',
        multiplyBy: 1,
      },
      { userId: 'user-1', rowIndex: 1 },
    )

    expect(income.amount).toBe('2500.00')
    expect(outflow.amount).toBe('-12.34')
  })
})
