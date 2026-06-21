/**
 * Tests for the /import/[fileId]/suggestions page after migration to discoverRegexCandidates.
 *
 * NOTE: detectPatternSuggestions retirement (deleting the function and
 * tests/pattern-suggestion-detector.test.ts) is deferred to Phase 55 because
 * analyzeFile (lib/services/import.ts) still consumes it.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  getFileForUser: vi.fn(),
  getPlatformIdForUserFile: vi.fn(),
  discoverRegexCandidates: vi.fn(),
  getCategories: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('notFound')
  }),
}))

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
}))

vi.mock('@/lib/dal/auth', () => ({
  verifySession: mocks.verifySession,
}))

vi.mock('@/lib/dal/files', () => ({
  getFileForUser: mocks.getFileForUser,
  getPlatformIdForUserFile: mocks.getPlatformIdForUserFile,
}))

vi.mock('@/lib/dal/categories', () => ({
  getCategories: mocks.getCategories,
}))

vi.mock('@/lib/services/regex-discovery', () => ({
  discoverRegexCandidates: mocks.discoverRegexCandidates,
}))

const FILE_ID = 'file-1'
const USER_ID = 'user-1'
const PLATFORM_ID = 2

function makeFileRow(overrides: Record<string, unknown> = {}) {
  return {
    id: FILE_ID,
    userId: USER_ID,
    status: 'imported' as const,
    originalName: 'file.csv',
    displayName: null,
    objectKey: 'uploads/file.csv',
    mimeType: 'text/csv',
    sizeBytes: 1024,
    contentHash: null,
    rowCount: 3,
    importedCount: 3,
    duplicateCount: 0,
    positiveTotal: '0.00',
    negativeTotal: '-15.00',
    referenceStartedAt: null,
    referenceEndedAt: null,
    errorMessage: null,
    uploadedAt: null,
    analyzedAt: null,
    importStartedAt: null,
    importedAt: null,
    ...overrides,
  }
}

function makeEmptyDiscovery() {
  return {
    candidates: [],
    singleCategorizationSuggestions: [],
    totalUncategorized: 0,
    platformId: PLATFORM_ID,
  }
}

async function renderPage(fileId = FILE_ID) {
  const { default: SuggestionsPage } = await import(
    '../app/(app)/import/[fileId]/suggestions/page'
  )
  const element = await SuggestionsPage({
    params: Promise.resolve({ fileId }),
  })
  return renderToStaticMarkup(createElement(() => element))
}

describe('suggestions page', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.verifySession.mockReset()
    mocks.getFileForUser.mockReset()
    mocks.getPlatformIdForUserFile.mockReset()
    mocks.discoverRegexCandidates.mockReset()
    mocks.getCategories.mockReset()
    mocks.notFound.mockReset()
    mocks.notFound.mockImplementation(() => {
      throw new Error('notFound')
    })

    // Default happy-path setup
    mocks.verifySession.mockResolvedValue({ userId: USER_ID })
    mocks.getFileForUser.mockResolvedValue(makeFileRow())
    mocks.getPlatformIdForUserFile.mockResolvedValue(PLATFORM_ID)
    mocks.discoverRegexCandidates.mockResolvedValue(makeEmptyDiscovery())
    mocks.getCategories.mockResolvedValue([])
  })

  // --- notFound guard tests (preserved from Phase 53) ---

  it('POST-03 ownership: calls notFound when getFileForUser returns null', async () => {
    mocks.getFileForUser.mockResolvedValue(null)
    await expect(renderPage()).rejects.toThrow('notFound')
    expect(mocks.notFound).toHaveBeenCalledTimes(1)
  })

  it('POST-03 ownership: calls notFound when file has status other than imported', async () => {
    mocks.getFileForUser.mockResolvedValue(makeFileRow({ status: 'analyzed' }))
    await expect(renderPage()).rejects.toThrow('notFound')
    expect(mocks.notFound).toHaveBeenCalledTimes(1)
  })

  it('POST-03 happy path: does not throw for an imported file owned by the user', async () => {
    await expect(renderPage()).resolves.toBeDefined()
  })

  it('APPLY-01 platform guard: calls notFound when getPlatformIdForUserFile returns null', async () => {
    mocks.getPlatformIdForUserFile.mockResolvedValue(null)
    await expect(renderPage()).rejects.toThrow('notFound')
    expect(mocks.notFound).toHaveBeenCalledTimes(1)
  })

  it('APPLY-01 platform guard: calls getPlatformIdForUserFile with userId and fileId after file guard passes', async () => {
    await renderPage()

    expect(mocks.getPlatformIdForUserFile).toHaveBeenCalledTimes(1)
    expect(mocks.getPlatformIdForUserFile).toHaveBeenCalledWith({
      userId: USER_ID,
      fileId: FILE_ID,
    })
  })

  it('APPLY-01 platform guard: does not call DAL queries when file guard fails (status not imported)', async () => {
    mocks.getFileForUser.mockResolvedValue(makeFileRow({ status: 'analyzed' }))
    await expect(renderPage()).rejects.toThrow('notFound')
    // getPlatformIdForUserFile must NOT be called when file guard already throws notFound
    expect(mocks.getPlatformIdForUserFile).not.toHaveBeenCalled()
  })

  // --- unified service call assertion ---

  it('D-04 service call: discoverRegexCandidates is called with { userId, scope: { platformId } }', async () => {
    await renderPage()

    expect(mocks.discoverRegexCandidates).toHaveBeenCalledTimes(1)
    expect(mocks.discoverRegexCandidates).toHaveBeenCalledWith({
      userId: USER_ID,
      scope: { platformId: PLATFORM_ID },
    })
  })

  // --- EUR deposit verification anchor (RDISC-02 fix) ---

  it('RDISC-02 anchor: 8 identical EUR deposit rows → 0 regex candidates, 1 single suggestion', async () => {
    // This is the Phase 53 UAT bug: the legacy detector surfaced identical descriptions
    // as regex candidates. discoverRegexCandidates routes them to singleCategorizationSuggestions.
    mocks.discoverRegexCandidates.mockResolvedValue({
      candidates: [],
      singleCategorizationSuggestions: [
        {
          normalizedDescription: 'eur deposit',
          sampleDescriptions: ['EUR deposit'],
          matchCount: 8,
          descriptionHashes: ['hash1', 'hash2', 'hash3', 'hash4', 'hash5', 'hash6', 'hash7', 'hash8'],
        },
      ],
      totalUncategorized: 8,
      platformId: PLATFORM_ID,
    })

    const html = await renderPage()

    // Must NOT contain any regex SuggestionCard (no promotable pattern)
    expect(html).not.toContain('Suggerimenti pattern (')
    // Must contain the single-categorization section
    expect(html).toContain('Transazioni identiche')
    expect(html).toContain('EUR deposit')
    expect(html).toContain('8')
  })

  it('single suggestion only: renders single list when candidates empty but singleSuggestions non-empty', async () => {
    mocks.discoverRegexCandidates.mockResolvedValue({
      candidates: [],
      singleCategorizationSuggestions: [
        {
          normalizedDescription: 'supermercato locale',
          sampleDescriptions: ['Supermercato Locale'],
          matchCount: 4,
          descriptionHashes: ['hashA', 'hashB', 'hashC', 'hashD'],
        },
      ],
      totalUncategorized: 4,
      platformId: PLATFORM_ID,
    })

    const html = await renderPage()

    expect(html).not.toContain('Suggerimenti pattern (')
    expect(html).toContain('Transazioni identiche')
    expect(html).toContain('Supermercato Locale')
    // Must not contain the empty-state message
    expect(html).not.toContain('Nessun suggerimento trovato')
  })

  // --- empty state ---

  it('empty state: renders inline message when both lists empty', async () => {
    mocks.discoverRegexCandidates.mockResolvedValue(makeEmptyDiscovery())

    const html = await renderPage()

    expect(html).toContain(
      'Nessun suggerimento trovato — tutte le transazioni risultano già categorizzate o non sono stati rilevati pattern ricorrenti.',
    )
    expect(html).not.toContain('Suggerimenti pattern (')
    expect(html).not.toContain('Transazioni identiche')
  })

  // --- page copy assertion ---

  it('D-08 copy: page contains required heading and subtitle', async () => {
    const html = await renderPage()

    expect(html).toContain('Suggerimenti pattern')
    // SUMUI-03: sub-heading communicates platform scope and re-check entry point
    expect(html).toContain('rilevati dalle transazioni non categorizzate di questa piattaforma')
    expect(html).toContain('tab Importazioni')
  })

  // --- SUMUI-02: SuggestionSection distinct headings ---

  it('SUMUI-02: SuggestionSection shows distinct headings for regex and single-cat groups', async () => {
    mocks.discoverRegexCandidates.mockResolvedValue({
      candidates: [
        {
          pattern: 'bonifico.*',
          sampleDescriptions: ['Bonifico Andrea'],
          matchCount: 3,
          stablePrefix: 'bonifico',
          strippedByNormalization: false,
          residualVariablePart: 'Andrea',
          sampleNormalized: 'bonifico andrea',
          descriptionHashes: ['h1', 'h2', 'h3'],
        },
      ],
      singleCategorizationSuggestions: [
        {
          normalizedDescription: 'macellaio',
          sampleDescriptions: ['Macellaio'],
          matchCount: 2,
          descriptionHashes: ['ha', 'hb'],
        },
      ],
      totalUncategorized: 5,
      platformId: PLATFORM_ID,
    })

    const html = await renderPage()

    // Section 1 heading
    expect(html).toContain('Pattern proposti')
    expect(html).toContain(
      'Crea un pattern per categorizzare automaticamente queste transazioni nelle importazioni future.',
    )
    // Section 2 heading (count preserved)
    expect(html).toContain('Transazioni identiche')
    expect(html).toContain('Categorizzale manualmente dalla pagina Spese.')
  })
})
