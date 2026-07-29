import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  executeResult: { rows: [] as unknown[] },
}))

vi.mock('server-only', () => ({}))
vi.mock('react', () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }))
vi.mock('@/lib/dal/auth', () => ({ verifySession: mocks.verifySession }))
vi.mock('drizzle-orm', () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    op: 'sql',
    strings: Array.from(strings),
    values,
  }),
}))
vi.mock('@/lib/db', () => ({
  db: {
    execute: vi.fn(() => Promise.resolve(mocks.executeResult)),
  },
}))

describe('getMonthsWithData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifySession.mockResolvedValue({ userId: 'user-123' })
    mocks.executeResult.rows = []
  })

  describe("table = 'transactions'", () => {
    it('returns distinct YYYY-MM strings from transactions', async () => {
      mocks.executeResult.rows = [{ ym: '2026-05' }, { ym: '2026-04' }]
      const { getMonthsWithData } = await import('@/lib/dal/months-with-data')
      const result = await getMonthsWithData('transactions')
      expect(result).toEqual(['2026-05', '2026-04'])
    })

    it('calls verifySession to scope query to authenticated user', async () => {
      mocks.executeResult.rows = [{ ym: '2026-05' }]
      const { getMonthsWithData } = await import('@/lib/dal/months-with-data')
      await getMonthsWithData('transactions')
      expect(mocks.verifySession).toHaveBeenCalledOnce()
    })

    it('returns [] when user has no transaction rows', async () => {
      mocks.executeResult.rows = []
      const { getMonthsWithData } = await import('@/lib/dal/months-with-data')
      const result = await getMonthsWithData('transactions')
      expect(result).toEqual([])
    })

    // Phase 80, D-09/LENS-05: getMonthsWithData's 'transactions' branch becomes lens-aware.
    it("defaults to the 'cassa' cash-only query when lens is omitted (unchanged behavior)", async () => {
      mocks.executeResult.rows = [{ ym: '2026-05' }, { ym: '2026-04' }]
      const { getMonthsWithData } = await import('@/lib/dal/months-with-data')
      const result = await getMonthsWithData('transactions')
      expect(result).toEqual(['2026-05', '2026-04'])
    })

    it("'cassa' lens (explicit) is byte-identical to the omitted-lens call", async () => {
      mocks.executeResult.rows = [{ ym: '2026-05' }, { ym: '2026-04' }]
      const { getMonthsWithData } = await import('@/lib/dal/months-with-data')
      const result = await getMonthsWithData('transactions', 'cassa')
      expect(result).toEqual(['2026-05', '2026-04'])
    })

    it("'competenza' lens unions transaction months with amortization_instalment months", async () => {
      mocks.executeResult.rows = [{ ym: '2026-08' }, { ym: '2026-05' }, { ym: '2026-04' }]
      const { getMonthsWithData } = await import('@/lib/dal/months-with-data')
      const result = await getMonthsWithData('transactions', 'competenza')
      expect(result).toEqual(['2026-08', '2026-05', '2026-04'])
    })
  })

  describe("table = 'files'", () => {
    it('returns distinct YYYY-MM strings from files', async () => {
      mocks.executeResult.rows = [{ ym: '2026-05' }, { ym: '2026-04' }]
      const { getMonthsWithData } = await import('@/lib/dal/months-with-data')
      const result = await getMonthsWithData('files')
      expect(result).toEqual(['2026-05', '2026-04'])
    })

    it('calls verifySession to scope query to authenticated user', async () => {
      mocks.executeResult.rows = [{ ym: '2026-03' }]
      const { getMonthsWithData } = await import('@/lib/dal/months-with-data')
      await getMonthsWithData('files')
      expect(mocks.verifySession).toHaveBeenCalledOnce()
    })

    // Phase 80, D-09: 'files' branch ignores lens entirely — no amortization concept applies.
    it("'competenza' lens behaves identically to omitted/'cassa' lens (no amortization concept for files)", async () => {
      mocks.executeResult.rows = [{ ym: '2026-05' }, { ym: '2026-04' }]
      const { getMonthsWithData } = await import('@/lib/dal/months-with-data')
      const result = await getMonthsWithData('files', 'competenza')
      expect(result).toEqual(['2026-05', '2026-04'])
    })

    it('returns [] when user has no file rows', async () => {
      mocks.executeResult.rows = []
      const { getMonthsWithData } = await import('@/lib/dal/months-with-data')
      const result = await getMonthsWithData('files')
      expect(result).toEqual([])
    })
  })
})
