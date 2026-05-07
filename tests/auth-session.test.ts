import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}))

vi.mock('@/auth', () => ({
  auth: {
    api: {
      getSession: mocks.getSession,
    },
  },
}))

const { getAuthSessionOrNull, isRecoverableAuthSessionError } = await import('../lib/auth-session')

function apiError({
  status = 'UNAUTHORIZED',
  statusCode = 401,
  code = 'FAILED_TO_GET_SESSION',
  message = 'Failed to get session',
}: {
  status?: string | number
  statusCode?: number
  code?: string
  message?: string
} = {}) {
  return Object.assign(new Error(message), {
    name: 'APIError',
    status,
    statusCode,
    body: { code, message },
  })
}

beforeEach(() => {
  mocks.getSession.mockReset()
})

describe('auth session helper', () => {
  it('returns the Better Auth session when lookup succeeds', async () => {
    const headers = new Headers({ cookie: 'better-auth.session_token=valid' })
    const session = { user: { id: 'user-1', email: 'user@example.test' } }
    mocks.getSession.mockResolvedValue(session)

    await expect(getAuthSessionOrNull(headers)).resolves.toBe(session)
    expect(mocks.getSession).toHaveBeenCalledWith({ headers })
  })

  it('treats an expired/invalid session token as an anonymous session instead of throwing', async () => {
    const expiredTokenError = apiError()
    mocks.getSession.mockRejectedValue(expiredTokenError)

    await expect(getAuthSessionOrNull(new Headers())).resolves.toBeNull()
    expect(isRecoverableAuthSessionError(expiredTokenError)).toBe(true)
  })

  it('does not hide non-auth backend failures', async () => {
    const databaseError = apiError({
      status: 'INTERNAL_SERVER_ERROR',
      statusCode: 500,
      code: 'FAILED_TO_GET_SESSION',
      message: 'Failed to get session',
    })
    mocks.getSession.mockRejectedValue(databaseError)

    await expect(getAuthSessionOrNull(new Headers())).rejects.toBe(databaseError)
    expect(isRecoverableAuthSessionError(databaseError)).toBe(false)
  })
})
