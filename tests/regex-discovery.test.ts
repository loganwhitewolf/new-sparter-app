import { describe, expect, it } from 'vitest'
import {
  clusterKeyFor,
  isSignificantToken,
  normalizeToken,
  parseMinTx,
} from '../scripts/regex-discovery'

describe('normalizeToken', () => {
  it('strips leading processor/marker punctuation', () => {
    expect(normalizeToken('*vodafoneita')).toBe('vodafoneita')
    expect(normalizeToken('#ref')).toBe('ref')
  })

  it('preserves internal dots/apostrophes (e.g. claude.ai, ced.su)', () => {
    expect(normalizeToken('claude.ai')).toBe('claude.ai')
    expect(normalizeToken('ced.su')).toBe('ced.su')
    expect(normalizeToken("l'ape")).toBe("l'ape")
  })

  it('strips trailing separators so bank prefixes collapse (Ord:, Beneficiario:)', () => {
    expect(normalizeToken('ord:')).toBe('ord')
    expect(normalizeToken('beneficiario:')).toBe('beneficiario')
  })
})

describe('isSignificantToken', () => {
  it('rejects short, digit-bearing, currency, legal-form, and processor tokens', () => {
    expect(isSignificantToken('di')).toBe(false) // too short
    expect(isSignificantToken('12345')).toBe(false) // pure number
    expect(isSignificantToken('i011')).toBe(false) // store/filiale code (contains a digit)
    expect(isSignificantToken('eur')).toBe(false) // currency stopword
    expect(isSignificantToken('srl')).toBe(false) // legal form
    expect(isSignificantToken('paypal')).toBe(false) // payment processor
    expect(isSignificantToken('beneficiario')).toBe(false) // bank-structural prefix
    expect(isSignificantToken('ord')).toBe(false) // bank-structural prefix
  })

  it('accepts real merchant tokens', () => {
    expect(isSignificantToken('autogrill')).toBe(true)
    expect(isSignificantToken('geox')).toBe(true)
  })
})

describe('clusterKeyFor', () => {
  it('keys on the merchant after a payment-processor prefix and `*` marker', () => {
    expect(clusterKeyFor('Paypal *Vodafoneita Vodaf')).toBe('vodafoneita')
    expect(clusterKeyFor('Sumup *Dellatorre Fratel')).toBe('dellatorre')
  })

  it('ignores currency and legal-form noise as cluster keys', () => {
    expect(clusterKeyFor('EUR Deposit')).toBe('deposit')
    expect(clusterKeyFor('Cafezal Srl')).toBe('cafezal')
  })

  it('returns null when a description has no significant tokens', () => {
    expect(clusterKeyFor('EUR 12345 SRL')).toBeNull()
  })
})

describe('parseMinTx', () => {
  it('defaults to 2 when the flag is absent or invalid', () => {
    expect(parseMinTx([])).toBe(2)
    expect(parseMinTx(['--min-tx=0'])).toBe(2)
    expect(parseMinTx(['--min-tx=abc'])).toBe(2)
  })

  it('reads a valid --min-tx value', () => {
    expect(parseMinTx(['--min-tx=1'])).toBe(1)
    expect(parseMinTx(['--min-tx=5'])).toBe(5)
  })
})
