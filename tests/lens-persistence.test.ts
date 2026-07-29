import { describe, expect, it } from 'vitest'
import { LENS_STORAGE_KEY, readSavedLens, saveLens } from '../components/dashboard/lens-persistence'

function makeStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    _store: store,
  }
}

describe('readSavedLens', () => {
  it('returns "competenza" only when the stored raw value is exactly "competenza"', () => {
    expect(readSavedLens(makeStorage({ [LENS_STORAGE_KEY]: 'competenza' }))).toBe('competenza')
  })

  it('returns null for any other stored value', () => {
    expect(readSavedLens(makeStorage({ [LENS_STORAGE_KEY]: 'cassa' }))).toBeNull()
    expect(readSavedLens(makeStorage({ [LENS_STORAGE_KEY]: 'garbage' }))).toBeNull()
    expect(readSavedLens(makeStorage({ [LENS_STORAGE_KEY]: 'Competenza' }))).toBeNull()
  })

  it('returns null when storage is null', () => {
    expect(readSavedLens(null)).toBeNull()
  })

  it('returns null when nothing is stored', () => {
    expect(readSavedLens(makeStorage())).toBeNull()
  })

  it('returns null when getItem throws', () => {
    const throwing = {
      getItem: () => {
        throw new Error('quota exceeded')
      },
    }
    expect(readSavedLens(throwing)).toBeNull()
  })

  it('never throws on any input', () => {
    expect(() => readSavedLens(null)).not.toThrow()
    expect(() => readSavedLens(makeStorage({ [LENS_STORAGE_KEY]: 'garbage' }))).not.toThrow()
  })
})

describe('saveLens', () => {
  it('persists the lens under LENS_STORAGE_KEY', () => {
    const storage = makeStorage()
    saveLens(storage, 'competenza')
    expect(storage._store.get(LENS_STORAGE_KEY)).toBe('competenza')
  })

  it('persists "cassa" as well', () => {
    const storage = makeStorage()
    saveLens(storage, 'cassa')
    expect(storage._store.get(LENS_STORAGE_KEY)).toBe('cassa')
  })

  it('is a silent no-op when storage is null', () => {
    expect(() => saveLens(null, 'competenza')).not.toThrow()
  })

  it('is a silent no-op when setItem throws', () => {
    const throwing = {
      setItem: () => {
        throw new Error('quota exceeded')
      },
    }
    expect(() => saveLens(throwing, 'competenza')).not.toThrow()
  })
})
