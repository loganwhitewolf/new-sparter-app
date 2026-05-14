import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  loadContext: vi.fn(),
  createFormat: vi.fn(),
  push: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}))

vi.mock('@/lib/actions/import', () => ({
  createPrivateImportFormatAction: mocks.createFormat,
  loadImportFormatWizardContextAction: mocks.loadContext,
}))

const {
  ImportFormatWizard,
  getVisibleHeaderOptions,
  validateWizardFields,
} = await import('../components/import/import-format-wizard')
const { default: ConfigureImportFormatPage } = await import(
  '../app/(app)/import/[fileId]/configure/page'
)

const context = {
  fileId: '11111111-1111-4111-8111-111111111111',
  fileName: 'conto-personale.csv',
  detectedDelimiter: ';',
  headers: ['Data', 'Descrizione', 'Importo', 'Entrate', 'Uscite'],
  sampleRows: [
    {
      rowIndex: 1,
      values: {
        Data: '2026-01-01',
        Descrizione: 'Caffè',
        Importo: '-2,50',
        Entrate: '',
        Uscite: '2,50',
      },
    },
  ],
}

const validFields = {
  platformName: 'Banca personale',
  delimiter: ';',
  timestampColumn: 'Data',
  descriptionColumn: 'Descrizione',
  amountMode: 'single',
  amountColumn: 'Importo',
  positiveAmountColumn: '',
  negativeAmountColumn: '',
}

describe('ImportFormatWizard UI', () => {
  it('renders the private recovery form with accessible labels and no raw storage diagnostics', () => {
    const html = renderToStaticMarkup(createElement(ImportFormatWizard, { context }))

    expect(html).toContain('Configura un formato privato')
    expect(html).toContain('Nome piattaforma')
    expect(html).toContain('Colonna data')
    expect(html).toContain('Colonna descrizione')
    expect(html).toContain('Modalità importo')
    expect(html).toContain('Salva formato e riprova analisi')
    expect(html).toContain('Torna alle importazioni')
    expect(html).toContain('conto-personale.csv')
    expect(html).toContain('Data')
    expect(html).toContain('Descrizione')
    expect(html).toContain('Importo')
    expect(html).not.toContain('objectKey')
    expect(html).not.toContain('presigned')
    expect(html).not.toContain('stack trace')
    expect(html).not.toContain('https://')
  })

  it('validates required fields, duplicate columns, and unsupported amount modes before submit', () => {
    expect(validateWizardFields(validFields, context.headers)).toEqual([])

    expect(validateWizardFields({ ...validFields, platformName: '' }, context.headers)).toContain(
      'Inserisci il nome della piattaforma.',
    )
    expect(
      validateWizardFields(
        { ...validFields, timestampColumn: 'Data', descriptionColumn: 'Data' },
        context.headers,
      ),
    ).toContain('Usa colonne diverse per data, descrizione e importi.')
    expect(validateWizardFields({ ...validFields, amountMode: 'split' }, context.headers)).toContain(
      'Seleziona una modalità importo valida.',
    )
  })

  it('keeps many-header files usable by capping rendered select options', () => {
    const manyHeaders = Array.from({ length: 120 }, (_, index) => `Colonna ${index + 1}`)

    expect(getVisibleHeaderOptions(manyHeaders)).toHaveLength(80)
    expect(getVisibleHeaderOptions(manyHeaders).at(-1)).toBe('Colonna 80')

    const html = renderToStaticMarkup(
      createElement(ImportFormatWizard, { context: { ...context, headers: manyHeaders } }),
    )

    expect(html).toContain('Il file contiene molte intestazioni')
    expect(html).toContain('prime 80')
  })

  it('hides column selects when safe headers are unavailable', () => {
    const html = renderToStaticMarkup(
      createElement(ImportFormatWizard, { context: { ...context, headers: [] } }),
    )

    expect(html).toContain('Non sono disponibili intestazioni sicure')
    expect(html).not.toContain('name="timestampColumn"')
    expect(html).not.toContain('Salva formato e riprova analisi')
  })
})

describe('ConfigureImportFormatPage', () => {
  it('shows a safe retryable error when wizard context loading fails', async () => {
    mocks.loadContext.mockResolvedValueOnce({
      error: 'Impossibile leggere le intestazioni del file. Riprova.',
    })

    const element = await ConfigureImportFormatPage({
      params: Promise.resolve({ fileId: context.fileId }),
    })
    const html = renderToStaticMarkup(element)

    expect(html).toContain('Formato non configurabile')
    expect(html).toContain('Impossibile leggere le intestazioni del file. Riprova.')
    expect(html).toContain('Torna alle importazioni')
    expect(html).not.toContain('objectKey')
    expect(html).not.toContain('presigned')
  })
})
