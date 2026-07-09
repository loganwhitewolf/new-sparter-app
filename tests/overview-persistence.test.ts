import { describe, expect, it } from 'vitest'
import {
  CHIP_STORAGE_KEY,
  YEAR_STORAGE_KEY,
  readExcludedChips,
  writeExcludedChips,
  readSavedYear,
  saveYear,
  type ExcludedChips,
} from '../components/dashboard/overview/overview-persistence'

// Minimal in-memory Storage stand-in (only the methods our helpers use).
function fakeStorage(seed: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(seed))
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    _map: map,
  }
}

const throwingSetItem = {
  setItem: () => {
    throw new Error('quota exceeded')
  },
}

describe('overview-persistence — chips', () => {
  it('round-trips a written excluded selection', () => {
    const storage = fakeStorage()
    const excluded: ExcludedChips = {
      income: ['extraordinary'],
      out: ['debt'],
      allocation: ['investment'],
    }
    writeExcludedChips(storage, excluded)
    expect(readExcludedChips(storage)).toEqual(excluded)
  })

  it('round-trips an empty (all-on) selection', () => {
    const storage = fakeStorage()
    writeExcludedChips(storage, { income: [], out: [], allocation: [] })
    expect(readExcludedChips(storage)).toEqual({ income: [], out: [], allocation: [] })
  })

  it('returns null on absent key', () => {
    expect(readExcludedChips(fakeStorage())).toBeNull()
  })

  it('returns null on null storage', () => {
    expect(readExcludedChips(null)).toBeNull()
    // write is a silent no-op — must not throw
    expect(() => writeExcludedChips(null, { income: [], out: [], allocation: [] })).not.toThrow()
  })

  it('returns null on malformed JSON', () => {
    const storage = fakeStorage({ [CHIP_STORAGE_KEY]: '{not json' })
    expect(readExcludedChips(storage)).toBeNull()
  })

  it('drops unknown/forged keys from each group', () => {
    const storage = fakeStorage({
      [CHIP_STORAGE_KEY]: JSON.stringify({
        income: ['extraordinary', 'bogus'],
        out: ['debt', 42, 'nope'],
        allocation: ['investment'],
      }),
    })
    expect(readExcludedChips(storage)).toEqual({
      income: ['extraordinary'],
      out: ['debt'],
      allocation: ['investment'],
    })
  })

  it('tolerates non-array group values', () => {
    const storage = fakeStorage({
      [CHIP_STORAGE_KEY]: JSON.stringify({ income: 'extraordinary', out: null }),
    })
    expect(readExcludedChips(storage)).toEqual({ income: [], out: [], allocation: [] })
  })

  it('degrades silently when setItem throws', () => {
    expect(() =>
      writeExcludedChips(throwingSetItem, { income: [], out: [], allocation: [] }),
    ).not.toThrow()
  })
})

describe('overview-persistence — year', () => {
  it('round-trips a saved year', () => {
    const storage = fakeStorage()
    saveYear(storage, '2024')
    expect(readSavedYear(storage)).toBe('2024')
    expect(storage._map.get(YEAR_STORAGE_KEY)).toBe('2024')
  })

  it('returns null when absent or blank', () => {
    expect(readSavedYear(fakeStorage())).toBeNull()
    expect(readSavedYear(fakeStorage({ [YEAR_STORAGE_KEY]: '  ' }))).toBeNull()
  })

  it('returns null on null storage and never throws on save', () => {
    expect(readSavedYear(null)).toBeNull()
    expect(() => saveYear(null, '2024')).not.toThrow()
    expect(() => saveYear(throwingSetItem, '2024')).not.toThrow()
  })
})
