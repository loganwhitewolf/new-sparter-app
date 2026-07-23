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

  // D-07: allowlist SoT + smart root (BRAND-04, BRAND-05)
  it('allows anonymous marketing home without redirect to login', async () => {
    mocks.getAuthSessionOrNull.mockResolvedValue(null)

    const response = await proxy(request('/'))

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })

  it('redirects authenticated home to dashboard', async () => {
    mocks.getAuthSessionOrNull.mockResolvedValue({ user: { id: 'u1' } })

    const response = await proxy(request('/'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://app.example.test/dashboard')
  })

  it('allows authenticated marketing deep link', async () => {
    mocks.getAuthSessionOrNull.mockResolvedValue({ user: { id: 'u1' } })

    const response = await proxy(request('/how-it-works'))

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })

  it('still gates non-allowlisted paths for anonymous users', async () => {
    mocks.getAuthSessionOrNull.mockResolvedValue(null)

    const response = await proxy(request('/dashboard'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://app.example.test/login')
  })

  it('redirects authenticated users away from the login page', async () => {
    mocks.getAuthSessionOrNull.mockResolvedValue({ user: { id: 'u1' } })

    const response = await proxy(request('/login'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://app.example.test/dashboard')
  })

  it('redirects authenticated users away from the register page', async () => {
    mocks.getAuthSessionOrNull.mockResolvedValue({ user: { id: 'u1' } })

    const response = await proxy(request('/register'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://app.example.test/dashboard')
  })
})
