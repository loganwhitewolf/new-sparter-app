import { describe, expect, it } from 'vitest'
import { ProfileSchema, normalizeProfileInput } from '../profile'

const validProfile = {
  firstName: 'Andrea',
  lastName: 'Rossi',
  jobTitle: 'Product Manager',
  location: 'Roma',
  phone: '+39 06 1234-5678',
  timezone: 'Europe/Rome',
}

describe('ProfileSchema', () => {
  it('Test 1: trims fields and normalizes whitespace-only strings to null', () => {
    const result = ProfileSchema.safeParse({
      firstName: '  Andrea  ',
      lastName: '   ',
      jobTitle: '',
      location: '\t',
      phone: ' +39 06 1234 ',
      timezone: ' Europe/Rome ',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({
        firstName: 'Andrea',
        lastName: null,
        jobTitle: null,
        location: null,
        phone: '+39 06 1234',
        timezone: 'Europe/Rome',
      })
    }
  })

  it('Test 2: accepts max-length boundary values', () => {
    const result = ProfileSchema.safeParse({
      firstName: 'A'.repeat(80),
      lastName: 'B'.repeat(80),
      jobTitle: 'C'.repeat(120),
      location: 'D'.repeat(120),
      phone: '+'.padEnd(40, '1'),
      timezone: 'Europe/Rome',
    })

    expect(result.success).toBe(true)
  })

  it('Test 3: rejects oversize profile fields with specific messages', () => {
    const result = ProfileSchema.safeParse({
      ...validProfile,
      firstName: 'A'.repeat(81),
      lastName: 'B'.repeat(81),
      jobTitle: 'C'.repeat(121),
      location: 'D'.repeat(121),
      phone: '1'.repeat(41),
      timezone: 'E'.repeat(65),
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message).join(' ')
      expect(messages).toMatch(/nome.*80 caratteri/i)
      expect(messages).toMatch(/cognome.*80 caratteri/i)
      expect(messages).toMatch(/ruolo professionale.*120 caratteri/i)
      expect(messages).toMatch(/località.*120 caratteri/i)
      expect(messages).toMatch(/telefono.*40 caratteri/i)
      expect(messages).toMatch(/fuso orario.*64 caratteri/i)
    }
  })

  it('Test 4: rejects invalid phone characters', () => {
    const result = ProfileSchema.safeParse({
      ...validProfile,
      phone: '+39 06 1234 ext. 5',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message).join(' ')).toMatch(/telefono/i)
    }
  })

  it('Test 5: rejects invalid timezones and accepts Europe/Rome', () => {
    expect(ProfileSchema.safeParse(validProfile).success).toBe(true)

    const result = ProfileSchema.safeParse({
      ...validProfile,
      timezone: 'Not/A_Real_Timezone',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message).join(' ')).toMatch(/fuso orario/i)
    }
  })

  it('Test 6: exposes a helper that returns normalized output values', () => {
    expect(
      normalizeProfileInput({
        ...validProfile,
        firstName: ' Andrea ',
        lastName: '',
      }),
    ).toEqual({
      ...validProfile,
      firstName: 'Andrea',
      lastName: null,
    })
  })
})
