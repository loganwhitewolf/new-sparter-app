import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ImportListRow } from '../lib/dal/imports'

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  getImports: vi.fn(),
  updateImportDisplayName: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('react', () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))

vi.mock('@/lib/dal/auth', () => ({
  verifySession: mocks.verifySession,
}))

vi.mock('@/lib/dal/imports', () => ({
  IMPORT_LIST_LIMIT: 50,
  getImports: mocks.getImports,
  updateImportDisplayName: mocks.updateImportDisplayName,
}))

vi.mock('@/lib/validations/import', async () => {
  const actual = await vi.importActual<typeof import('../lib/validations/import')>(
    '../lib/validations/import',
  )
  return actual
})

const { loadMoreImports, updateImportDisplayNameAction } = await import('../lib/actions/import')

const userSession = {
  userId: 'user-abc',
  email: 'user@example.test',
  subscriptionPlan: 'free' as const,
  role: 'user' as const,
}

const importRow: ImportListRow = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: 'January import',
  originalName: 'fineco.csv',
  status: 'imported',
  platformId: 1,
  platformName: 'Fineco',
  platformSlug: 'fineco',
  uploadedAt: new Date('2026-01-01T00:00:00.000Z'),
  analyzedAt: new Date('2026-01-01T00:01:00.000Z'),
  importStartedAt: new Date('2026-01-01T00:02:00.000Z'),
  importedAt: new Date('2026-01-01T00:03:00.000Z'),
  rowCount: 3,
  importedCount: 2,
  duplicateCount: 1,
  positiveTotal: '10.00',
  negativeTotal: '-2.00',
  referenceStartedAt: new Date('2025-12-01T00:00:00.000Z'),
  referenceEndedAt: new Date('2025-12-31T00:00:00.000Z'),
  errorMessage: null,
}

function makeFormData(fields: Record<string, string | null>): FormData {
  const fd = new FormData()

  for (const [key, value] of Object.entries(fields)) {
    if (value !== null) {
      fd.append(key, value)
    }
  }

  return fd
}

function validRenameForm(overrides: Record<string, string | null> = {}) {
  return makeFormData({
    fileId: '11111111-1111-4111-8111-111111111111',
    displayName: 'January import',
    ...overrides,
  })
}

describe('import Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifySession.mockResolvedValue(userSession)
    mocks.getImports.mockResolvedValue([importRow])
    mocks.updateImportDisplayName.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      displayName: 'January import',
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    })
  })

  describe('loadMoreImports', () => {
    it('parses filters, normalizes the offset, and returns bounded import rows', async () => {
      const result = await loadMoreImports({
        filters: {
          q: '  fineco ',
          importedFrom: '2026-01-01',
          importedTo: '2026-01-31',
          referenceFrom: '2025-12-01',
          referenceTo: '2025-12-31',
        },
        offset: 50,
      })

      expect(result).toEqual({ imports: [importRow], hasMore: false, error: null })
      expect(mocks.getImports).toHaveBeenCalledWith(
        {
          q: 'fineco',
          importedFrom: '2026-01-01',
          importedTo: '2026-01-31',
          referenceFrom: '2025-12-01',
          referenceTo: '2025-12-31',
          importedFromDate: new Date('2026-01-01T00:00:00.000Z'),
          importedToDate: new Date('2026-01-31T23:59:59.999Z'),
          referenceFromDate: new Date('2025-12-01T00:00:00.000Z'),
          referenceToDate: new Date('2025-12-31T23:59:59.999Z'),
        },
        { limit: 50, offset: 50 },
      )
    })

    it('normalizes negative and non-integer offsets to zero', async () => {
      await loadMoreImports({ offset: -10 })
      await loadMoreImports({ offset: 1.5 })

      expect(mocks.getImports).toHaveBeenNthCalledWith(1, {}, { limit: 50, offset: 0 })
      expect(mocks.getImports).toHaveBeenNthCalledWith(2, {}, { limit: 50, offset: 0 })
    })

    it('reports hasMore when the bounded read returns one full page', async () => {
      mocks.getImports.mockResolvedValueOnce(Array.from({ length: 50 }, (_, index) => ({
        ...importRow,
        id: `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`,
      })))

      const result = await loadMoreImports({ offset: 0 })

      expect(result.hasMore).toBe(true)
      expect(result.error).toBeNull()
    })

    it('returns a safe localized error without leaking DAL diagnostics', async () => {
      mocks.getImports.mockRejectedValueOnce(new Error('objectKey=users/user-abc/imports/file.csv stack trace'))

      const result = await loadMoreImports({ offset: 0 })

      expect(result.imports).toEqual([])
      expect(result.hasMore).toBe(false)
      expect(result.error).toBe('Non è stato possibile caricare altre importazioni. Riprova.')
      expect(JSON.stringify(result)).not.toContain('objectKey')
      expect(JSON.stringify(result)).not.toContain('stack trace')
    })
  })

  describe('updateImportDisplayNameAction', () => {
    it('renames using the session user id and revalidates /import on success', async () => {
      const result = await updateImportDisplayNameAction(
        { error: null },
        validRenameForm({ userId: 'attacker-id', displayName: '  January import  ' }),
      )

      expect(result).toEqual({ error: null })
      expect(mocks.verifySession).toHaveBeenCalledTimes(1)
      expect(mocks.updateImportDisplayName).toHaveBeenCalledWith(expect.anything(), {
        userId: 'user-abc',
        fileId: '11111111-1111-4111-8111-111111111111',
        displayName: 'January import',
      })
      expect(mocks.revalidatePath).toHaveBeenCalledWith('/import')
    })

    it('allows a blank display name to clear the custom import name', async () => {
      const result = await updateImportDisplayNameAction(
        { error: null },
        validRenameForm({ displayName: '   ' }),
      )

      expect(result).toEqual({ error: null })
      expect(mocks.updateImportDisplayName).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        displayName: '',
      }))
      expect(mocks.revalidatePath).toHaveBeenCalledWith('/import')
    })

    it('returns validation errors without verifying session or writing for malformed ids', async () => {
      const result = await updateImportDisplayNameAction(
        { error: null },
        validRenameForm({ fileId: 'not-a-uuid' }),
      )

      expect(result.error).toBe('Invalid file id.')
      expect(mocks.verifySession).not.toHaveBeenCalled()
      expect(mocks.updateImportDisplayName).not.toHaveBeenCalled()
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })

    it('returns validation errors without writing for missing ids and oversized names', async () => {
      const missingId = await updateImportDisplayNameAction(
        { error: null },
        validRenameForm({ fileId: null }),
      )
      const oversizedName = await updateImportDisplayNameAction(
        { error: null },
        validRenameForm({ displayName: 'x'.repeat(256) }),
      )

      expect(missingId.error).toBe('Invalid file id.')
      expect(oversizedName.error).toBe('Import name is too long.')
      expect(mocks.updateImportDisplayName).not.toHaveBeenCalled()
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })

    it('returns a safe session error without calling the DAL when authentication fails', async () => {
      mocks.verifySession.mockRejectedValueOnce(new Error('NEXT_REDIRECT with stack and cookie secret'))

      const result = await updateImportDisplayNameAction({ error: null }, validRenameForm())

      expect(result.error).toBe('Sessione scaduta. Accedi di nuovo per rinominare questa importazione.')
      expect(result.error).not.toContain('NEXT_REDIRECT')
      expect(result.error).not.toContain('cookie secret')
      expect(mocks.updateImportDisplayName).not.toHaveBeenCalled()
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })

    it('returns a safe not-found error and does not revalidate when no user-owned import is updated', async () => {
      mocks.updateImportDisplayName.mockResolvedValueOnce(null)

      const result = await updateImportDisplayNameAction({ error: null }, validRenameForm())

      expect(result.error).toBe('Importazione non trovata o accesso negato.')
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })

    it('returns a generic localized error without leaking DAL failures', async () => {
      mocks.updateImportDisplayName.mockRejectedValueOnce(
        new Error('FATAL: objectKey users/user-abc/imports/file.csv raw rows stack trace'),
      )

      const result = await updateImportDisplayNameAction({ error: null }, validRenameForm())

      expect(result.error).toBe('Si è verificato un errore. Riprova tra qualche secondo.')
      expect(JSON.stringify(result)).not.toContain('objectKey')
      expect(JSON.stringify(result)).not.toContain('raw rows')
      expect(JSON.stringify(result)).not.toContain('stack trace')
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })
  })
})
