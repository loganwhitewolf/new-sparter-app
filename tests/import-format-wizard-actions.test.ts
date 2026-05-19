import { Readable } from 'node:stream'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  getFileForUser: vi.fn(),
  readObjectBody: vi.fn(),
  parseImportFile: vi.fn(),
  revalidatePath: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
  dbTransaction: vi.fn(),
  txInsert: vi.fn(),
  txUpdate: vi.fn(),
  insertedPlatforms: [] as Record<string, unknown>[],
  insertedVersions: [] as Record<string, unknown>[],
  updatedFiles: [] as Record<string, unknown>[],
}))

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({
  refresh: vi.fn(),
  revalidatePath: mocks.revalidatePath,
}))
vi.mock('@/lib/dal/auth', () => ({ verifySession: mocks.verifySession }))
vi.mock('@/lib/dal/files', () => ({ getFileForUser: mocks.getFileForUser }))
vi.mock('@/lib/services/r2', () => ({ readObjectBody: mocks.readObjectBody }))
vi.mock('@/lib/services/import-parsers', () => ({ parseImportFile: mocks.parseImportFile }))
vi.mock('@/lib/logger', () => ({
  logger: {
    info: mocks.loggerInfo,
    warn: mocks.loggerWarn,
    error: mocks.loggerError,
  },
}))

function makeTx() {
  return {
    insert: () => ({
      values: (value: Record<string, unknown>) => {
        if ('headerSignature' in value) {
          mocks.insertedVersions.push(value)
          return {
            returning: () => Promise.resolve([{ id: 501, headerSignature: value.headerSignature }]),
          }
        }

        mocks.insertedPlatforms.push(value)
        return {
          returning: () => Promise.resolve([{ id: 301, name: value.name, slug: value.slug }]),
        }
      },
    }),
    update: () => ({
      set: (value: Record<string, unknown>) => {
        mocks.updatedFiles.push(value)
        return { where: () => Promise.resolve([{ id: 'file-1' }]) }
      },
    }),
  }
}

vi.mock('@/lib/db', () => ({
  db: {
    transaction: mocks.dbTransaction,
  },
}))

const {
  analyzeImportAction,
  confirmImportAction,
  createPrivateImportFormatAction,
  loadImportFormatWizardContextAction,
} = await import('../lib/actions/import')

const userSession = {
  userId: 'user-abc',
  email: 'user@example.test',
  subscriptionPlan: 'free' as const,
  role: 'user' as const,
}

const fileRow = {
  id: '11111111-1111-4111-8111-111111111111',
  userId: 'user-abc',
  originalName: 'general.csv',
  displayName: null,
  objectKey: 'users/user-abc/imports/11111111-1111-4111-8111-111111111111.csv',
  mimeType: 'text/csv',
  sizeBytes: 64,
  status: 'failed',
  importFormatVersionId: null,
  uploadedAt: new Date('2026-01-01T00:00:00.000Z'),
  analyzedAt: null,
  importStartedAt: null,
  importedAt: null,
  rowCount: 0,
  importedCount: 0,
  duplicateCount: 0,
  positiveTotal: '0.00',
  negativeTotal: '0.00',
  referenceStartedAt: null,
  referenceEndedAt: null,
  errorMessage: 'Formato non riconosciuto.',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
}

const parsedFile = {
  fileName: 'general.csv',
  byteLength: 64,
  encoding: 'UTF-8',
  delimiter: ',',
  headers: ['Data', 'Descrizione', 'Importo'],
  rows: [{ Data: '2026-01-01', Descrizione: 'Coffee', Importo: '-2.50' }],
  rowCount: 1,
  sampleRows: [{ Data: '2026-01-01', Descrizione: 'Coffee', Importo: '-2.50' }],
  warnings: [],
  errors: [],
}

function formData(fields: Record<string, string | undefined>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) data.append(key, value)
  }
  return data
}

function validCreateForm(overrides: Record<string, string | undefined> = {}) {
  return formData({
    fileId: '11111111-1111-4111-8111-111111111111',
    platformName: 'My Bank',
    delimiter: ',',
    timestampColumn: 'Data',
    descriptionColumn: 'Descrizione',
    amountMode: 'single',
    amountColumn: 'Importo',
    ...overrides,
  })
}

describe('import format wizard Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.insertedPlatforms.length = 0
    mocks.insertedVersions.length = 0
    mocks.updatedFiles.length = 0
    mocks.verifySession.mockResolvedValue(userSession)
    mocks.getFileForUser.mockResolvedValue(fileRow)
    mocks.readObjectBody.mockResolvedValue(Readable.from([Buffer.from('Data,Descrizione,Importo\n2026-01-01,Coffee,-2.50')]))
    mocks.parseImportFile.mockResolvedValue(parsedFile)
    mocks.dbTransaction.mockImplementation((callback) => callback(makeTx()))
  })

  it('loads a safe header context for the session-owned failed file', async () => {
    const result = await loadImportFormatWizardContextAction(
      formData({ fileId: '11111111-1111-4111-8111-111111111111' }),
    )

    expect(result.error).toBeNull()
    expect(result.data).toEqual({
      fileId: '11111111-1111-4111-8111-111111111111',
      fileName: 'general.csv',
      detectedDelimiter: ',',
      headers: ['Data', 'Descrizione', 'Importo'],
      sampleRows: [
        {
          rowIndex: 1,
          values: { Data: '2026-01-01', Descrizione: 'Coffee', Importo: '-2.50' },
        },
      ],
    })
    expect(mocks.getFileForUser).toHaveBeenCalledWith({
      userId: 'user-abc',
      fileId: '11111111-1111-4111-8111-111111111111',
    })
    expect(mocks.loggerInfo).toHaveBeenCalledWith(expect.objectContaining({
      event: 'import_format_wizard.context_loaded',
      userId: 'user-abc',
      fileId: '11111111-1111-4111-8111-111111111111',
    }))
    expect(JSON.stringify(mocks.loggerInfo.mock.calls)).not.toContain(fileRow.objectKey)
  })

  it('creates private platform/version rows and makes the file retry-ready', async () => {
    const result = await createPrivateImportFormatAction({ error: null }, validCreateForm())

    expect(result.error).toBeNull()
    expect(result.data).toMatchObject({
      fileId: '11111111-1111-4111-8111-111111111111',
      platformId: 301,
      platformName: 'My Bank',
      formatVersionId: 501,
      headerSignature: 'Data,Descrizione,Importo',
    })
    expect(mocks.insertedPlatforms[0]).toMatchObject({
      ownerUserId: 'user-abc',
      visibility: 'private',
      reviewStatus: 'draft',
      name: 'My Bank',
      country: 'IT',
      delimiter: ',',
      timestampColumn: 'Data',
      descriptionColumn: 'Descrizione',
      amountType: 'single',
      amountColumn: 'Importo',
      positiveAmountColumn: null,
      negativeAmountColumn: null,
      isActive: true,
    })
    expect(mocks.insertedVersions[0]).toMatchObject({
      platformId: 301,
      ownerUserId: 'user-abc',
      visibility: 'private',
      reviewStatus: 'draft',
      version: 1,
      headerSignature: 'Data,Descrizione,Importo',
      isActive: true,
    })
    expect(mocks.updatedFiles[0]).toMatchObject({
      status: 'uploaded',
      importFormatVersionId: 501,
      errorMessage: null,
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/import')
    expect(mocks.loggerInfo).toHaveBeenCalledWith(expect.objectContaining({
      event: 'import_format_wizard.created',
      userId: 'user-abc',
      fileId: '11111111-1111-4111-8111-111111111111',
      platformId: 301,
      formatVersionId: 501,
    }))
    expect(JSON.stringify(mocks.loggerInfo.mock.calls)).not.toContain(fileRow.objectKey)
  })

  it('rejects invalid column selections without creating private rows', async () => {
    const result = await createPrivateImportFormatAction(
      { error: null },
      validCreateForm({ amountColumn: 'Missing Column' }),
    )

    expect(result).toEqual({ error: 'Una o più colonne selezionate non esistono nel file caricato.' })
    expect(mocks.dbTransaction).not.toHaveBeenCalled()
    expect(mocks.loggerWarn).toHaveBeenCalledWith(expect.objectContaining({
      event: 'import_format_wizard.rejected',
      code: 'column_not_found',
    }))
  })

  it('rejects malformed amount modes before session verification or writes', async () => {
    const result = await createPrivateImportFormatAction(
      { error: null },
      validCreateForm({ amountMode: 'separate', amountColumn: 'Importo' }),
    )

    expect(result).toEqual({ error: 'Controlla i campi del formato e riprova.' })
    expect(mocks.verifySession).not.toHaveBeenCalled()
    expect(mocks.dbTransaction).not.toHaveBeenCalled()
  })

  it('rejects missing or cross-user files without leaking object keys', async () => {
    mocks.getFileForUser.mockResolvedValueOnce(null)

    const result = await createPrivateImportFormatAction({ error: null }, validCreateForm())

    expect(result).toEqual({ error: 'Importazione non trovata o accesso negato.' })
    expect(mocks.readObjectBody).not.toHaveBeenCalled()
    expect(mocks.dbTransaction).not.toHaveBeenCalled()
    expect(JSON.stringify(result)).not.toContain('users/user-abc/imports')
  })

  it('redacts parser/read diagnostics from returned errors and logs', async () => {
    mocks.parseImportFile.mockRejectedValueOnce(
      new Error('Could not parse https://storage.example/private.csv stack trace at secret line'),
    )

    const result = await loadImportFormatWizardContextAction(
      formData({ fileId: '11111111-1111-4111-8111-111111111111' }),
    )

    expect(result).toEqual({ error: 'Impossibile leggere le intestazioni del file. Riprova.' })
    const serializedLogs = JSON.stringify([
      mocks.loggerInfo.mock.calls,
      mocks.loggerWarn.mock.calls,
      mocks.loggerError.mock.calls,
    ])
    expect(serializedLogs).not.toContain('https://storage.example')
    expect(serializedLogs).not.toContain('secret line')
    expect(serializedLogs).not.toContain(fileRow.objectKey)
  })

  it('returns a safe save-format error while logging the underlying database error', async () => {
    const dbError = new Error('duplicate key value violates unique constraint "platform_slug_unique"')
    mocks.dbTransaction.mockRejectedValueOnce(dbError)

    const result = await createPrivateImportFormatAction({ error: null }, validCreateForm())

    expect(result).toEqual({ error: 'Impossibile salvare il formato. Riprova.' })
    expect(mocks.loggerError).toHaveBeenCalledWith(expect.objectContaining({
      event: 'import_format_wizard.retry_failed',
      userId: 'user-abc',
      fileId: '11111111-1111-4111-8111-111111111111',
      code: 'db_write_failed',
      err: dbError,
    }))
  })

  it('maps malformed selected format ids to localized action errors before auth', async () => {
    const analyzeResult = await analyzeImportAction(
      formData({
        fileId: '11111111-1111-4111-8111-111111111111',
        selectedFormatVersionId: 'not-a-number',
      }),
    )
    const confirmResult = await confirmImportAction(
      formData({
        fileId: '11111111-1111-4111-8111-111111111111',
        selectedFormatVersionId: 'not-a-number',
      }),
    )

    expect(analyzeResult).toEqual({ error: 'Importazione non valida.' })
    expect(confirmResult).toEqual({ error: 'Importazione non valida.' })
    expect(mocks.verifySession).not.toHaveBeenCalled()
  })

  it('maps unauthorized sessions to a localized action error', async () => {
    mocks.verifySession.mockRejectedValueOnce(new Error('missing session'))

    const result = await loadImportFormatWizardContextAction(
      formData({ fileId: '11111111-1111-4111-8111-111111111111' }),
    )

    expect(result).toEqual({ error: 'Sessione scaduta. Accedi di nuovo per configurare il formato.' })
    expect(mocks.getFileForUser).not.toHaveBeenCalled()
  })
})
