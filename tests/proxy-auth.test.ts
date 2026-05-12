import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getAuthSessionOrNull: vi.fn(),
}))

vi.mock('@/lib/auth-session', () => ({
  getAuthSessionOrNull: mocks.getAuthSessionOrNull,
}))

const { proxy } = await import('../proxy')

function request(path: string, headers?: Record<string, string>) {
  return new NextRequest(`https://app.example.test${path}`, { headers })
}

beforeEach(() => {
  vi.unstubAllEnvs()
  mocks.getAuthSessionOrNull.mockReset()
})

describe('proxy auth handling', () => {
  it('redirects protected app routes to login when the auth session is unavailable', async () => {
    mocks.getAuthSessionOrNull.mockResolvedValue(null)

    const response = await proxy(request('/dashboard'))

    expect(mocks.getAuthSessionOrNull).toHaveBeenCalledWith(expect.any(Headers))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://app.example.test/login')
  })

  it('allows the login page when the auth session is unavailable', async () => {
    mocks.getAuthSessionOrNull.mockResolvedValue(null)

    const response = await proxy(request('/login'))

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })

  it('passes Server Action requests through without session check or redirect', async () => {
    // Server Actions on auth routes (e.g. /register) would otherwise receive a
    // 307 redirect once Better Auth sets the session cookie during autoSignIn —
    // breaking the RSC response format the client expects.
    const response = await proxy(
      request('/register', { 'next-action': 'abc123' })
    )

    expect(mocks.getAuthSessionOrNull).not.toHaveBeenCalled()
    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })
})
