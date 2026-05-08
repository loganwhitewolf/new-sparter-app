import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ImportListRow } from '../lib/dal/imports'

const mocks = vi.hoisted(() => {
  class ImportDeleteError extends Error {
    constructor(
      public readonly code:
        | 'invalid_file_id'
        | 'import_not_found'
        | 'import_not_deletable'
        | 'delete_failed'
        | 'preview_failed',
      message: string,
    ) {
      super(message)
      this.name = 'ImportDeleteError'
    }
  }

  return {
    verifySession: vi.fn(),
    getImports: vi.fn(),
    updateImportDisplayName: vi.fn(),
    getImportDeletePreview: vi.fn(),
    deleteImport: vi.fn(),
    ImportDeleteError,
    revalidatePath: vi.fn(),
  }
})

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

vi.mock('@/lib/services/import-deletion', () => ({
  getImportDeletePreview: mocks.getImportDeletePreview,
  deleteImport: mocks.deleteImport,
  ImportDeleteError: mocks.ImportDeleteError,
}))

vi.mock('@/lib/validations/import', async () => {
  const actual = await vi.importActual<typeof import('../lib/validations/import')>(
    '../lib/validations/import',
  )
  return actual
})

const {
  deleteImportAction,
  loadMoreImports,
  previewImportDeletionAction,
  updateImportDisplayNameAction,
} = await import('../lib/actions/import')

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

const deletePreview = {
  fileId: '11111111-1111-4111-8111-111111111111',
  displayName: 'January import',
  transactionCount: 3,
  affectedExpenseIds: ['expense-1', 'expense-2'],
  recalculatedExpenseIds: ['expense-1'],
  deletedExpenseIds: ['expense-2'],
  preservedExpenseIds: [],
  counts: {
    transactions: 3,
    affectedExpenses: 2,
    recalculatedExpenses: 1,
    deletedExpenses: 1,
    preservedExpenses: 0,
  },
}

const deleteResult = {
  ...deletePreview,
  deletedFileId: '11111111-1111-4111-8111-111111111111',
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
    mocks.getImportDeletePreview.mockResolvedValue(deletePreview)
    mocks.deleteImport.mockResolvedValue(deleteResult)
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

  describe('previewImportDeletionAction', () => {
    it('validates the file id before auth or service work', async () => {
      const result = await previewImportDeletionAction(makeFormData({ fileId: 'not-a-uuid' }))

      expect(result.error).toBe('Importazione non valida.')
      expect(mocks.verifySession).not.toHaveBeenCalled()
      expect(mocks.getImportDeletePreview).not.toHaveBeenCalled()
    })

    it('uses only the session user id and returns safe preview counts', async () => {
      const result = await previewImportDeletionAction(
        makeFormData({ fileId: '11111111-1111-4111-8111-111111111111', userId: 'attacker-id' }),
      )

      expect(result).toEqual({ error: null, data: deletePreview })
      expect(mocks.getImportDeletePreview).toHaveBeenCalledWith({
        userId: 'user-abc',
        fileId: '11111111-1111-4111-8111-111111111111',
      })
      expect(JSON.stringify(result)).not.toContain('attacker-id')
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })

    it('returns a safe session error without calling the service when authentication fails', async () => {
      mocks.verifySession.mockRejectedValueOnce(new Error('NEXT_REDIRECT with stack and cookie secret'))

      const result = await previewImportDeletionAction(makeFormData({ fileId: '11111111-1111-4111-8111-111111111111' }))

      expect(result.error).toBe('Sessione scaduta. Accedi di nuovo per eliminare questa importazione.')
      expect(JSON.stringify(result)).not.toContain('NEXT_REDIRECT')
      expect(JSON.stringify(result)).not.toContain('cookie secret')
      expect(mocks.getImportDeletePreview).not.toHaveBeenCalled()
    })

    it('maps not-found service errors to safe localized messages', async () => {
      mocks.getImportDeletePreview.mockRejectedValueOnce(
        new mocks.ImportDeleteError('import_not_found', 'objectKey=secret stack trace'),
      )

      const result = await previewImportDeletionAction(makeFormData({ fileId: '11111111-1111-4111-8111-111111111111' }))

      expect(result.error).toBe('Importazione non trovata o accesso negato.')
      expect(JSON.stringify(result)).not.toContain('objectKey')
      expect(JSON.stringify(result)).not.toContain('stack trace')
    })
  })

  describe('deleteImportAction', () => {
    it('validates malformed ids before auth or service work', async () => {
      const result = await deleteImportAction({ error: null }, makeFormData({ fileId: 'bad-id' }))

      expect(result.error).toBe('Importazione non valida.')
      expect(mocks.verifySession).not.toHaveBeenCalled()
      expect(mocks.deleteImport).not.toHaveBeenCalled()
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })

    it('uses the session user id, returns the delete result, and revalidates affected routes', async () => {
      const result = await deleteImportAction(
        { error: null },
        makeFormData({ fileId: '11111111-1111-4111-8111-111111111111', userId: 'attacker-id' }),
      )

      expect(result).toEqual({ error: null, data: deleteResult })
      expect(mocks.deleteImport).toHaveBeenCalledWith({
        userId: 'user-abc',
        fileId: '11111111-1111-4111-8111-111111111111',
      })
      expect(mocks.revalidatePath).toHaveBeenCalledWith('/import')
      expect(mocks.revalidatePath).toHaveBeenCalledWith('/expenses')
      expect(mocks.revalidatePath).toHaveBeenCalledWith('/transactions')
      expect(JSON.stringify(result)).not.toContain('attacker-id')
    })

    it('returns a safe session error without calling the service when authentication fails', async () => {
      mocks.verifySession.mockRejectedValueOnce(new Error('NEXT_REDIRECT with stack and cookie secret'))

      const result = await deleteImportAction({ error: null }, makeFormData({ fileId: '11111111-1111-4111-8111-111111111111' }))

      expect(result.error).toBe('Sessione scaduta. Accedi di nuovo per eliminare questa importazione.')
      expect(mocks.deleteImport).not.toHaveBeenCalled()
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })

    it('maps not-deletable retries and unsafe thrown diagnostics to safe localized messages', async () => {
      mocks.deleteImport.mockRejectedValueOnce(
        new mocks.ImportDeleteError('import_not_deletable', 'presigned https://storage.example?signature=secret objectKey stack'),
      )

      const notDeletable = await deleteImportAction(
        { error: null },
        makeFormData({ fileId: '11111111-1111-4111-8111-111111111111' }),
      )

      mocks.deleteImport.mockRejectedValueOnce(
        new Error('FATAL SQL objectKey=users/user-abc/file.csv rawRow stack trace https://signed.example'),
      )

      const failed = await deleteImportAction(
        { error: null },
        makeFormData({ fileId: '11111111-1111-4111-8111-111111111111' }),
      )

      expect(notDeletable.error).toBe('Questa importazione non può essere eliminata o è già stata rimossa.')
      expect(failed.error).toBe('Impossibile eliminare l’importazione. Riprova tra qualche secondo.')
      for (const result of [notDeletable, failed]) {
        expect(JSON.stringify(result)).not.toContain('objectKey')
        expect(JSON.stringify(result)).not.toContain('rawRow')
        expect(JSON.stringify(result)).not.toContain('stack')
        expect(JSON.stringify(result)).not.toContain('https://')
      }
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })
  })
})
