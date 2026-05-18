import { afterEach, describe, expect, it, vi } from 'vitest'
import { getSafeSignUpErrorMessage, logSanitizedAuthError } from '../lib/actions/auth-errors'
import { logger } from '../lib/logger'

vi.mock('../lib/logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}))

describe('logSanitizedAuthError', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.mocked(logger.warn).mockClear()
  })

  it('logs sanitized fields in development', () => {
    vi.stubEnv('NODE_ENV', 'development')

    logSanitizedAuthError('sign_up', Object.assign(new Error('self-signed certificate in certificate chain'), { code: 'SELF_SIGNED_CERT_IN_CHAIN' }))

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'auth_debug_error',
        operation: 'sign_up',
        errorName: 'Error',
        errorMessage: expect.stringContaining('self-signed certificate'),
      }),
    )
  })

  it('does not log outside development unless AUTH_DEBUG is enabled', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('AUTH_DEBUG', undefined)

    logSanitizedAuthError('sign_up', new Error('hidden'))

    expect(logger.warn).not.toHaveBeenCalled()
  })
})

describe('getSafeSignUpErrorMessage', () => {
  it('keeps unknown registration errors generic to avoid account enumeration', () => {
    expect(getSafeSignUpErrorMessage(new Error('User already exists'))).toBe(
      'Si è verificato un errore. Riprova.',
    )
  })

  it('returns an actionable setup message when Postgres is unreachable', () => {
    const error = new AggregateError(
      [Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), { code: 'ECONNREFUSED' })],
      '',
    )

    expect(getSafeSignUpErrorMessage(error)).toContain('Database non raggiungibile')
    expect(getSafeSignUpErrorMessage(error)).toContain('npm run db:up')
    expect(getSafeSignUpErrorMessage(error)).toContain('npm run db:migrate')
  })

  it('returns an actionable migration message when auth tables or columns are missing', () => {
    expect(
      getSafeSignUpErrorMessage(new Error('Failed query: relation "user" does not exist')),
    ).toBe('Database non aggiornato. Esegui `npm run db:migrate` e riprova la registrazione.')

    expect(
      getSafeSignUpErrorMessage(new Error('Failed query: column "first_name" does not exist')),
    ).toBe('Database non aggiornato. Esegui `npm run db:migrate` e riprova la registrazione.')
  })
})
