import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks (vi.hoisted runs before module imports)
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  getPlatformIdForUserFile: vi.fn(),
  discoverRegexCandidates: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/dal/auth', () => ({
  verifySession: mocks.verifySession,
}))

vi.mock('@/lib/dal/files', () => ({
  getFileForUser: vi.fn(),
  getPlatformIdForUserFile: mocks.getPlatformIdForUserFile,
}))

vi.mock('@/lib/services/regex-discovery', () => ({
  discoverRegexCandidates: mocks.discoverRegexCandidates,
}))

// Mock other imports used by import.ts but not relevant to recheckRegexAction
vi.mock('@/lib/services/import', () => ({
  analyzeFile: vi.fn(),
  importFile: vi.fn(),
}))

vi.mock('@/lib/services/import-format-wizard', () => ({
  ImportFormatWizardError: class ImportFormatWizardError extends Error {},
  createPrivateImportFormat: vi.fn(),
  loadImportFormatWizardContext: vi.fn(),
}))

vi.mock('@/lib/services/import-deletion', () => ({
  ImportDeleteError: class ImportDeleteError extends Error {},
  deleteImport: vi.fn(),
  getImportDeletePreview: vi.fn(),
}))

vi.mock('@/lib/dal/imports', () => ({
  getImports: vi.fn(),
  IMPORT_LIST_LIMIT: 50,
  updateImportDisplayName: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    delete: vi.fn(() => ({ where: vi.fn() })),
    transaction: vi.fn(),
  },
}))

vi.mock('@/lib/db/schema', () => ({
  file: { id: 'file.id', userId: 'file.userId' },
}))

vi.mock('drizzle-orm', () => ({
  and: vi.fn(),
  eq: vi.fn(),
}))

vi.mock('@/lib/routes', () => ({
  APP_ROUTES: {
    import: '/import',
    expenses: '/expenses',
    transactions: '/transactions',
    onboarding: '/onboarding',
  },
  ONBOARDING_AFTER_PRIVATE_PLATFORM_CREATION_ROUTE: '/onboarding?step=2',
}))

vi.mock('@/lib/validations/import', () => ({
  AnalyzeImportSchema: { safeParse: vi.fn() },
  CreatePrivateImportFormatSchema: { safeParse: vi.fn() },
  DeleteImportSchema: { safeParse: vi.fn() },
  ImportFileSchema: { safeParse: vi.fn() },
  LoadImportFormatWizardContextSchema: { safeParse: vi.fn() },
  UpdateImportDisplayNameSchema: { safeParse: vi.fn() },
  parseImportFilters: vi.fn((f) => f),
}))

// ---------------------------------------------------------------------------
// Import the action under test (after all mocks are set up)
// ---------------------------------------------------------------------------
import { recheckRegexAction } from '../lib/actions/import'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
function makeFormData(fileId?: string): FormData {
  const fd = new FormData()
  if (fileId !== undefined) {
    fd.set('fileId', fileId)
  }
  return fd
}

const MOCK_USER_ID = 'user-abc-123'
const MOCK_PLATFORM_ID = 42
const MOCK_DISCOVERY_RESULT = {
  candidates: [{ sampleNormalized: 'Bonifico Andrea', pattern: 'Bonifico.*' }],
  singleCategorizationSuggestions: [{ normalizedDescription: 'Macellaio', matchCount: 3, sampleDescriptions: ['Macellaio'], descriptionHashes: ['h1'] }],
  totalUncategorized: 10,
  platformId: MOCK_PLATFORM_ID,
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('recheckRegexAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifySession.mockResolvedValue({ userId: MOCK_USER_ID })
    mocks.getPlatformIdForUserFile.mockResolvedValue(MOCK_PLATFORM_ID)
    mocks.discoverRegexCandidates.mockResolvedValue(MOCK_DISCOVERY_RESULT)
  })

  // Test 1: happy path — valid fileId owned by user
  it('returns candidatesCount, singleCount and platformId on success', async () => {
    const result = await recheckRegexAction(makeFormData('file-123'))

    expect(result.error).toBeNull()
    expect(result.data).toEqual({
      candidatesCount: 1,
      singleCount: 1,
      platformId: MOCK_PLATFORM_ID,
    })
  })

  // Test 2: missing fileId → error, service never called
  it('returns an Italian error and does not call the service when fileId is missing', async () => {
    const result = await recheckRegexAction(makeFormData())

    expect(result.error).toBeTruthy()
    expect(result.error).toMatch(/non valido/i)
    expect(mocks.discoverRegexCandidates).not.toHaveBeenCalled()
  })

  // Test 2b: blank fileId → same behaviour
  it('returns an Italian error for a blank fileId', async () => {
    const result = await recheckRegexAction(makeFormData('   '))

    expect(result.error).toBeTruthy()
    expect(mocks.discoverRegexCandidates).not.toHaveBeenCalled()
  })

  // Test 3: getPlatformIdForUserFile returns null (IDOR guard) → error, service never called
  it('returns an Italian error and does not call the service when platformId is null (IDOR guard)', async () => {
    mocks.getPlatformIdForUserFile.mockResolvedValue(null)

    const result = await recheckRegexAction(makeFormData('foreign-file'))

    expect(result.error).toBeTruthy()
    expect(result.error).toMatch(/piattaforma/i)
    expect(mocks.discoverRegexCandidates).not.toHaveBeenCalled()
  })

  // Test 4: discoverRegexCandidates throws → Italian retry error, no exception propagated
  it('returns an Italian retry error when discoverRegexCandidates throws', async () => {
    mocks.discoverRegexCandidates.mockRejectedValue(new Error('DB error'))

    const result = await recheckRegexAction(makeFormData('file-123'))

    expect(result.error).toBeTruthy()
    expect(result.error).toMatch(/riprova/i)
    // Confirm no exception propagated (result is defined, not a thrown error)
    expect(result.data).toBeUndefined()
  })

  // Test 5: userId comes exclusively from verifySession, never from client
  it('calls verifySession and passes its userId to ownership guard and service', async () => {
    await recheckRegexAction(makeFormData('file-123'))

    // verifySession must be called
    expect(mocks.verifySession).toHaveBeenCalled()

    // Ownership guard uses verifySession userId
    expect(mocks.getPlatformIdForUserFile).toHaveBeenCalledWith({
      userId: MOCK_USER_ID,
      fileId: 'file-123',
    })

    // Service uses verifySession userId
    expect(mocks.discoverRegexCandidates).toHaveBeenCalledWith({
      userId: MOCK_USER_ID,
      scope: { platformId: MOCK_PLATFORM_ID },
    })
  })
})
