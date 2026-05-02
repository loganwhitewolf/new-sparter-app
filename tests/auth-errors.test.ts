import { describe, expect, it } from 'vitest'
import { getSafeSignUpErrorMessage } from '../lib/actions/auth-errors'

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
