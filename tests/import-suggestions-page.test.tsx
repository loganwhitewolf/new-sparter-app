import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  getFileForUser: vi.fn(),
  getUncategorizedTransactionsByFileId: vi.fn(),
  loadActivePatterns: vi.fn(),
  getCategories: vi.fn(),
  detectPatternSuggestions: vi.fn(),
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
}))

vi.mock('@/lib/dal/transactions', () => ({
  getUncategorizedTransactionsByFileId: mocks.getUncategorizedTransactionsByFileId,
}))

vi.mock('@/lib/dal/categories', () => ({
  getCategories: mocks.getCategories,
}))

vi.mock('@/lib/services/categorization', () => ({
  loadActivePatterns: mocks.loadActivePatterns,
}))

vi.mock('@/lib/utils/pattern-suggestions', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/utils/pattern-suggestions')>()
  return {
    ...original,
    detectPatternSuggestions: mocks.detectPatternSuggestions,
  }
})

// db is used as an argument only (not called); mock to avoid DB connection
vi.mock('@/lib/db', () => ({
  db: {},
}))

const FILE_ID = 'file-1'
const USER_ID = 'user-1'

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

function makeSuggestion(overrides: Record<string, unknown> = {}) {
  return {
    pattern: 'COFFEE SHOP',
    matchCount: 3,
    detectedAmountSign: 'negative' as const,
    sampleDescriptions: ['COFFEE SHOP 001', 'COFFEE SHOP 002', 'COFFEE SHOP 003'],
    ...overrides,
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

describe("suggestions page", () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.verifySession.mockReset()
    mocks.getFileForUser.mockReset()
    mocks.getUncategorizedTransactionsByFileId.mockReset()
    mocks.loadActivePatterns.mockReset()
    mocks.getCategories.mockReset()
    mocks.detectPatternSuggestions.mockReset()

    // Default happy-path setup
    mocks.verifySession.mockResolvedValue({ userId: USER_ID })
    mocks.getFileForUser.mockResolvedValue(makeFileRow())
    mocks.getUncategorizedTransactionsByFileId.mockResolvedValue([])
    mocks.loadActivePatterns.mockResolvedValue([])
    mocks.getCategories.mockResolvedValue([])
    mocks.detectPatternSuggestions.mockReturnValue([])
  })

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

  it('POST-01/POST-02 data flow: calls all DAL and service functions with correct args', async () => {
    mocks.getUncategorizedTransactionsByFileId.mockResolvedValue([
      { description: 'X', amount: '-1.00' },
    ])
    mocks.loadActivePatterns.mockResolvedValue([{ pattern: 'foo', amountSign: 'any' }])

    await renderPage()

    expect(mocks.getUncategorizedTransactionsByFileId).toHaveBeenCalledTimes(1)
    expect(mocks.getUncategorizedTransactionsByFileId).toHaveBeenCalledWith(
      expect.anything(), // db
      FILE_ID,
      USER_ID,
    )
    expect(mocks.loadActivePatterns).toHaveBeenCalledTimes(1)
    expect(mocks.loadActivePatterns).toHaveBeenCalledWith(expect.anything(), USER_ID)
    expect(mocks.getCategories).toHaveBeenCalledTimes(1)
  })

  it('POST-01/POST-02 adapter: maps DAL rows to PatternDetectorRow with correct shape', async () => {
    mocks.getUncategorizedTransactionsByFileId.mockResolvedValue([
      { description: 'X', amount: '-1.00' },
    ])
    await renderPage()

    const callArg = mocks.detectPatternSuggestions.mock.calls[0][0]
    expect(callArg).toHaveLength(1)
    expect(callArg[0]).toEqual({
      description: 'X',
      normalizedDescription: 'X',
      amount: '-1.00',
      valid: true,
      covered: false,
    })
  })

  it('D-04 sort+cap: passes at most 5 suggestions to render (sorted by matchCount desc)', async () => {
    const manySuggestions = [
      makeSuggestion({ pattern: 'A', matchCount: 1 }),
      makeSuggestion({ pattern: 'B', matchCount: 7 }),
      makeSuggestion({ pattern: 'C', matchCount: 3 }),
      makeSuggestion({ pattern: 'D', matchCount: 5 }),
      makeSuggestion({ pattern: 'E', matchCount: 2 }),
      makeSuggestion({ pattern: 'F', matchCount: 6 }),
      makeSuggestion({ pattern: 'G', matchCount: 4 }),
    ]
    mocks.detectPatternSuggestions.mockReturnValue(manySuggestions)
    mocks.getUncategorizedTransactionsByFileId.mockResolvedValue([
      { description: 'COFFEE SHOP 001', amount: '-2.00' },
    ])

    const html = await renderPage()

    // With 7 suggestions sorted and capped to 5, only top 5 matchCounts (7,6,5,4,3) appear
    // SuggestionSection renders count in h2: "Suggerimenti pattern (5)"
    expect(html).toContain('Suggerimenti pattern (5)')
    expect(html).not.toContain('Suggerimenti pattern (7)')
    expect(html).not.toContain('Suggerimenti pattern (6)')
  })

  it('D-07 empty state: renders inline message when no suggestions detected', async () => {
    mocks.detectPatternSuggestions.mockReturnValue([])

    const html = await renderPage()

    expect(html).toContain(
      'Nessun suggerimento trovato — tutte le transazioni risultano già categorizzate o non sono stati rilevati pattern ricorrenti.',
    )
    expect(html).not.toContain('Suggerimenti pattern (')
  })

  it('D-08 copy / SCOP-03: page contains required heading and subtitle, no forbidden reclassification copy', async () => {
    const html = await renderPage()

    expect(html).toContain('Suggerimenti pattern')
    expect(html).toContain(
      'Crea pattern per categorizzare automaticamente transazioni simili nelle prossime importazioni.',
    )
    expect(html).not.toMatch(/ricategorizz/i)
    expect(html).not.toMatch(/riclassific/i)
    expect(html).not.toMatch(/applica (ai|alle) transazion/i)
  })
})
