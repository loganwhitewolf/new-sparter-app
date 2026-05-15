import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { isRegistrationEnabled, REGISTRATION_DISABLED_MESSAGE, type RegistrationEnv } from '@/lib/auth/registration'

function enabledFor(env: RegistrationEnv = {}) {
  return isRegistrationEnabled(env)
}

describe('isRegistrationEnabled', () => {
  it('keeps registration enabled when REGISTRATION_ENABLED is unset', () => {
    expect(enabledFor()).toBe(true)
  })

  it('keeps registration enabled for explicit true-like values', () => {
    for (const value of ['true', '1', 'yes', 'on']) {
      expect(enabledFor({ REGISTRATION_ENABLED: value })).toBe(true)
    }
  })

  it('disables registration for explicit false-like values', () => {
    for (const value of ['false', '0', 'no', 'off']) {
      expect(enabledFor({ REGISTRATION_ENABLED: value })).toBe(false)
    }
  })

  it('normalizes whitespace and case before interpreting the flag', () => {
    expect(enabledFor({ REGISTRATION_ENABLED: ' FALSE ' })).toBe(false)
    expect(enabledFor({ REGISTRATION_ENABLED: '\t0\n' })).toBe(false)
    expect(enabledFor({ REGISTRATION_ENABLED: ' No ' })).toBe(false)
    expect(enabledFor({ REGISTRATION_ENABLED: ' OFF ' })).toBe(false)
    expect(enabledFor({ REGISTRATION_ENABLED: ' TRUE ' })).toBe(true)
    expect(enabledFor({ REGISTRATION_ENABLED: ' On ' })).toBe(true)
  })

  it('keeps registration enabled for empty or blank values', () => {
    expect(enabledFor({ REGISTRATION_ENABLED: '' })).toBe(true)
    expect(enabledFor({ REGISTRATION_ENABLED: '   ' })).toBe(true)
  })

  it('keeps registration enabled for malformed values', () => {
    expect(enabledFor({ REGISTRATION_ENABLED: 'disabled' })).toBe(true)
    expect(enabledFor({ REGISTRATION_ENABLED: 'maybe' })).toBe(true)
    expect(enabledFor({ REGISTRATION_ENABLED: '2' })).toBe(true)
  })

  it('only reads REGISTRATION_ENABLED from the provided env object', () => {
    const env = new Proxy(
      { REGISTRATION_ENABLED: 'false' },
      {
        get(target, property, receiver) {
          if (property !== 'REGISTRATION_ENABLED') {
            throw new Error(`Unexpected env read: ${String(property)}`)
          }

          return Reflect.get(target, property, receiver)
        },
      },
    ) as RegistrationEnv

    expect(isRegistrationEnabled(env)).toBe(false)
  })
})

describe('REGISTRATION_DISABLED_MESSAGE', () => {
  it('exposes a shared user-facing Italian disabled-registration message', () => {
    expect(REGISTRATION_DISABLED_MESSAGE).toBe('Le registrazioni sono temporaneamente disabilitate.')
  })
})
