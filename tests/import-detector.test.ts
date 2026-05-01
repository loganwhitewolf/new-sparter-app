import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const fixturePath = (name: string) => join(process.cwd(), 'tests', 'fixtures', 'import', name)

const expectedFixtureHeaders = [
  ['general.csv', 'timestamp,description,amount'],
  ['satispay.csv', 'Data,Nome,Importo'],
  ['intesa-sp.csv', 'Data,Operazione,Importo'],
  ['intesa-sp-carta-credito.csv', 'Data operazione,Descrizione,Addebiti'],
  ['revolut.csv', 'Completed Date,Description,Amount'],
  ['fineco.csv', 'Data,Descrizione_Completa,Entrate,Uscite'],
] as const

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

  it.todo('detects General CSV by timestamp, description, and amount headers')
  it.todo('detects Satispay CSV by Data, Nome, and Importo headers')
  it.todo('detects Intesa SP CSV by Data, Operazione, and Importo headers')
  it.todo('detects Intesa SP credit-card CSV by Data operazione, Descrizione, and Addebiti headers')
  it.todo('detects Revolut CSV by Completed Date, Description, and Amount headers')
  it.todo('detects Fineco CSV by separate Entrate and Uscite amount columns')
  it.todo('returns a structured non-secret error when no seeded format matches')
})
