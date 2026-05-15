import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  betterAuthGet: vi.fn(),
  betterAuthPost: vi.fn(),
  toNextJsHandler: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@/auth', () => ({
  auth: { id: 'mock-auth' },
}))

vi.mock('better-auth/next-js', () => ({
  toNextJsHandler: mocks.toNextJsHandler,
}))

mocks.toNextJsHandler.mockReturnValue({
  GET: mocks.betterAuthGet,
  POST: mocks.betterAuthPost,
})

const { GET, POST } = await import('../app/api/auth/[...all]/route')
const { REGISTRATION_DISABLED_MESSAGE } = await import('@/lib/auth/registration')

function authRequest(path: string, init: RequestInit = {}) {
  return new Request(`http://localhost${path}`, {
    method: init.method ?? 'POST',
    ...init,
  })
}

describe('Better Auth route registration guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.REGISTRATION_ENABLED
    mocks.betterAuthGet.mockResolvedValue(Response.json({ delegated: 'get' }, { status: 200 }))
    mocks.betterAuthPost.mockResolvedValue(Response.json({ delegated: 'post' }, { status: 202 }))
  })

  it('returns sanitized 403 JSON for disabled direct email signup without delegating to Better Auth', async () => {
    process.env.REGISTRATION_ENABLED = 'false'

    const request = authRequest('/api/auth/sign-up/email', {
      body: JSON.stringify({ email: 'mario@example.test', password: 'password123' }),
      headers: { 'Content-Type': 'application/json', Cookie: 'session=secret' },
    })

    const response = await POST(request)
    const body = await response.json()
    const serializedBody = JSON.stringify(body)

    expect(response.status).toBe(403)
    expect(body).toEqual({
      error: {
        code: 'registration_disabled',
        message: REGISTRATION_DISABLED_MESSAGE,
      },
    })
    expect(serializedBody).not.toContain('mario@example.test')
    expect(serializedBody).not.toContain('password123')
    expect(serializedBody).not.toContain('secret')
    expect(mocks.betterAuthPost).not.toHaveBeenCalled()
  })

  it('delegates disabled signin-like POST requests to Better Auth', async () => {
    process.env.REGISTRATION_ENABLED = 'false'
    const request = authRequest('/api/auth/sign-in/email')

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(202)
    expect(body).toEqual({ delegated: 'post' })
    expect(mocks.betterAuthPost).toHaveBeenCalledTimes(1)
    expect(mocks.betterAuthPost).toHaveBeenCalledWith(request)
  })

  it('delegates enabled signup POST requests to Better Auth', async () => {
    process.env.REGISTRATION_ENABLED = 'true'
    const request = authRequest('/api/auth/sign-up/email')

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(202)
    expect(body).toEqual({ delegated: 'post' })
    expect(mocks.betterAuthPost).toHaveBeenCalledTimes(1)
    expect(mocks.betterAuthPost).toHaveBeenCalledWith(request)
  })

  it('delegates GET requests without checking registration state', async () => {
    process.env.REGISTRATION_ENABLED = 'false'
    const request = authRequest('/api/auth/session', { method: 'GET' })

    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ delegated: 'get' })
    expect(mocks.betterAuthGet).toHaveBeenCalledWith(request)
    expect(mocks.betterAuthPost).not.toHaveBeenCalled()
  })
})
