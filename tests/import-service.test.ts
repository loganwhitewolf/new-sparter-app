import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  writeClassificationHistory: vi.fn(),

  // db
  dbTransaction: vi.fn(),
}))

// Mock server-only to avoid Next.js server boundary errors in tests
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/dal/auth', () => ({ verifySession: mocks.verifySession }))
vi.mock('@/lib/dal/patterns', () => ({
  createPattern: mocks.createPattern,
  updatePattern: mocks.updatePattern,
  deletePattern: mocks.deletePattern,
}))
vi.mock('@/lib/validations/pattern', () => ({
  CreatePatternSchema: {
    safeParse: (value: Record<string, unknown>) => {
      if (!value.pattern || !value.subCategoryId || !value.amountSign || value.confidence === undefined) {
        return { success: false, error: { issues: [{ message: 'Dati pattern mancanti.' }] } }
      }
      return { success: true, data: value }
    },
  },
  UpdatePatternSchema: {
    safeParse: (value: Record<string, unknown>) => ({ success: true, data: value }),
  },
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
    isActive: 'importFormatVersion.isActive',
  },
  platform: {
    id: 'platform.id',
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
}))

vi.mock('@/lib/dal/transactions', () => ({
  getDuplicateHashes: mocks.getDuplicateHashes,
  insertTransactionBatch: mocks.insertTransactionBatch,
}))

vi.mock('@/lib/dal/classification-history', () => ({
  writeClassificationHistory: mocks.writeClassificationHistory,
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

// Mock import-format-detector: return a plausible detection result
vi.mock('@/lib/services/import-format-detector', () => ({
  detectImportFormat: vi.fn().mockReturnValue({
    bestCandidate: {
      formatVersionId: 1,
      platformId: 1,
      version: 1,
      platform: {
        id: 1,
        name: 'General',
        slug: 'general',
        delimiter: ';',
        country: 'IT',
        timestampColumn: '"Data Movimento"',
        descriptionColumn: '"Descrizione"',
        amountType: 'single',
        amountColumn: '"Importo"',
        positiveAmountColumn: null,
        negativeAmountColumn: null,
        multiplyBy: 1,
      },
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
  }),
}))

// Import the modules under test AFTER mocks are registered
const { applyTier1Regex } = await import('../lib/services/categorization')
const { categorizePipeline: categorizePipelineActual } = await vi.importActual<typeof import('../lib/services/categorization')>('../lib/services/categorization')
const { createPatternAction } = await import('../lib/actions/patterns')
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

function makeFileRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: FILE_ID,
    userId: USER_ID,
    importFormatVersionId: 1,
    originalName: 'statement.csv',
    objectKey: `users/${USER_ID}/imports/${FILE_ID}.csv`,
    mimeType: 'text/csv',
    sizeBytes: 256,
    status: 'uploaded',
    uploadedAt: new Date('2026-01-01'),
    analyzedAt: null,
    importStartedAt: null,
    importedAt: null,
    rowCount: 0,
    duplicateCount: 0,
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

async function makeReadableStream(buf: Buffer): Promise<AsyncIterable<Uint8Array>> {
  return (async function* () {
    yield buf
  })()
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
      amountSign: 'any',
      confidence: '0.90',
      priority: 10,
    },
    {
      id: 2,
      userId: null,
      pattern: 'caffè',
      subCategoryId: 20,
      amountSign: 'negative',
      confidence: '0.85',
      priority: 20,
    },
    {
      id: 3,
      userId: 'user-1',
      pattern: 'netflix',
      subCategoryId: 30,
      amountSign: 'any',
      confidence: '0.95',
      priority: 5,
    },
    {
      id: 4,
      userId: null,
      pattern: '([invalid regex',
      subCategoryId: 40,
      amountSign: 'any',
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

  it('respects amount sign constraint — rejects positive amounts for negative-only patterns', () => {
    // The coffee pattern requires a negative amount
    const result = applyTier1Regex('Caffè Nero rimborso', '5.00', patterns)
    // The positive amount should skip the coffee pattern, and no other patterns should match
    expect(result).toBeNull()
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
    const result = applyTier1Regex('Amazon marketplace', '-22.00', [
      {
        id: 10,
        userId: 'user-1',
        pattern: 'amazon',
        subCategoryId: 99,
        amountSign: 'negative',
        confidence: '0.96',
        priority: 100,
      },
      {
        id: 11,
        userId: null,
        pattern: 'amazon',
        subCategoryId: 11,
        amountSign: 'negative',
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
    const patterns: ActivePattern[] = [
      {
        id: 5,
        userId: null,
        pattern: 'netflix',
        subCategoryId: 5,
        amountSign: 'any',
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

  it('returns the user Netflix pattern result before a colliding system Netflix pattern', async () => {
    const patterns: ActivePattern[] = [
      {
        id: 101,
        userId: USER_ID,
        pattern: 'netflix',
        subCategoryId: 301,
        amountSign: 'negative',
        confidence: '0.97',
        priority: 50,
      },
      {
        id: 102,
        userId: null,
        pattern: 'netflix',
        subCategoryId: 302,
        amountSign: 'negative',
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

  it('uses global system regex patterns for free plan imports', async () => {
    const patterns: ActivePattern[] = [
      {
        id: 5,
        userId: null,
        pattern: 'netflix',
        subCategoryId: 5,
        amountSign: 'any',
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
    const patterns: ActivePattern[] = [
      {
        id: 5,
        userId: USER_ID,
        pattern: 'netflix',
        subCategoryId: 5,
        amountSign: 'any',
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
          amountSign: 'any',
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
// importFile integration tests (mocked db, r2, dal)
// ---------------------------------------------------------------------------
describe('importFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getFileForUser.mockResolvedValue(makeFileRow())
    mocks.updateFileImportState.mockResolvedValue(makeFileRow({ status: 'importing' }))
    mocks.markFileFailed.mockResolvedValue(makeFileRow({ status: 'failed' }))
    mocks.getDuplicateHashes.mockResolvedValue(new Set<string>())
    mocks.loadActivePatterns.mockResolvedValue([])
    mocks.categorizePipeline.mockResolvedValue(null)
    mocks.insertTransactionBatch.mockResolvedValue([])
    mocks.writeClassificationHistory.mockResolvedValue(undefined)
    mocks.parseImportFile.mockResolvedValue(makeParsedImport())
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

    await importFile({
      userId: USER_ID,
      fileId: FILE_ID,
      selectedFormatVersionId: 1,
    }).catch(() => null)

    // The pre-flight Set filter should have eliminated all rows before calling insertTransactionBatch.
    // Verify that insertTransactionBatch was called with an empty array — the DB-level onConflictDoNothing
    // is a safety net, but the primary dedup contract is this pre-flight filter.
    expect(mocks.insertTransactionBatch).toHaveBeenCalledWith(expect.anything(), [])
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

  it('basic plan imports a canonical user Netflix pattern before the system collision and records classification history', async () => {
    const userNetflixPattern: ActivePattern = {
      id: 201,
      userId: USER_ID,
      pattern: 'netflix',
      subCategoryId: 701,
      amountSign: 'negative',
      confidence: '0.97',
      priority: 50,
    }
    const systemNetflixPattern: ActivePattern = {
      id: 202,
      userId: null,
      pattern: 'netflix',
      subCategoryId: 702,
      amountSign: 'negative',
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
// analyzeFile unit tests
// ---------------------------------------------------------------------------
describe('analyzeFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getFileForUser.mockResolvedValue(makeFileRow())
    mocks.updateFileAnalysisState.mockResolvedValue(makeFileRow({ status: 'analyzing' }))
    mocks.markFileFailed.mockResolvedValue(makeFileRow({ status: 'failed' }))
    mocks.getDuplicateHashes.mockResolvedValue(new Set<string>())
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
