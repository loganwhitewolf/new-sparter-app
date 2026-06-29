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
  txExecute: vi.fn(),
  insertedPlatforms: [] as Record<string, unknown>[],
  insertedVersions: [] as Record<string, unknown>[],
  updatedFiles: [] as Record<string, unknown>[],
  // selectWhere: controls what SELECT...WHERE returns in createPrivateRows.
  // Default (mockResolvedValue): [] — no duplicates found, TOCTOU fails (platform gone).
  // Per-test overrides via mockResolvedValueOnce:
  //   attach branch: [{ id: 301, name: 'Fineco', slug: 'fineco' }]
  //   duplicate name check: [{ id: 99 }]
  selectWhere: vi.fn(),
  // listAttachablePlatforms: mock for the DAL function used by listAttachablePlatformsAction (Plan 59-02)
  listAttachablePlatforms: vi.fn(),
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
vi.mock('@/lib/dal/import-formats', () => ({
  listAttachablePlatforms: mocks.listAttachablePlatforms,
  listPdfImportPlatformNames: vi.fn().mockResolvedValue([]),
}))

function makeTx() {
  return {
    execute: mocks.txExecute,
    // select: used by createPrivateRows for the duplicate-name guard (create branch) and the
    // TOCTOU platform SELECT (attach branch). mocks.selectWhere controls the resolved value per
    // call — use mockResolvedValueOnce in tests that need specific rows; default is [].
    select: (_fields: unknown) => ({
      from: (_table: unknown) => ({
        where: mocks.selectWhere,
      }),
    }),
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
  listAttachablePlatformsAction,
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
    // Default: SELECT returns [] — no duplicate found (create branch), platform not found (attach TOCTOU).
    // Override per-test with mockResolvedValueOnce.
    mocks.selectWhere.mockResolvedValue([])
    mocks.listAttachablePlatforms.mockResolvedValue([
      { id: 1, name: 'Fineco', slug: 'fineco', reviewStatus: 'approved' },
      { id: 2, name: 'Revolut', slug: 'revolut', reviewStatus: 'approved' },
    ])
    mocks.verifySession.mockResolvedValue(userSession)
    mocks.getFileForUser.mockResolvedValue(fileRow)
    mocks.readObjectBody.mockResolvedValue(Readable.from([Buffer.from('Data,Descrizione,Importo\n2026-01-01,Coffee,-2.50')]))
    mocks.parseImportFile.mockResolvedValue(parsedFile)
    mocks.txExecute.mockResolvedValue([])
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
    expect(mocks.txExecute).toHaveBeenCalledTimes(1)
    expect(mocks.insertedPlatforms[0]).not.toHaveProperty('id')
    // platform is never user-owned (ADR 0015): proposedByUserId is provenance, no visibility column
    expect(mocks.insertedPlatforms[0]).toMatchObject({
      proposedByUserId: 'user-abc',
      reviewStatus: 'pending',
      name: 'My Bank',
      country: 'IT',
      isActive: true,
    })
    expect(mocks.insertedPlatforms[0]).not.toHaveProperty('visibility')
    expect(mocks.insertedPlatforms[0]).not.toHaveProperty('delimiter')
    expect(mocks.insertedPlatforms[0]).not.toHaveProperty('timestampColumn')
    expect(mocks.insertedPlatforms[0]).not.toHaveProperty('descriptionColumn')
    expect(mocks.insertedPlatforms[0]).not.toHaveProperty('amountType')
    // importFormatVersion holds the full parsing contract (ADR 0013); keeps ownerUserId/visibility (Discretion A3)
    expect(mocks.insertedVersions[0]).toMatchObject({
      platformId: 301,
      ownerUserId: 'user-abc',
      visibility: 'private',
      reviewStatus: 'pending',
      version: 1,
      headerSignature: 'Data,Descrizione,Importo',
      isActive: true,
      delimiter: ',',
      timestampColumn: 'Data',
      descriptionColumn: 'Descrizione',
      amountType: 'single',
      amountColumn: 'Importo',
      positiveAmountColumn: null,
      negativeAmountColumn: null,
      multiplyBy: 1,
      dateFormat: null,
      dateReplace: false,
      decimalReplace: false,
      descriptionStripPattern: null,
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

  // Plan 59-02: attach branch tests
  it('attach branch: skips platform insert and syncPlatformIdSequence, inserts version with existingPlatformId', async () => {
    // Simulate: platform 301 is active and visible to this user (TOCTOU SELECT returns it)
    mocks.selectWhere.mockResolvedValueOnce([{ id: 301, name: 'Fineco', slug: 'fineco' }])

    const result = await createPrivateImportFormatAction(
      { error: null },
      validCreateForm({ existingPlatformId: '301' }),
    )

    expect(result.error).toBeNull()
    expect(result.data?.platformId).toBe(301)
    // No platform insert — the attach branch reuses the existing platform
    expect(mocks.insertedPlatforms).toHaveLength(0)
    // syncPlatformIdSequence must NOT run in the attach branch
    expect(mocks.txExecute).not.toHaveBeenCalled()
    // importFormatVersion is inserted with platformId = existingPlatformId (301)
    expect(mocks.insertedVersions[0]).toMatchObject({
      platformId: 301,
      ownerUserId: 'user-abc',
      visibility: 'private',
      reviewStatus: 'pending',
    })
  })

  it('attach branch: throws db_write_failed when platform no longer exists (TOCTOU guard)', async () => {
    // selectWhere defaults to [] — TOCTOU SELECT finds no active/visible platform with that id

    const result = await createPrivateImportFormatAction(
      { error: null },
      validCreateForm({ existingPlatformId: '301' }),
    )

    expect(result).toEqual({ error: 'Impossibile salvare il formato. Riprova.' })
    expect(mocks.insertedPlatforms).toHaveLength(0)
    expect(mocks.insertedVersions).toHaveLength(0)
  })

  it('attach branch: rejects a forged id for another user\'s pending platform (IDOR fix)', async () => {
    // TOCTOU SELECT returns [] — the platform exists but is pending and owned by another user,
    // so the visibility WHERE clause filters it out. The service must throw db_write_failed.
    // selectWhere defaults to [] — no action needed.

    const result = await createPrivateImportFormatAction(
      { error: null },
      validCreateForm({ existingPlatformId: '999' }),
    )

    expect(result).toEqual({ error: 'Impossibile salvare il formato. Riprova.' })
    expect(mocks.insertedPlatforms).toHaveLength(0)
    expect(mocks.insertedVersions).toHaveLength(0)
  })

  it('create branch: rejects a platform name that duplicates an existing approved platform', async () => {
    // Duplicate check SELECT returns a row — a platform with the same name is already approved.
    mocks.selectWhere.mockResolvedValueOnce([{ id: 42 }])

    const result = await createPrivateImportFormatAction(
      { error: null },
      validCreateForm({ platformName: 'Fineco' }),
    )

    expect(result).toEqual({
      error: 'Esiste già una piattaforma approvata con questo nome. Selezionala dal passo 1 oppure usa un nome diverso.',
    })
    expect(mocks.insertedPlatforms).toHaveLength(0)
    expect(mocks.insertedVersions).toHaveLength(0)
    expect(mocks.txExecute).not.toHaveBeenCalled()
  })

  // Plan 59-02: listAttachablePlatformsAction tests
  it('listAttachablePlatformsAction returns the attachable platform list for authenticated session', async () => {
    const result = await listAttachablePlatformsAction()

    expect(result.error).toBeNull()
    expect(result.data).toEqual([
      { id: 1, name: 'Fineco', slug: 'fineco', reviewStatus: 'approved' },
      { id: 2, name: 'Revolut', slug: 'revolut', reviewStatus: 'approved' },
    ])
    expect(mocks.listAttachablePlatforms).toHaveBeenCalledWith('user-abc')
  })

  it('listAttachablePlatformsAction returns session-expired error when verifySession rejects', async () => {
    mocks.verifySession.mockRejectedValueOnce(new Error('missing session'))

    const result = await listAttachablePlatformsAction()

    expect(result.error).toBe('Sessione scaduta. Accedi di nuovo per configurare il formato.')
    expect(mocks.listAttachablePlatforms).not.toHaveBeenCalled()
  })

  it('listAttachablePlatformsAction returns error when DAL throws', async () => {
    mocks.listAttachablePlatforms.mockRejectedValueOnce(new Error('DB connection failed'))

    const result = await listAttachablePlatformsAction()

    expect(result.error).toBe('Impossibile caricare le piattaforme. Riprova.')
  })

  it('create branch regression: still inserts pending platform and calls syncPlatformIdSequence once', async () => {
    const result = await createPrivateImportFormatAction({ error: null }, validCreateForm())

    expect(result.error).toBeNull()
    expect(mocks.txExecute).toHaveBeenCalledTimes(1)
    expect(mocks.insertedPlatforms[0]).toMatchObject({
      proposedByUserId: 'user-abc',
      reviewStatus: 'pending',
      name: 'My Bank',
      country: 'IT',
      isActive: true,
    })
    expect(mocks.insertedVersions[0]).toMatchObject({
      platformId: 301,
    })
  })
})
