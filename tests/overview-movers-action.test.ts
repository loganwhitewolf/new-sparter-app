import { beforeEach, describe, expect, it, vi } from 'vitest'

// 68-03 (Pitfall 4): tests/overview-movers.test.tsx only covers the pure
// overview-movers-format.ts helpers, not the fetchMovers Server Action itself.
// No prior test file exercised fetchMovers's tagId threading/defensive bound
// (the plan's own acceptance criteria requires this behavior be testable), so
// this is a new dedicated unit test file — Rule 2 (missing test coverage).

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  getMonthOverMonthCategoryChanges: vi.fn(),
}))

vi.mock('@/lib/dal/auth', () => ({ verifySession: mocks.verifySession }))
vi.mock('@/lib/dal/overview', () => ({
  getMonthOverMonthCategoryChanges: mocks.getMonthOverMonthCategoryChanges,
}))

const { fetchMovers } = await import('@/lib/actions/overview')

describe('fetchMovers tagId threading (68-03, Pitfall 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifySession.mockResolvedValue({ userId: 'user-123' })
    mocks.getMonthOverMonthCategoryChanges.mockResolvedValue([])
  })

  it('no tagId: forwards undefined as the 5th argument (unchanged behavior)', async () => {
    await fetchMovers(2026, 3, 'out')

    expect(mocks.getMonthOverMonthCategoryChanges).toHaveBeenCalledWith(2026, 3, 'out', 10, undefined)
  })

  it('tagId=5: forwards 5 as the 5th argument', async () => {
    await fetchMovers(2026, 3, 'out', 5)

    expect(mocks.getMonthOverMonthCategoryChanges).toHaveBeenCalledWith(2026, 3, 'out', 10, 5)
  })

  it('tagId=-1 (non-positive): dropped, forwards undefined (not passed through as -1)', async () => {
    await fetchMovers(2026, 3, 'out', -1)

    expect(mocks.getMonthOverMonthCategoryChanges).toHaveBeenCalledWith(2026, 3, 'out', 10, undefined)
  })

  it('tagId=1.5 (non-integer): dropped, forwards undefined (not passed through as 1.5)', async () => {
    await fetchMovers(2026, 3, 'out', 1.5)

    expect(mocks.getMonthOverMonthCategoryChanges).toHaveBeenCalledWith(2026, 3, 'out', 10, undefined)
  })

  it('tagId=0 (falsy, non-positive): dropped, forwards undefined', async () => {
    await fetchMovers(2026, 3, 'out', 0)

    expect(mocks.getMonthOverMonthCategoryChanges).toHaveBeenCalledWith(2026, 3, 'out', 10, undefined)
  })

  it('reselecting month with an active tag filter still forwards the tagId (Pitfall 4 regression)', async () => {
    // Simulates the client re-calling fetchMovers after a month-bar click while
    // a tag filter is active — the tagId must not be silently dropped.
    await fetchMovers(2026, 5, 'out', 7)
    await fetchMovers(2026, 6, 'out', 7)

    expect(mocks.getMonthOverMonthCategoryChanges).toHaveBeenNthCalledWith(1, 2026, 5, 'out', 10, 7)
    expect(mocks.getMonthOverMonthCategoryChanges).toHaveBeenNthCalledWith(2, 2026, 6, 'out', 10, 7)
  })
})
