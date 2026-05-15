import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  signUpEmail: vi.fn(),
  headers: vi.fn(),
  redirect: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@/auth', () => ({
  auth: {
    api: {
      signInEmail: mocks.signInEmail,
      signUpEmail: mocks.signUpEmail,
    },
  },
}))

vi.mock('next/headers', () => ({ headers: mocks.headers }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))

const { signInAction, signUpAction } = await import('../lib/actions/auth')
const { REGISTRATION_DISABLED_MESSAGE } = await import('../lib/auth/registration')

function makeAuthFormData({
  email = 'mario@example.test',
  password = 'password123',
}: {
  email?: string
  password?: string
} = {}): FormData {
  const fd = new FormData()
  fd.append('email', email)
  fd.append('password', password)
  return fd
}

describe('auth actions registration guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.REGISTRATION_ENABLED
    mocks.headers.mockResolvedValue(new Headers({ cookie: 'session=abc' }))
  })

  it('returns the disabled-registration message without calling Better Auth signup or headers', async () => {
    process.env.REGISTRATION_ENABLED = 'false'

    const result = await signUpAction({ error: null }, makeAuthFormData())

    expect(result).toEqual({ error: REGISTRATION_DISABLED_MESSAGE })
    expect(mocks.signUpEmail).not.toHaveBeenCalled()
    expect(mocks.signInEmail).not.toHaveBeenCalled()
    expect(mocks.headers).not.toHaveBeenCalled()
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it('does not let disabled registration prevent signin delegation for valid credentials', async () => {
    process.env.REGISTRATION_ENABLED = 'false'

    await signInAction({ error: null }, makeAuthFormData())

    expect(mocks.headers).toHaveBeenCalledTimes(1)
    expect(mocks.signInEmail).toHaveBeenCalledWith({
      body: { email: 'mario@example.test', password: 'password123' },
      headers: expect.any(Headers),
    })
    expect(mocks.signUpEmail).not.toHaveBeenCalled()
    expect(mocks.redirect).toHaveBeenCalledWith('/dashboard')
  })
})
