import { z } from 'zod'

export const PROFILE_FIELD_LIMITS = {
  firstName: 80,
  lastName: 80,
  jobTitle: 120,
  location: 120,
  phone: 40,
  timezone: 64,
} as const

const FALLBACK_TIMEZONES = new Set(['Europe/Rome', 'UTC', 'Europe/London', 'America/New_York'])
const PHONE_PATTERN = /^[+\d\s\-()]+$/

function getSupportedTimezones(): Set<string> {
  const supportedValuesOf = Intl.supportedValuesOf
  if (typeof supportedValuesOf !== 'function') {
    return FALLBACK_TIMEZONES
  }

  try {
    return new Set(supportedValuesOf('timeZone'))
  } catch {
    return FALLBACK_TIMEZONES
  }
}

function isSupportedTimezone(value: string): boolean {
  return getSupportedTimezones().has(value) || FALLBACK_TIMEZONES.has(value)
}

const nullableTrimmedString = (maxLength: number, maxMessage: string) =>
  z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return value
      }

      const trimmed = value.trim()
      return trimmed.length === 0 ? null : trimmed
    },
    z.string().max(maxLength, { error: maxMessage }).nullable(),
  )

export const ProfileSchema = z.object({
  firstName: nullableTrimmedString(
    PROFILE_FIELD_LIMITS.firstName,
    'Il nome non può superare gli 80 caratteri.',
  ),
  lastName: nullableTrimmedString(
    PROFILE_FIELD_LIMITS.lastName,
    'Il cognome non può superare gli 80 caratteri.',
  ),
  jobTitle: nullableTrimmedString(
    PROFILE_FIELD_LIMITS.jobTitle,
    'Il ruolo professionale non può superare i 120 caratteri.',
  ),
  location: nullableTrimmedString(
    PROFILE_FIELD_LIMITS.location,
    'La località non può superare i 120 caratteri.',
  ),
  phone: nullableTrimmedString(
    PROFILE_FIELD_LIMITS.phone,
    'Il telefono non può superare i 40 caratteri.',
  ).refine((value) => value === null || PHONE_PATTERN.test(value), {
    error: 'Il telefono può contenere solo numeri, spazi, +, trattini e parentesi.',
  }),
  timezone: nullableTrimmedString(
    PROFILE_FIELD_LIMITS.timezone,
    'Il fuso orario non può superare i 64 caratteri.',
  ).refine((value) => value === null || isSupportedTimezone(value), {
    error: 'Seleziona un fuso orario valido.',
  }),
})

export type ProfileInput = z.input<typeof ProfileSchema>
export type ProfileValues = z.output<typeof ProfileSchema>

export function normalizeProfileInput(input: ProfileInput): ProfileValues {
  return ProfileSchema.parse(input)
}
