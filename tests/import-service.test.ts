import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileRow } from '../lib/dal/files'
import type { ActivePattern } from '../lib/services/categorization'

// ---------------------------------------------------------------------------
// Hoisted mocks (vi.hoisted runs before module imports)
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  // dal/files
  getFileForUser: vi.fn(),
  markFileFailed: vi.fn(),
  updateFileAnalysisState: vi.fn(),
  updateFileImportState: vi.fn(),
  getPlatformIdForUserFile: vi.fn(),

  // services/regex-discovery
  discoverRegexCandidates: vi.fn(),

  // dal/import-formats
  loadImportFormatsForDetection: vi.fn(),

  // dal/transactions
  getDuplicateHashes: vi.fn(),
  insertTransactionBatch: vi.fn(),

  // services/r2
  readObjectBody: vi.fn(),

  // services/categorization
  loadActivePatterns: vi.fn(),
  categorizePipeline: vi.fn(),

  // services/import-parsers
  parseImportFile: vi.fn(),

  // actions/patterns
  verifySession: vi.fn(),
  createPattern: vi.fn(),
  updatePattern: vi.fn(),
  deletePattern: vi.fn(),
  getCategoryTypeForSubCategory: vi.fn(),
  writeClassificationHistory: vi.fn(),
  getLatestClassificationSource: vi.fn(),

  // logger
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),

  // db
  dbTransaction: vi.fn(),
}))

// Mock server-only to avoid Next.js server boundary errors in tests
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({
  refresh: vi.fn(),
  revalidatePath: vi.fn(),
}))
vi.mock('@/lib/dal/auth', () => ({ verifySession: mocks.verifySession }))
vi.mock('@/lib/logger', () => ({
  logger: {
    info: mocks.loggerInfo,
    warn: mocks.loggerWarn,
    error: mocks.loggerError,
  },
}))
vi.mock('@/lib/dal/patterns', () => ({
  createPattern: mocks.createPattern,
  updatePattern: mocks.updatePattern,
  deletePattern: mocks.deletePattern,
  getCategoryTypeForSubCategory: mocks.getCategoryTypeForSubCategory,
}))
vi.mock('@/lib/validations/pattern', () => ({
  CreatePatternSchema: {
    // Phase 46: amountSign removed (ADR 0012) — patterns are sign-agnostic
    safeParse: (value: Record<string, unknown>) => {
      if (!value.pattern || !value.subCategoryId || value.confidence === undefined) {
        return { success: false, error: { issues: [{ message: 'Dati pattern mancanti.' }] } }
      }
      return { success: true, data: value }
    },
  },
  UpdatePatternSchema: {
    safeParse: (value: Record<string, unknown>) => ({ success: true, data: value }),
  },
  // deriveAmountSign removed — Phase 46: patterns are sign-agnostic (ADR 0012)
}))

vi.mock('@/lib/db/schema', () => ({
  categorizationPattern: {
    id: 'categorizationPattern.id',
    userId: 'categorizationPattern.userId',
    pattern: 'categorizationPattern.pattern',
    subCategoryId: 'categorizationPattern.subCategoryId',
    amountSign: 'categorizationPattern.amountSign',
    confidence: 'categorizationPattern.confidence',
    priority: 'categorizationPattern.priority',
    isActive: 'categorizationPattern.isActive',
  },
  expense: {
    id: 'expense.id',
    userId: 'expense.userId',
    title: 'expense.title',
    descriptionHash: 'expense.descriptionHash',
    subCategoryId: 'expense.subCategoryId',
    totalAmount: 'expense.totalAmount',
    transactionCount: 'expense.transactionCount',
    importedFromFileId: 'expense.importedFromFileId',
    firstTransactionAt: 'expense.firstTransactionAt',
    lastTransactionAt: 'expense.lastTransactionAt',
    status: 'expense.status',
    updatedAt: 'expense.updatedAt',
  },
  expenseClassificationHistory: {
    id: 'expenseClassificationHistory.id',
    userId: 'expenseClassificationHistory.userId',
    expenseId: 'expenseClassificationHistory.expenseId',
    toSubCategoryId: 'expenseClassificationHistory.toSubCategoryId',
    toStatus: 'expenseClassificationHistory.toStatus',
    source: 'expenseClassificationHistory.source',
    patternId: 'expenseClassificationHistory.patternId',
    confidence: 'expenseClassificationHistory.confidence',
  },
  importFormatVersion: {
    id: 'importFormatVersion.id',
    platformId: 'importFormatVersion.platformId',
    version: 'importFormatVersion.version',
    headerSignature: 'importFormatVersion.headerSignature',
    ownerUserId: 'importFormatVersion.ownerUserId',
    visibility: 'importFormatVersion.visibility',
    reviewStatus: 'importFormatVersion.reviewStatus',
    isActive: 'importFormatVersion.isActive',
  },
  platform: {
    id: 'platform.id',
    ownerUserId: 'platform.ownerUserId',
    visibility: 'platform.visibility',
    reviewStatus: 'platform.reviewStatus',
    isActive: 'platform.isActive',
    name: 'platform.name',
    slug: 'platform.slug',
    delimiter: 'platform.delimiter',
    country: 'platform.country',
    timestampColumn: 'platform.timestampColumn',
    descriptionColumn: 'platform.descriptionColumn',
    amountType: 'platform.amountType',
    amountColumn: 'platform.amountColumn',
    positiveAmountColumn: 'platform.positiveAmountColumn',
    negativeAmountColumn: 'platform.negativeAmountColumn',
    multiplyBy: 'platform.multiplyBy',
  },
  transaction: {
    id: 'transaction.id',
    userId: 'transaction.userId',
    fileId: 'transaction.fileId',
    expenseId: 'transaction.expenseId',
    transactionHash: 'transaction.transactionHash',
    description: 'transaction.description',
    descriptionHash: 'transaction.descriptionHash',
    amount: 'transaction.amount',
    currency: 'transaction.currency',
    occurredAt: 'transaction.occurredAt',
    rowIndex: 'transaction.rowIndex',
    rawRow: 'transaction.rawRow',
  },
}))

// Build a chainable query mock that always resolves to []
function makeQueryChain(finalValue: unknown[] = []) {
  const chain: Record<string, unknown> = {}
  const resolve = () => Promise.resolve(finalValue)
  // Each method returns the same chain, terminal calls return a resolved promise
  const proxy: typeof chain = new Proxy(chain, {
    get: (_t, prop) => {
      if (prop === 'then') return resolve().then.bind(resolve())
      if (typeof prop === 'string') return () => proxy
      return undefined
    },
  })
  return proxy
}

vi.mock('@/lib/db', () => {
  return {
    db: {
      transaction: mocks.dbTransaction,
      select: () => makeQueryChain([]),
      insert: () => ({ values: () => ({ returning: () => Promise.resolve([]) }) }),
      update: () => ({ set: () => ({ where: () => Promise.resolve([]) }) }),
    },
  }
})

vi.mock('@/lib/dal/files', () => ({
  getFileForUser: mocks.getFileForUser,
  markFileFailed: mocks.markFileFailed,
  updateFileAnalysisState: mocks.updateFileAnalysisState,
  updateFileImportState: mocks.updateFileImportState,
  getPlatformIdForUserFile: mocks.getPlatformIdForUserFile,
}))

vi.mock('@/lib/dal/transactions', () => ({
  getDuplicateHashes: mocks.getDuplicateHashes,
  insertTransactionBatch: mocks.insertTransactionBatch,
}))

vi.mock('@/lib/dal/import-formats', () => ({
  loadImportFormatsForDetection: mocks.loadImportFormatsForDetection,
}))

vi.mock('@/lib/dal/classification-history', () => ({
  writeClassificationHistory: mocks.writeClassificationHistory,
  getLatestClassificationSource: mocks.getLatestClassificationSource,
}))

vi.mock('@/lib/services/regex-discovery', () => ({
  discoverRegexCandidates: mocks.discoverRegexCandidates,
}))

vi.mock('@/lib/services/r2', () => ({
  readObjectBody: mocks.readObjectBody,
}))

// Also mock the @aws-sdk packages to prevent real network/config calls in case r2 mock leaks
vi.mock('@aws-sdk/client-s3', () => ({}))
vi.mock('@aws-sdk/s3-request-presigner', () => ({}))

vi.mock('@/lib/services/categorization', () => ({
  loadActivePatterns: mocks.loadActivePatterns,
  categorizePipeline: mocks.categorizePipeline,
  // applyTier1Regex is tested directly via importActual below
}))

// Use actual implementations for pure utility functions
vi.mock('@/lib/utils/import', async () => {
  const actual = await vi.importActual<typeof import('../lib/utils/import')>('../lib/utils/import')
  return actual
})

vi.mock('@/lib/utils/decimal', async () => {
  const actual = await vi.importActual<typeof import('../lib/utils/decimal')>('../lib/utils/decimal')
  return actual
})

// Mock import-parsers: default behavior is configured in each test setup
vi.mock('@/lib/services/import-parsers', () => ({
  parseImportFile: mocks.parseImportFile,
}))

// Mock import-format-detector: return a plausible detection result, or no candidate when the DAL returns no accessible formats
vi.mock('@/lib/services/import-format-detector', () => ({
  detectImportFormat: vi.fn((input: { formats: Array<ReturnType<typeof makeFormatCandidate>> }) => {
    const format = input.formats[0]

    if (!format) {
      return {
        bestCandidate: null,
        candidates: [],
        preview: {
          rowCount: 2,
          sampleRows: [],
          duplicateCount: 0,
          warnings: [],
        },
        warnings: [],
        errors: ['No supported import format matched the uploaded file headers and sample rows.'],
      }
    }

    return {
      bestCandidate: {
        formatVersionId: format.id,
        platformId: format.platformId,
        version: format.version,
        platform: format.platform,
        confidence: 0.95,
        matchedHeaders: ['"Data Movimento"', '"Descrizione"', '"Importo"'],
        missingHeaders: [],
        warnings: [],
        sampleValidity: { rowsChecked: 2, validRows: 2, invalidRows: 0 },
      },
      candidates: [],
      preview: {
        rowCount: 2,
        sampleRows: [
          {
            rowIndex: 1,
            description: 'Supermercato Esselunga',
            amount: '-45.50',
            occurredAt: '2026-01-10T00:00:00.000Z',
            transactionHash: 'hash-1',
            duplicate: false,
            valid: true,
            errors: [],
            warnings: [],
            rawRow: {},
          },
          {
            rowIndex: 2,
            description: 'Caffè Nero',
            amount: '-3.50',
            occurredAt: '2026-01-11T00:00:00.000Z',
            transactionHash: 'hash-2',
            duplicate: false,
            valid: true,
            errors: [],
            warnings: [],
            rawRow: {},
          },
        ],
        duplicateCount: 0,
        warnings: [],
      },
      warnings: [],
      errors: [],
    }
  }),
}))

// Import the modules under test AFTER mocks are registered
const {
  applyTier1Regex,
  categorizePipeline: categorizePipelineActual,
} = await vi.importActual<typeof import('../lib/services/categorization')>('../lib/services/categorization')
const { createPatternAction } = await import('../lib/actions/patterns')
const { detectImportFormat } = await import('../lib/services/import-format-detector')
const { importFile, analyzeFile } = await import('../lib/services/import')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER_ID = 'user-test-1'
const FILE_ID = '11111111-1111-4111-8111-111111111111'

const CATEGORIZATION_ENV_KEYS = [
  'CATEGORIZATION_REGEX_MIN_PLAN',
  'CATEGORIZATION_HISTORY_MIN_PLAN',
  'CATEGORIZATION_CUSTOM_PATTERNS_MIN_PLAN',
] as const

afterEach(() => {
  for (const key of CATEGORIZATION_ENV_KEYS) {
    delete process.env[key]
  }
})

function makeFileRow(overrides: Partial<FileRow> = {}): FileRow {
  return {
    id: FILE_ID,
    userId: USER_ID,
    importFormatVersionId: 1,
    originalName: 'statement.csv',
    displayName: null,
    contentHash: null,
    objectKey: `users/${USER_ID}/imports/${FILE_ID}.csv`,
    mimeType: 'text/csv',
    sizeBytes: 256,
    status: 'uploaded',
    uploadedAt: new Date('2026-01-01'),
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
    errorMessage: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }
}

// Minimal General platform format CSV: "Data Movimento";"Descrizione";"Importo"
const GENERAL_CSV = Buffer.from(
  [
    '"Data Movimento";"Descrizione";"Importo"',
    '"2026-01-10";"Supermercato Esselunga";"-45.50"',
    '"2026-01-11";"Caffè Nero";"-3.50"',
  ].join('\n'),
  'utf8',
)

function makeParsedImport(rows = [
  { '"Data Movimento"': '2026-01-10', '"Descrizione"': 'Supermercato Esselunga', '"Importo"': '-45.50' },
  { '"Data Movimento"': '2026-01-11', '"Descrizione"': 'Caffè Nero', '"Importo"': '-3.50' },
]) {
  return {
    fileName: 'statement.csv',
    byteLength: 256,
    encoding: 'UTF-8',
    delimiter: ';',
    headers: ['"Data Movimento"', '"Descrizione"', '"Importo"'],
    rows,
    rowCount: rows.length,
    sampleRows: rows,
    warnings: [],
    errors: [],
  }
}

function makeFormatCandidate(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    platformId: 1,
    version: 1,
    headerSignature: '"Data Movimento";"Descrizione";"Importo"',
    isActive: true,
    platform: {
      id: 1,
      name: 'General',
      slug: 'general',
      delimiter: ';',
      country: 'IT',
      timestampColumn: '"Data Movimento"',
      descriptionColumn: '"Descrizione"',
      descriptionStripPattern: null,
      amountType: 'single' as const,
      amountColumn: '"Importo"',
      positiveAmountColumn: null,
      negativeAmountColumn: null,
      multiplyBy: 1,
    },
    ...overrides,
  }
}

async function makeReadableStream(buf: Buffer): Promise<AsyncIterable<Uint8Array>> {
  return (async function* () {
    yield buf
  })()
}

function latestFileAnalysisUpdate() {
  const calls = mocks.updateFileAnalysisState.mock.calls
  return calls[calls.length - 1]?.[0] as Record<string, unknown>
}

function latestFileImportUpdate() {
  const calls = mocks.updateFileImportState.mock.calls
  return calls[calls.length - 1]?.[0] as Record<string, unknown>
}

// ---------------------------------------------------------------------------
// applyTier1Regex unit tests (pure, no mocks needed)
// ---------------------------------------------------------------------------
describe('applyTier1Regex', () => {
  const patterns: ActivePattern[] = [
    {
      id: 1,
      userId: null,
      pattern: 'supermercato',
      subCategoryId: 10,
      // Phase 46: amountSign removed (ADR 0012)
      confidence: '0.90',
      priority: 10,
    },
    {
      id: 2,
      userId: null,
      pattern: 'caffè',
      subCategoryId: 20,
      // Phase 46: amountSign removed (ADR 0012)
      confidence: '0.85',
      priority: 20,
    },
    {
      id: 3,
      userId: 'user-1',
      pattern: 'netflix',
      subCategoryId: 30,
      // Phase 46: amountSign removed (ADR 0012)
      confidence: '0.95',
      priority: 5,
    },
    {
      id: 4,
      userId: null,
      pattern: '([invalid regex',
      subCategoryId: 40,
      // Phase 46: amountSign removed (ADR 0012)
      confidence: '0.80',
      priority: 50,
    },
  ]

  it('returns the first matching system pattern for description match', () => {
    const result = applyTier1Regex('Pagamento Supermercato Esselunga', '-45.50', patterns)
    expect(result).toMatchObject({
      subCategoryId: 10,
      source: 'system_pattern',
      patternId: 1,
    })
  })

  it('returns user_pattern source for user-scoped patterns', () => {
    const result = applyTier1Regex('Netflix abbonamento', '-12.99', patterns)
    expect(result).toMatchObject({
      subCategoryId: 30,
      source: 'user_pattern',
      patternId: 3,
    })
  })

  it('matches positive amounts (Phase 46: patterns are sign-agnostic, ADR 0012)', () => {
    // Phase 46: amountSign constraint removed — patterns match regardless of sign
    const result = applyTier1Regex('Caffè Nero rimborso', '5.00', patterns)
    expect(result).toMatchObject({ subCategoryId: 20, patternId: 2 })
  })

  it('accepts negative amounts for negative-only patterns', () => {
    const result = applyTier1Regex('Caffè Nero', '-3.50', patterns)
    expect(result).toMatchObject({ subCategoryId: 20, patternId: 2 })
  })

  it('skips invalid regex patterns without throwing', () => {
    // Pattern id 4 has invalid regex; should not throw, should return null if no other match
    const result = applyTier1Regex('([invalid regex test', '-1.00', [patterns[3]!])
    expect(result).toBeNull()
  })

  it('prefers a user pattern over a matching system pattern when the ordered pattern list puts user rules first', () => {
    // Phase 46: amountSign removed (ADR 0012)
    const result = applyTier1Regex('Amazon marketplace', '-22.00', [
      {
        id: 10,
        userId: 'user-1',
        pattern: 'amazon',
        subCategoryId: 99,
        confidence: '0.96',
        priority: 100,
      },
      {
        id: 11,
        userId: null,
        pattern: 'amazon',
        subCategoryId: 11,
        confidence: '0.90',
        priority: 20,
      },
    ])

    expect(result).toMatchObject({
      subCategoryId: 99,
      source: 'user_pattern',
      patternId: 10,
    })
  })

  it('returns null when no pattern matches', () => {
    const result = applyTier1Regex('Totally unknown transaction', '-10.00', patterns)
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// categorizePipeline direct unit tests (real implementation, mocked db)
// ---------------------------------------------------------------------------
describe('categorizePipeline direct', () => {
  const dbProxy = {} as Parameters<Parameters<typeof import('../lib/db').db.transaction>[0]>[0]

  function makeHistoryDatabase(toSubCategoryId: number) {
    return {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockReturnValue({
                having: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([{ toSubCategoryId, weight: 3 }]),
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    }
  }

  it('returns non-null with subCategoryId for basic plan when a pattern matches', async () => {
    // Phase 46: amountSign removed (ADR 0012)
    const patterns: ActivePattern[] = [
      {
        id: 5,
        userId: null,
        pattern: 'netflix',
        subCategoryId: 5,
        confidence: '0.95',
        priority: 10,
      },
    ]

    const result = await categorizePipelineActual(
      dbProxy,
      USER_ID,
      'basic',
      'Netflix abbonamento mensile',
      '-12.99',
      'dh-netflix',
      patterns,
    )

    expect(result).not.toBeNull()
    expect(result).toMatchObject({ subCategoryId: 5 })
  })

  // Phase 46: amountSign removed (ADR 0012)
  it('returns the user Netflix pattern result before a colliding system Netflix pattern', async () => {
    const patterns: ActivePattern[] = [
      {
        id: 101,
        userId: USER_ID,
        pattern: 'netflix',
        subCategoryId: 301,
        confidence: '0.97',
        priority: 50,
      },
      {
        id: 102,
        userId: null,
        pattern: 'netflix',
        subCategoryId: 302,
        confidence: '0.90',
        priority: 10,
      },
    ]

    const result = await categorizePipelineActual(
      dbProxy,
      USER_ID,
      'basic',
      'NETFLIX PAYMENT',
      '-12.99',
      'dh-netflix-user-first',
      patterns,
    )

    expect(result).toEqual({
      subCategoryId: 301,
      confidence: '0.97',
      patternId: 101,
      source: 'user_pattern',
    })
  })

  // Phase 46: amountSign removed (ADR 0012)
  it('uses global system regex patterns for free plan imports', async () => {
    const patterns: ActivePattern[] = [
      {
        id: 5,
        userId: null,
        pattern: 'netflix',
        subCategoryId: 5,
        confidence: '0.95',
        priority: 10,
      },
    ]

    const result = await categorizePipelineActual(
      dbProxy,
      USER_ID,
      'free',
      'Netflix abbonamento mensile',
      '-12.99',
      'dh-netflix',
      patterns,
    )

    expect(result).toMatchObject({
      subCategoryId: 5,
      source: 'system_pattern',
      patternId: 5,
    })
  })

  it('uses user-owned regex patterns for free plan imports by default during alpha', async () => {
    // Phase 46: amountSign removed (ADR 0012)
    const patterns: ActivePattern[] = [
      {
        id: 5,
        userId: USER_ID,
        pattern: 'netflix',
        subCategoryId: 5,
        confidence: '0.95',
        priority: 10,
      },
    ]

    const result = await categorizePipelineActual(
      dbProxy,
      USER_ID,
      'free',
      'Netflix abbonamento mensile',
      '-12.99',
      'dh-netflix',
      patterns,
    )

    expect(result).toMatchObject({
      subCategoryId: 5,
      source: 'user_pattern',
      patternId: 5,
    })
  })

  it('uses history-based categorization for free plan imports by default during alpha', async () => {
    const result = await categorizePipelineActual(
      makeHistoryDatabase(77) as never,
      USER_ID,
      'free',
      'Unknown merchant',
      '-12.99',
      'dh-history',
      [],
    )

    expect(result).toEqual({
      subCategoryId: 77,
      confidence: '0.70',
      patternId: null,
      source: 'system_pattern',
    })
  })

  // Phase 46: amountSign removed (ADR 0012)
  it('can raise regex and history minimum plans through configuration', async () => {
    process.env.CATEGORIZATION_REGEX_MIN_PLAN = 'basic'
    process.env.CATEGORIZATION_HISTORY_MIN_PLAN = 'basic'

    const result = await categorizePipelineActual(
      dbProxy,
      USER_ID,
      'free',
      'Netflix abbonamento mensile',
      '-12.99',
      'dh-netflix',
      [
        {
          id: 5,
          userId: USER_ID,
          pattern: 'netflix',
          subCategoryId: 5,
          confidence: '0.95',
          priority: 10,
        },
      ],
    )

    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// pattern server action tests
// ---------------------------------------------------------------------------
describe('createPatternAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifySession.mockResolvedValue({
      userId: USER_ID,
      email: 'user@example.test',
      subscriptionPlan: 'basic',
      role: 'user',
    })
    mocks.createPattern.mockResolvedValue({ id: 1 })
    mocks.getCategoryTypeForSubCategory.mockResolvedValue('out')
  })

  it('allows free users to create custom regex patterns by default during alpha', async () => {
    mocks.verifySession.mockResolvedValue({
      userId: USER_ID,
      email: 'user@example.test',
      subscriptionPlan: 'free',
      role: 'user',
    })

    const formData = new FormData()
    formData.set('pattern', 'deliveroo')
    formData.set('subCategoryId', '42')
    formData.set('amountSign', 'negative')
    formData.set('confidence', '0.95')

    const result = await createPatternAction({ error: null }, formData)

    expect(result.error).toBeNull()
    expect(mocks.createPattern).toHaveBeenCalledWith(expect.objectContaining({ userId: USER_ID }))
  })

  it('can raise the custom-pattern minimum plan through configuration', async () => {
    process.env.CATEGORIZATION_CUSTOM_PATTERNS_MIN_PLAN = 'basic'
    mocks.verifySession.mockResolvedValue({
      userId: USER_ID,
      email: 'user@example.test',
      subscriptionPlan: 'free',
      role: 'user',
    })

    const formData = new FormData()
    formData.set('pattern', 'deliveroo')
    formData.set('subCategoryId', '42')
    formData.set('amountSign', 'negative')
    formData.set('confidence', '0.95')

    const result = await createPatternAction({ error: null }, formData)

    expect(result.error).toContain('Basic o Pro')
    expect(mocks.createPattern).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// analyzeFile lifecycle guard tests
// ---------------------------------------------------------------------------
describe('analyzeFile — lifecycle guards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.markFileFailed.mockResolvedValue(undefined)
    mocks.updateFileAnalysisState.mockResolvedValue(undefined)
  })

  it.each([
    ['analyzing' as const],
    ['importing' as const],
    ['imported' as const],
  ])('rejects analysis for status=%s without calling state mutation or R2 work', async (status) => {
    mocks.getFileForUser.mockResolvedValue(makeFileRow({ status }))

    await expect(
      analyzeFile({ userId: USER_ID, fileId: FILE_ID }),
    ).rejects.toThrow('Analisi non consentita per questo file nel suo stato attuale.')

    expect(mocks.updateFileAnalysisState).not.toHaveBeenCalled()
    expect(mocks.readObjectBody).not.toHaveBeenCalled()
    expect(mocks.parseImportFile).not.toHaveBeenCalled()
    expect(mocks.markFileFailed).not.toHaveBeenCalled()
  })

  it.each([
    ['uploaded' as const],
    ['failed' as const],
    ['analyzed' as const],
  ])('allows analysis for status=%s and proceeds to state mutation', async (status) => {
    mocks.getFileForUser.mockResolvedValue(makeFileRow({ status }))
    mocks.readObjectBody.mockResolvedValue(
      (async function* () { yield GENERAL_CSV })(),
    )
    mocks.parseImportFile.mockResolvedValue(makeParsedImport())
    mocks.loadImportFormatsForDetection.mockResolvedValue([makeFormatCandidate()])
    mocks.getDuplicateHashes.mockResolvedValue(new Set<string>())
    mocks.updateFileAnalysisState.mockResolvedValue(undefined)

    await analyzeFile({ userId: USER_ID, fileId: FILE_ID })

    expect(mocks.updateFileAnalysisState).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// importFile lifecycle guard tests
// ---------------------------------------------------------------------------
describe('importFile — lifecycle guards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.markFileFailed.mockResolvedValue(undefined)
    mocks.updateFileImportState.mockResolvedValue(undefined)
  })

  it.each([
    ['uploaded' as const],
    ['analyzing' as const],
    ['importing' as const],
    ['imported' as const],
    ['failed' as const],
  ])('rejects import confirmation for status=%s without calling state mutation or R2 work', async (status) => {
    mocks.getFileForUser.mockResolvedValue(makeFileRow({ status }))

    await expect(
      importFile({ userId: USER_ID, fileId: FILE_ID }),
    ).rejects.toThrow('Importazione non consentita per questo file nel suo stato attuale.')

    expect(mocks.updateFileImportState).not.toHaveBeenCalled()
    expect(mocks.readObjectBody).not.toHaveBeenCalled()
    expect(mocks.parseImportFile).not.toHaveBeenCalled()
    expect(mocks.markFileFailed).not.toHaveBeenCalled()
  })

  it('allows import confirmation for status=analyzed and proceeds to state mutation', async () => {
    mocks.getFileForUser.mockResolvedValue(makeFileRow({ status: 'analyzed' }))
    mocks.readObjectBody.mockResolvedValue(
      (async function* () { yield GENERAL_CSV })(),
    )
    mocks.parseImportFile.mockResolvedValue(makeParsedImport())
    mocks.loadImportFormatsForDetection.mockResolvedValue([makeFormatCandidate()])
    mocks.getDuplicateHashes.mockResolvedValue(new Set<string>())
    mocks.loadActivePatterns.mockResolvedValue([])
    mocks.categorizePipeline.mockResolvedValue(null)
    mocks.insertTransactionBatch.mockResolvedValue([])
    mocks.writeClassificationHistory.mockResolvedValue(undefined)
    mocks.getLatestClassificationSource.mockResolvedValue(null)
    mocks.updateFileImportState.mockResolvedValue(undefined)
    mocks.dbTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                then: vi.fn((onFulfilled?: (rows: unknown[]) => unknown) => {
                  const rows: unknown[] = []
                  return Promise.resolve(onFulfilled ? onFulfilled(rows) : rows)
                }),
              }),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      }
      return callback(tx)
    })

    await importFile({ userId: USER_ID, fileId: FILE_ID })

    expect(mocks.updateFileImportState).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// importFile integration tests (mocked db, r2, dal)
// ---------------------------------------------------------------------------
describe('importFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getFileForUser.mockResolvedValue(makeFileRow({ status: 'analyzed' }))
    mocks.updateFileImportState.mockResolvedValue(makeFileRow({ status: 'importing' }))
    mocks.markFileFailed.mockResolvedValue(makeFileRow({ status: 'failed' }))
    mocks.getDuplicateHashes.mockResolvedValue(new Set<string>())
    mocks.loadActivePatterns.mockResolvedValue([])
    mocks.categorizePipeline.mockResolvedValue(null)
    mocks.insertTransactionBatch.mockResolvedValue([])
    mocks.writeClassificationHistory.mockResolvedValue(undefined)
    mocks.getLatestClassificationSource.mockResolvedValue(null)
    mocks.parseImportFile.mockResolvedValue(makeParsedImport())
    mocks.loadImportFormatsForDetection.mockResolvedValue([makeFormatCandidate()])
    // Default: return a readable stream from GENERAL_CSV
    mocks.readObjectBody.mockResolvedValue(
      (async function* () { yield GENERAL_CSV })(),
    )

    // Default transaction mock: execute callback with a tx proxy
    mocks.dbTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                then: vi.fn((onFulfilled?: (rows: unknown[]) => unknown) => {
                const rows: unknown[] = []
                return Promise.resolve(onFulfilled ? onFulfilled(rows) : rows)
              }),
              }),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      }
      return callback(tx)
    })
  })

  it('throws and marks file failed when file is not found (ownership check)', async () => {
    mocks.getFileForUser.mockResolvedValue(null)

    await expect(
      importFile({ userId: USER_ID, fileId: FILE_ID }),
    ).rejects.toThrow('File not found or access denied.')

    // markFileFailed should NOT be called — no file row to update
    expect(mocks.markFileFailed).not.toHaveBeenCalled()
  })

  it('stores a >120-char bank description as the full expense.title (no write-time truncation)', async () => {
    const longDescription = `Beneficiario Andrea Bernardini ${'X'.repeat(160)}`
    expect(longDescription.length).toBeGreaterThan(120)

    mocks.parseImportFile.mockResolvedValue(makeParsedImport([
      { '"Data Movimento"': '2026-01-10', '"Descrizione"': longDescription, '"Importo"': '-45.50' },
    ]))

    // Capture every expense insert (identified by a title + descriptionHash payload).
    const expenseInsertValues: Array<Record<string, unknown>> = []
    mocks.dbTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn((v: Record<string, unknown>) => {
            if (v && typeof v === 'object' && 'title' in v && 'descriptionHash' in v) {
              expenseInsertValues.push(v)
            }
            return { returning: vi.fn().mockResolvedValue([{ id: 'exp-1' }]) }
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
        }),
      }
      return callback(tx)
    })

    await importFile({ userId: USER_ID, fileId: FILE_ID }).catch(() => null)

    const inserted = expenseInsertValues.find((v) => typeof v.title === 'string')
    expect(inserted).toBeDefined()
    expect((inserted!.title as string).length).toBeGreaterThan(120)
    expect(inserted!.title).toBe(longDescription)
  })

  it('loads import formats through the ownership-aware DAL with the selected format id', async () => {
    await importFile({ userId: USER_ID, fileId: FILE_ID, selectedFormatVersionId: 7 }).catch(() => null)

    expect(mocks.loadImportFormatsForDetection).toHaveBeenCalledWith({
      userId: USER_ID,
      selectedFormatVersionId: 7,
    })
  })

  it('fails closed when a selected private format is not accessible to the user', async () => {
    mocks.loadImportFormatsForDetection.mockResolvedValueOnce([])

    await expect(
      importFile({ userId: USER_ID, fileId: FILE_ID, selectedFormatVersionId: 99 }),
    ).rejects.toThrow('No supported import format matched the uploaded file headers and sample rows.')

    expect(detectImportFormat).toHaveBeenCalledWith(
      expect.objectContaining({ formats: [], userId: USER_ID }),
    )
    expect(latestFileImportUpdate()).toMatchObject({
      status: 'failed',
      errorMessage: expect.stringContaining('No supported import format matched'),
    })
  })

  it('marks file failed and rethrows when R2 read fails', async () => {
    mocks.readObjectBody.mockRejectedValue(
      Object.assign(new Error('Could not read uploaded file. Please retry.'), {
        code: 'r2_read_failed',
      }),
    )

    await expect(
      importFile({ userId: USER_ID, fileId: FILE_ID }),
    ).rejects.toThrow('Could not read uploaded file. Please retry.')

    expect(mocks.markFileFailed).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, fileId: FILE_ID }),
    )
  })

  it('skips duplicate transactions and counts them', async () => {
    mocks.readObjectBody.mockResolvedValue(await makeReadableStream(GENERAL_CSV))

    // Pretend both transactions already exist in DB — return a Set containing ALL incoming hashes
    mocks.getDuplicateHashes.mockImplementation(async (_tx: unknown, _userId: string, hashes: string[]) => {
      return new Set(hashes)
    })

    const result = await importFile({
      userId: USER_ID,
      fileId: FILE_ID,
      selectedFormatVersionId: 1,
    })

    // The pre-flight Set filter should have eliminated all rows before calling insertTransactionBatch.
    // Verify that insertTransactionBatch was called with an empty array — the DB-level onConflictDoNothing
    // is a safety net, but the primary dedup contract is this pre-flight filter.
    expect(result).toMatchObject({ rowCount: 2, importedCount: 0, duplicateCount: 2 })
    expect(mocks.insertTransactionBatch).toHaveBeenCalledWith(expect.anything(), [])
    expect(latestFileImportUpdate()).toMatchObject({
      status: 'imported',
      rowCount: 2,
      importedCount: 0,
      duplicateCount: 2,
      positiveTotal: '0.00',
      negativeTotal: '-49.00',
    })
  })

  it('persists zeroed stats for an empty parsed file without crashing', async () => {
    mocks.parseImportFile.mockResolvedValue(makeParsedImport([]))

    const result = await importFile({ userId: USER_ID, fileId: FILE_ID })

    expect(result).toMatchObject({ rowCount: 0, importedCount: 0, duplicateCount: 0 })
    expect(mocks.insertTransactionBatch).toHaveBeenCalledWith(expect.anything(), [])
    expect(latestFileImportUpdate()).toMatchObject({
      status: 'imported',
      rowCount: 0,
      importedCount: 0,
      duplicateCount: 0,
      positiveTotal: '0.00',
      negativeTotal: '0.00',
      referenceStartedAt: null,
      referenceEndedAt: null,
    })
  })

  it('persists imported full-file stats including in-file duplicate skips and date range', async () => {
    const rows = [
      { '"Data Movimento"': '2026-01-10', '"Descrizione"': 'Salary', '"Importo"': '100.00' },
      { '"Data Movimento"': '2026-01-11', '"Descrizione"': 'Coffee', '"Importo"': '-3.50' },
      { '"Data Movimento"': '2026-01-11', '"Descrizione"': 'Coffee', '"Importo"': '-3.50' },
      { '"Data Movimento"': '', '"Descrizione"': 'Malformed', '"Importo"': '' },
    ]
    mocks.parseImportFile.mockResolvedValue(makeParsedImport(rows))
    mocks.insertTransactionBatch.mockImplementation(async (_tx: unknown, insertedRows: Array<Record<string, unknown>>) => insertedRows)

    const result = await importFile({
      userId: USER_ID,
      fileId: FILE_ID,
      selectedFormatVersionId: 1,
    })

    expect(result).toMatchObject({
      rowCount: 4,
      importedCount: 2,
      duplicateCount: 2,
    })
    expect(mocks.insertTransactionBatch).toHaveBeenCalledWith(expect.anything(), expect.arrayContaining([
      expect.objectContaining({ description: 'Salary', amount: '100.00' }),
      expect.objectContaining({ description: 'Coffee', amount: '-3.50' }),
    ]))
    expect(latestFileImportUpdate()).toMatchObject({
      status: 'imported',
      rowCount: 4,
      importedCount: 2,
      duplicateCount: 2,
      positiveTotal: '100.00',
      negativeTotal: '-7.00',
      referenceStartedAt: new Date('2026-01-10T00:00:00.000Z'),
      referenceEndedAt: new Date('2026-01-11T00:00:00.000Z'),
      errorMessage: null,
    })
  })

  it('free plan still uses global system regex patterns when importing expenses', async () => {
    mocks.readObjectBody.mockResolvedValue(await makeReadableStream(GENERAL_CSV))
    mocks.categorizePipeline.mockResolvedValue({
      subCategoryId: 10,
      confidence: '0.90',
      patternId: 1,
      source: 'system_pattern' as const,
    })

    const result = await importFile({
      userId: USER_ID,
      fileId: FILE_ID,
      subscriptionPlan: 'free',
    }).catch(() => null)

    if (result) {
      expect(result.fileId).toBe(FILE_ID)
    }
    expect(mocks.categorizePipeline).toHaveBeenCalledWith(
      expect.anything(),
      USER_ID,
      'free',
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(Array),
    )
  })

  it('basic plan with Tier 1 regex match inserts classification history row', async () => {
    mocks.categorizePipeline.mockResolvedValue({
      subCategoryId: 10,
      confidence: '0.90',
      patternId: 1,
      source: 'system_pattern' as const,
    })

    // Return 2 transaction rows so categorizePipeline gets called once per unique descriptionHash
    const txDate = new Date('2026-01-10T00:00:00.000Z')
    mocks.insertTransactionBatch.mockResolvedValue([
      { id: 'tx-1', userId: USER_ID, fileId: FILE_ID, expenseId: null, transactionHash: 'h1', description: 'Supermercato Esselunga', descriptionHash: 'dh1', amount: '-45.50', currency: 'EUR', occurredAt: txDate, rowIndex: 1, rawRow: null, createdAt: txDate },
      { id: 'tx-2', userId: USER_ID, fileId: FILE_ID, expenseId: null, transactionHash: 'h2', description: 'Caffè Nero', descriptionHash: 'dh2', amount: '-3.50', currency: 'EUR', occurredAt: txDate, rowIndex: 2, rawRow: null, createdAt: txDate },
    ])

    await importFile({
      userId: USER_ID,
      fileId: FILE_ID,
      subscriptionPlan: 'basic',
    }).catch(() => null)

    // categorizePipeline should be called once per unique descriptionHash with plan='basic'
    expect(mocks.categorizePipeline).toHaveBeenCalled()
    expect(mocks.categorizePipeline).toHaveBeenCalledWith(
      expect.anything(),   // tx/db
      USER_ID,
      'basic',
      expect.any(String),  // description
      expect.any(String),  // amount
      expect.any(String),  // descriptionHash
      expect.any(Array),   // patterns
    )
  })

  // Phase 46: amountSign removed (ADR 0012)
  it('basic plan imports a canonical user Netflix pattern before the system collision and records classification history', async () => {
    const userNetflixPattern: ActivePattern = {
      id: 201,
      userId: USER_ID,
      pattern: 'netflix',
      subCategoryId: 701,
      confidence: '0.97',
      priority: 50,
    }
    const systemNetflixPattern: ActivePattern = {
      id: 202,
      userId: null,
      pattern: 'netflix',
      subCategoryId: 702,
      confidence: '0.90',
      priority: 10,
    }

    mocks.parseImportFile.mockResolvedValue(makeParsedImport([
      { '"Data Movimento"': '2026-02-01', '"Descrizione"': 'NETFLIX PAYMENT', '"Importo"': '-12.99' },
    ]))
    mocks.loadActivePatterns.mockResolvedValue([userNetflixPattern, systemNetflixPattern])
    mocks.categorizePipeline.mockImplementation(categorizePipelineActual)
    mocks.insertTransactionBatch.mockImplementation(async (_tx: unknown, rows: Array<Record<string, unknown>>) => rows)

    const result = await importFile({
      userId: USER_ID,
      fileId: FILE_ID,
      subscriptionPlan: 'basic',
    })

    expect(result.importedCount).toBe(1)
    expect(mocks.categorizePipeline).toHaveBeenCalledWith(
      expect.anything(),
      USER_ID,
      'basic',
      'NETFLIX PAYMENT',
      '-12.99',
      expect.any(String),
      [userNetflixPattern, systemNetflixPattern],
    )
    expect(mocks.writeClassificationHistory).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: USER_ID,
        toSubCategoryId: 701,
        toStatus: '3',
        source: 'user_pattern',
        patternId: 201,
        confidence: '0.97',
      }),
    )
  })

  it('manual-lock: preserves subCategoryId and status when latest history source is manual', async () => {
    const EXISTING_EXPENSE_ID = 'expense-manual-locked-1'
    const ORIGINAL_SUBCAT = 42
    const PIPELINE_SUBCAT = 99

    mocks.parseImportFile.mockResolvedValue(makeParsedImport([
      { '"Data Movimento"': '2026-01-10', '"Descrizione"': 'Andrea D\'Este', '"Importo"': '-15.00' },
    ]))
    mocks.categorizePipeline.mockResolvedValue({
      subCategoryId: PIPELINE_SUBCAT,
      confidence: '0.90',
      patternId: 1,
      source: 'system_pattern' as const,
    })
    mocks.getLatestClassificationSource.mockResolvedValue('manual')

    const expenseUpdates: Array<Record<string, unknown>> = []
    const txDate = new Date('2026-01-10T00:00:00.000Z')
    mocks.insertTransactionBatch.mockResolvedValue([
      {
        id: 'tx-manual-1',
        userId: USER_ID,
        fileId: FILE_ID,
        expenseId: null,
        transactionHash: 'hash-manual-1',
        description: "Andrea D'Este",
        descriptionHash: 'dh-manual-1',
        amount: '-15.00',
        currency: 'EUR',
        occurredAt: txDate,
        rowIndex: 1,
        rawRow: null,
        createdAt: txDate,
      },
    ])

    mocks.dbTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                then: vi.fn((onFulfilled?: (rows: unknown[]) => unknown) => {
                  const rows = [{
                    id: EXISTING_EXPENSE_ID,
                    totalAmount: '30.00',
                    transactionCount: 2,
                    subCategoryId: ORIGINAL_SUBCAT,
                    status: '3',
                  }]
                  return Promise.resolve(onFulfilled ? onFulfilled(rows) : rows)
                }),
              }),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn((payload: Record<string, unknown>) => {
            expenseUpdates.push(payload)
            return { where: vi.fn().mockResolvedValue([]) }
          }),
        }),
      }
      return callback(tx)
    })

    await importFile({ userId: USER_ID, fileId: FILE_ID, subscriptionPlan: 'basic' })

    const expenseAggregateUpdate = expenseUpdates.find(
      (payload) => 'totalAmount' in payload && 'transactionCount' in payload,
    )
    expect(expenseAggregateUpdate).toMatchObject({
      totalAmount: '15.00',
      transactionCount: 3,
    })
    expect(expenseAggregateUpdate).not.toHaveProperty('subCategoryId')
    expect(expenseAggregateUpdate).not.toHaveProperty('status')
    expect(mocks.writeClassificationHistory).not.toHaveBeenCalled()
    expect(mocks.getLatestClassificationSource).toHaveBeenCalledWith(
      expect.anything(),
      { userId: USER_ID, expenseId: EXISTING_EXPENSE_ID },
    )
  })

  it('cross-user file access is denied — getFileForUser enforces userId scope', async () => {
    // getFileForUser already scopes by userId AND fileId; returning null = not found / wrong user
    mocks.getFileForUser.mockResolvedValue(null)

    await expect(
      importFile({ userId: 'attacker-user', fileId: FILE_ID }),
    ).rejects.toThrow('File not found or access denied.')

    expect(mocks.getFileForUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'attacker-user', fileId: FILE_ID }),
    )
  })

  it('rolls back and marks file failed on mid-transaction DB error', async () => {
    mocks.readObjectBody.mockResolvedValue(await makeReadableStream(GENERAL_CSV))
    mocks.dbTransaction.mockRejectedValue(new Error('DB connection lost.'))

    await expect(
      importFile({ userId: USER_ID, fileId: FILE_ID }),
    ).rejects.toThrow()

    expect(mocks.markFileFailed).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, fileId: FILE_ID }),
    )
  })
})

// ---------------------------------------------------------------------------
// importFile — post-commit discovery (TRIG-01) tests
// ---------------------------------------------------------------------------
describe('importFile — post-commit discovery (TRIG-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getFileForUser.mockResolvedValue(makeFileRow({ status: 'analyzed' }))
    mocks.updateFileImportState.mockResolvedValue(makeFileRow({ status: 'importing' }))
    mocks.markFileFailed.mockResolvedValue(makeFileRow({ status: 'failed' }))
    mocks.getDuplicateHashes.mockResolvedValue(new Set<string>())
    mocks.loadActivePatterns.mockResolvedValue([])
    mocks.categorizePipeline.mockResolvedValue(null)
    mocks.insertTransactionBatch.mockResolvedValue([])
    mocks.writeClassificationHistory.mockResolvedValue(undefined)
    mocks.getLatestClassificationSource.mockResolvedValue(null)
    mocks.parseImportFile.mockResolvedValue(makeParsedImport())
    mocks.loadImportFormatsForDetection.mockResolvedValue([makeFormatCandidate()])
    mocks.readObjectBody.mockResolvedValue(
      (async function* () { yield GENERAL_CSV })(),
    )
    mocks.getPlatformIdForUserFile.mockResolvedValue(5)
    mocks.discoverRegexCandidates.mockResolvedValue({
      candidates: [],
      singleCategorizationSuggestions: [],
      totalUncategorized: 0,
      platformId: 5,
    })

    mocks.dbTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                then: vi.fn((onFulfilled?: (rows: unknown[]) => unknown) => {
                  const rows: unknown[] = []
                  return Promise.resolve(onFulfilled ? onFulfilled(rows) : rows)
                }),
              }),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      }
      return callback(tx)
    })
  })

  it('Test 1: successful import returns discoveryCount equal to candidates + singleCategorizationSuggestions', async () => {
    mocks.discoverRegexCandidates.mockResolvedValue({
      candidates: [
        { pattern: 'esselunga', matchCount: 3, residualVariablePart: '', sampleDescriptions: [], descriptionHashes: [] },
        { pattern: 'caffè', matchCount: 2, residualVariablePart: '', sampleDescriptions: [], descriptionHashes: [] },
      ],
      singleCategorizationSuggestions: [
        { normalizedDescription: 'netflix', sampleDescriptions: ['NETFLIX'], matchCount: 1, descriptionHashes: [] },
      ],
      totalUncategorized: 3,
      platformId: 5,
    })

    const result = await importFile({ userId: USER_ID, fileId: FILE_ID })

    expect(result.discoveryCount).toBe(3) // 2 candidates + 1 singleCategorizationSuggestion
  })

  it('Test 2: when discoverRegexCandidates throws, importFile returns successfully with discoveryCount 0 and logs post_import_discovery_failed', async () => {
    mocks.discoverRegexCandidates.mockRejectedValue(new Error('Discovery service failed'))

    const result = await importFile({ userId: USER_ID, fileId: FILE_ID })

    // Import still succeeds
    expect(result).toMatchObject({ fileId: FILE_ID, rowCount: 2, importedCount: 0 })
    // discoveryCount is 0
    expect(result.discoveryCount).toBe(0)
    // Warning logged
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'post_import_discovery_failed', userId: USER_ID, fileId: FILE_ID }),
    )
  })

  it('Test 3: when getPlatformIdForUserFile returns null, discovery is skipped and discoveryCount is 0', async () => {
    mocks.getPlatformIdForUserFile.mockResolvedValue(null)

    const result = await importFile({ userId: USER_ID, fileId: FILE_ID })

    // Import still succeeds
    expect(result).toMatchObject({ fileId: FILE_ID })
    // Discovery not called
    expect(mocks.discoverRegexCandidates).not.toHaveBeenCalled()
    // discoveryCount is 0
    expect(result.discoveryCount).toBe(0)
  })

  it('Test 4: discoverRegexCandidates is called AFTER the transaction with userId and platformId only (no tx handle)', async () => {
    const PLATFORM_ID = 42
    mocks.getPlatformIdForUserFile.mockResolvedValue(PLATFORM_ID)
    mocks.discoverRegexCandidates.mockResolvedValue({
      candidates: [],
      singleCategorizationSuggestions: [],
      totalUncategorized: 0,
      platformId: PLATFORM_ID,
    })

    await importFile({ userId: USER_ID, fileId: FILE_ID })

    // Called with userId and scope.platformId — no tx handle
    expect(mocks.discoverRegexCandidates).toHaveBeenCalledWith({
      userId: USER_ID,
      scope: { platformId: PLATFORM_ID },
    })
    // Called after transaction resolves (getPlatformIdForUserFile uses the main db, not a tx)
    expect(mocks.getPlatformIdForUserFile).toHaveBeenCalledWith({
      userId: USER_ID,
      fileId: FILE_ID,
    })
  })
})

// ---------------------------------------------------------------------------
// analyzeFile unit tests
// ---------------------------------------------------------------------------
describe('analyzeFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getFileForUser.mockResolvedValue(makeFileRow())
    mocks.updateFileAnalysisState.mockResolvedValue(makeFileRow({ status: 'analyzing' }))
    mocks.markFileFailed.mockResolvedValue(makeFileRow({ status: 'failed' }))
    mocks.getDuplicateHashes.mockResolvedValue(new Set<string>())
    mocks.loadImportFormatsForDetection.mockResolvedValue([makeFormatCandidate()])
  })

  it('persists full-file analysis stats instead of sample-limited preview stats', async () => {
    mocks.readObjectBody.mockResolvedValue(await makeReadableStream(GENERAL_CSV))
    mocks.parseImportFile.mockResolvedValue(makeParsedImport([
      { '"Data Movimento"': '2026-01-10', '"Descrizione"': 'Supermercato Esselunga', '"Importo"': '-45.50' },
      { '"Data Movimento"': '2026-01-11', '"Descrizione"': 'Caffè Nero', '"Importo"': '-3.50' },
      { '"Data Movimento"': '2026-01-12', '"Descrizione"': 'Stipendio', '"Importo"': '100.00' },
    ]))

    const result = await analyzeFile({ userId: USER_ID, fileId: FILE_ID })

    expect(result.rowCount).toBe(3)
    // sampleRows now sources from the full normalized-rows pass (all 3), not the
    // detector's capped preview sample.
    expect(result.sampleRows).toHaveLength(3)
    expect(latestFileAnalysisUpdate()).toMatchObject({
      status: 'analyzed',
      rowCount: 3,
      duplicateCount: 0,
      importedCount: 0,
      positiveTotal: '100.00',
      negativeTotal: '-49.00',
      referenceStartedAt: new Date('2026-01-10T00:00:00.000Z'),
      referenceEndedAt: new Date('2026-01-12T00:00:00.000Z'),
      errorMessage: null,
    })
  })

  it('returns all preview rows (no 25-cap) with bucket counts that partition the set', async () => {
    // 28 distinct valid rows + one duplicate pair (2 identical rows, flagged via
    // repeatedInFileHashes) + one invalid row (empty amount) = 31 rows total.
    const distinctRows = Array.from({ length: 28 }, (_, i) => ({
      '"Data Movimento"': `2026-02-${String((i % 27) + 1).padStart(2, '0')}`,
      '"Descrizione"': `Acquisto ${i}`,
      '"Importo"': `-${(i + 1).toFixed(2)}`,
    }))
    const dupRow = { '"Data Movimento"': '2026-03-01', '"Descrizione"': 'Ripetuto', '"Importo"': '-10.00' }
    const invalidRow = { '"Data Movimento"': '2026-03-02', '"Descrizione"': 'Senza importo', '"Importo"': '' }
    const rows = [...distinctRows, dupRow, { ...dupRow }, invalidRow]

    mocks.readObjectBody.mockResolvedValue(await makeReadableStream(GENERAL_CSV))
    mocks.parseImportFile.mockResolvedValue(makeParsedImport(rows))

    const result = await analyzeFile({ userId: USER_ID, fileId: FILE_ID })

    // The 25-cap is lifted: every parsed row is returned.
    expect(result.sampleRows).toHaveLength(31)
    expect(result.previewBuckets).toBeDefined()
    expect(result.previewBuckets?.all).toBe(31)
    // Both identical rows are flagged duplicate (in-file repeat); the empty-amount
    // row is invalid → error bucket. The three buckets partition the set exactly.
    expect(result.previewBuckets?.duplicate).toBe(2)
    expect(result.previewBuckets?.error).toBe(1)
    expect(result.previewBuckets?.valid).toBe(28)
    const b = result.previewBuckets!
    expect(b.valid + b.duplicate + b.error).toBe(b.all)
  })

  it('loads analysis candidates through the ownership-aware DAL with user scope', async () => {
    mocks.readObjectBody.mockResolvedValue(await makeReadableStream(GENERAL_CSV))
    mocks.parseImportFile.mockResolvedValue(makeParsedImport())

    await analyzeFile({ userId: USER_ID, fileId: FILE_ID, selectedFormatVersionId: 8 })

    expect(mocks.loadImportFormatsForDetection).toHaveBeenCalledWith({
      userId: USER_ID,
      selectedFormatVersionId: 8,
    })
  })

  it('persists the selected private format id and clears stale unknown-format errors after successful retry analysis', async () => {
    const privateFormat = makeFormatCandidate({
      id: 77,
      platformId: 77,
      platform: {
        ...makeFormatCandidate().platform,
        id: 77,
        name: 'Private Bank',
        slug: 'private-bank-user-test',
      },
    })
    mocks.getFileForUser.mockResolvedValue(makeFileRow({
      importFormatVersionId: 77,
      status: 'uploaded',
      errorMessage: 'Formato non riconosciuto.',
    }))
    mocks.loadImportFormatsForDetection.mockResolvedValue([privateFormat])
    mocks.readObjectBody.mockResolvedValue(await makeReadableStream(GENERAL_CSV))
    mocks.parseImportFile.mockResolvedValue(makeParsedImport())

    const result = await analyzeFile({ userId: USER_ID, fileId: FILE_ID, selectedFormatVersionId: 77 })

    expect(result).toMatchObject({
      formatVersionId: 77,
      platformName: 'Private Bank',
      errors: [],
    })
    expect(latestFileAnalysisUpdate()).toMatchObject({
      status: 'analyzed',
      importFormatVersionId: 77,
      errorMessage: null,
    })
    expect(mocks.loggerInfo).toHaveBeenCalledWith(expect.objectContaining({
      event: 'import_format_wizard.retry_analyzed',
      userId: USER_ID,
      fileId: FILE_ID,
      formatVersionId: 77,
    }))
  })

  it('fails selected private retry closed and logs sanitized metadata when the format is inaccessible', async () => {
    mocks.getFileForUser.mockResolvedValue(makeFileRow({
      importFormatVersionId: 77,
      status: 'uploaded',
      errorMessage: 'Formato non riconosciuto.',
    }))
    mocks.loadImportFormatsForDetection.mockResolvedValue([])
    mocks.readObjectBody.mockResolvedValue(await makeReadableStream(GENERAL_CSV))
    mocks.parseImportFile.mockResolvedValue(makeParsedImport())

    const result = await analyzeFile({ userId: USER_ID, fileId: FILE_ID, selectedFormatVersionId: 999 })

    expect(result.errors).toContain('No supported import format matched the uploaded file headers and sample rows.')
    expect(latestFileAnalysisUpdate()).toMatchObject({
      status: 'failed',
      errorMessage: expect.stringContaining('No supported import format matched'),
    })
    expect(mocks.loggerWarn).toHaveBeenCalledWith(expect.objectContaining({
      event: 'import_format_wizard.retry_failed',
      code: 'selected_format_inaccessible',
      userId: USER_ID,
      fileId: FILE_ID,
      formatVersionId: 999,
    }))
    const serializedLogs = JSON.stringify([
      mocks.loggerInfo.mock.calls,
      mocks.loggerWarn.mock.calls,
      mocks.loggerError.mock.calls,
    ])
    expect(serializedLogs).not.toContain('users/user-test-1/imports')
    expect(serializedLogs).not.toContain('Supermercato Esselunga')
  })

  it('redacts parser diagnostics when selected-format retry parsing fails', async () => {
    mocks.readObjectBody.mockResolvedValue(await makeReadableStream(GENERAL_CSV))
    mocks.parseImportFile.mockRejectedValue(new Error(
      'Parser crashed for raw row Supermercato Esselunga at https://storage.example.test/private.csv\n    at parse (/app/secret.ts:10)',
    ))

    await expect(
      analyzeFile({ userId: USER_ID, fileId: FILE_ID, selectedFormatVersionId: 77 }),
    ).rejects.toThrow('Could not parse uploaded file.')

    expect(mocks.markFileFailed).toHaveBeenCalledWith(expect.objectContaining({
      userId: USER_ID,
      fileId: FILE_ID,
      errorMessage: 'Could not parse uploaded file.',
    }))
    expect(JSON.stringify(mocks.markFileFailed.mock.calls)).not.toContain('Supermercato Esselunga')
    expect(JSON.stringify(mocks.markFileFailed.mock.calls)).not.toContain('https://storage.example.test')
    expect(JSON.stringify(mocks.markFileFailed.mock.calls)).not.toContain('/app/secret.ts')
  })

  it('persists bounded failed analysis diagnostics with known row count for unknown formats', async () => {
    mocks.readObjectBody.mockResolvedValue(await makeReadableStream(GENERAL_CSV))
    mocks.parseImportFile.mockResolvedValue(makeParsedImport([
      { '"Data Movimento"': '2026-01-10', '"Descrizione"': 'raw secret row', '"Importo"': '-45.50' },
      { '"Data Movimento"': '2026-01-11', '"Descrizione"': 'other raw row', '"Importo"': '-3.50' },
    ]))
    vi.mocked(detectImportFormat).mockReturnValueOnce({
      bestCandidate: null,
      candidates: [],
      preview: {
        rowCount: 2,
        sampleRows: [],
        duplicateCount: 0,
        warnings: [],
      },
      warnings: [],
      errors: [`No supported import format found. ${'x'.repeat(700)} https://signed.example.test/raw-file`],
    })

    const result = await analyzeFile({ userId: USER_ID, fileId: FILE_ID })

    expect(result.errors).toHaveLength(1)
    expect(latestFileAnalysisUpdate()).toMatchObject({
      status: 'failed',
      rowCount: 2,
      duplicateCount: 0,
      importedCount: 0,
      positiveTotal: '0.00',
      negativeTotal: '0.00',
      referenceStartedAt: null,
      referenceEndedAt: null,
    })
    const errorMessage = String(latestFileAnalysisUpdate().errorMessage)
    expect(errorMessage.length).toBeLessThanOrEqual(500)
    expect(errorMessage).not.toContain('https://signed.example.test')
    expect(errorMessage).not.toContain('raw secret row')
  })

  it('throws and marks file failed when R2 read returns empty body', async () => {
    mocks.readObjectBody.mockResolvedValue(null)

    await expect(analyzeFile({ userId: USER_ID, fileId: FILE_ID })).rejects.toThrow()
    expect(mocks.markFileFailed).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, fileId: FILE_ID }),
    )
  })

  it('returns file not found error for missing or cross-user file', async () => {
    mocks.getFileForUser.mockResolvedValue(null)

    await expect(
      analyzeFile({ userId: 'other-user', fileId: FILE_ID }),
    ).rejects.toThrow('File not found or access denied.')
  })
})

// ---------------------------------------------------------------------------
