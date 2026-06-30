import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  loadContext: vi.fn(),
  createFormat: vi.fn(),
  completeOnboardingImport: vi.fn(),
  listPlatforms: vi.fn().mockResolvedValue({ error: null, data: [] }),
  push: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}))

vi.mock('@/lib/actions/import', () => ({
  completeOnboardingPrivateImportAction: mocks.completeOnboardingImport,
  createPrivateImportFormatAction: mocks.createFormat,
  listAttachablePlatformsAction: mocks.listPlatforms,
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

const samplePlatforms = [
  { id: 1, name: 'Fineco', slug: 'fineco', reviewStatus: 'approved' },
  { id: 2, name: 'Intesa SP', slug: 'intesa-sp', reviewStatus: 'approved' },
]

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
    expect(html).toContain('Piattaforma')
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

  it('uses onboarding import copy and keeps the back link inside onboarding', () => {
    const html = renderToStaticMarkup(createElement(ImportFormatWizard, { context, from: 'onboarding' }))

    expect(html).toContain('Salva formato e importa')
    expect(html).toContain('href="/onboarding"')
    expect(html).toContain('Torna all&#x27;onboarding')
    expect(html).not.toContain('Salva formato e riprova analisi')
    expect(html).not.toContain('Torna alle importazioni')
  })

  it('renders step 1 platform list with existing platforms and create-new entry', () => {
    const html = renderToStaticMarkup(
      createElement(ImportFormatWizard, { context, attachablePlatforms: samplePlatforms }),
    )

    expect(html).toContain('Fineco')
    expect(html).toContain('Intesa SP')
    expect(html).toContain('Crea una nuova platform')
    // Step 1 is shown; column form (step 2) is not rendered yet
    expect(html).not.toContain('name="timestampColumn"')
  })

  it('skips step 1 and renders column form directly when attachablePlatforms is empty', () => {
    const html = renderToStaticMarkup(
      createElement(ImportFormatWizard, { context, attachablePlatforms: [] }),
    )

    expect(html).toContain('Modalità importo')
    expect(html).not.toContain('Crea una nuova platform')
  })

  it('initial step-1 render has Continua button disabled when no platform is selected', () => {
    const html = renderToStaticMarkup(
      createElement(ImportFormatWizard, { context, attachablePlatforms: samplePlatforms }),
    )

    // step 1 is shown
    expect(html).toContain('Crea una nuova platform')
    // Continua button is disabled (selectedPlatformId=null, step1CanAdvance=false)
    expect(html).toContain('disabled')
  })

  it('no false-positive duplicate hint when attachablePlatforms is empty', () => {
    const html = renderToStaticMarkup(
      createElement(ImportFormatWizard, { context, attachablePlatforms: [] }),
    )

    expect(html).not.toContain('Esiste già una piattaforma con questo nome')
  })

  it('validateWizardFields accepts a non-empty platformName without errors (orthogonal to client duplicate check)', () => {
    const errors = validateWizardFields(
      { ...validFields, platformName: 'Fineco' },
      context.headers,
    )
    expect(errors).toEqual([])
  })
})

describe('ConfigureImportFormatPage', () => {
  it('shows a safe retryable error when wizard context loading fails', async () => {
    mocks.loadContext.mockResolvedValueOnce({
      error: 'Impossibile leggere le intestazioni del file. Riprova.',
    })
    // listAttachablePlatformsAction is not reached when context load fails (early return)
    // but the mock is registered globally to prevent accidental unmocked calls
    mocks.listPlatforms.mockResolvedValueOnce({ error: null, data: [] })

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
