import 'server-only'

export type RegistrationEnv = {
  REGISTRATION_ENABLED?: string | undefined
}

export const REGISTRATION_DISABLED_MESSAGE = 'Le registrazioni sono temporaneamente disabilitate.'

const DISABLED_VALUES = new Set(['false', '0', 'no', 'off'])
const ENABLED_VALUES = new Set(['true', '1', 'yes', 'on'])

export function isRegistrationEnabled(env: RegistrationEnv = process.env as RegistrationEnv): boolean {
  const rawValue = env.REGISTRATION_ENABLED

  if (rawValue == null) {
    return true
  }

  const normalizedValue = rawValue.trim().toLowerCase()

  if (DISABLED_VALUES.has(normalizedValue)) {
    return false
  }

  if (ENABLED_VALUES.has(normalizedValue)) {
    return true
  }

  return true
}
