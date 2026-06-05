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

    it('returns [] when user has no file rows', async () => {
      mocks.executeResult.rows = []
      const { getMonthsWithData } = await import('@/lib/dal/months-with-data')
      const result = await getMonthsWithData('files')
      expect(result).toEqual([])
    })
  })
})
