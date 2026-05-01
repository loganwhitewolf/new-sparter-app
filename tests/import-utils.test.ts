import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

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

  it.todo('normalizes descriptions by trimming, collapsing spaces, lowercasing, and preserving meaningful accents')
  it.todo('hashes normalized transaction identity from user, platform, date, amount, and description')
  it.todo('hashes normalized descriptions consistently for expense aggregation')
  it.todo('parses ISO, Italian numeric, and Italian month-name dates into UTC-safe Date values')
  it.todo('parses decimal comma, thousands separators, and signed single amount columns')
  it.todo('applies Intesa credit-card charge polarity by multiplying Addebiti by -1')
  it.todo('parses Fineco separate Entrate/Uscite columns with positive income and negative outflow')
})
