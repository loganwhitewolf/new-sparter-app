/**
 * useTableUrl sessionStorage persistence — pure helper unit tests (quick task 260707-fy4).
 *
 * Plain vitest, no jsdom, no react rendering. Storage is mocked as a minimal
 * object exposing getItem/setItem (same pattern as attachPopstateRefresh in
 * tests/detail-page-shell.test.tsx). Covers the pure helpers only — the hook
 * wiring itself (mount-effect restore, save-on-replaceWith) is exercised
 * indirectly by the existing SSR regression tests in
 * tests/data-table-toolbar.test.tsx, which must keep passing unchanged.
 */

import { describe, expect, test, vi } from 'vitest'
import {
  readRestorableQuery,
  saveTableQuery,
  tableUrlStorageKey,
} from '@/components/data-table/use-table-url'

describe('tableUrlStorageKey', () => {
  test('strips the leading slash and prefixes table-url:', () => {
    expect(tableUrlStorageKey('/transactions')).toBe('table-url:transactions')
  })

  test('same key shape for /expenses', () => {
    expect(tableUrlStorageKey('/expenses')).toBe('table-url:expenses')
  })

  test('same key shape for /import', () => {
    expect(tableUrlStorageKey('/import')).toBe('table-url:import')
  })
})

describe('saveTableQuery', () => {
  test('calls storage.setItem(key, query) for a non-empty query', () => {
    const storage = { setItem: vi.fn() }

    saveTableQuery(storage, 'table-url:transactions', 'q=coop&sort=amount')

    expect(storage.setItem).toHaveBeenCalledWith(
      'table-url:transactions',
      'q=coop&sort=amount',
    )
  })

  test('saves the empty string so "cleared" is distinguishable from "never touched"', () => {
    const storage = { setItem: vi.fn() }

    saveTableQuery(storage, 'table-url:transactions', '')

    expect(storage.setItem).toHaveBeenCalledWith('table-url:transactions', '')
  })

  test('is a silent no-op when storage is null', () => {
    expect(() => saveTableQuery(null, 'table-url:transactions', 'q=coop')).not.toThrow()
  })

  test('is a silent no-op when setItem throws (quota / private mode)', () => {
    const storage = {
      setItem: vi.fn(() => {
        throw new Error('QuotaExceededError')
      }),
    }

    expect(() => saveTableQuery(storage, 'table-url:transactions', 'q=coop')).not.toThrow()
  })
})

describe('readRestorableQuery', () => {
  test('returns the stored string when the current query is empty and a value was saved', () => {
    const storage = { getItem: vi.fn(() => 'status=categorized') }

    expect(readRestorableQuery(storage, 'table-url:transactions', '')).toBe(
      'status=categorized',
    )
  })

  test('returns null when the current URL already has params (URL wins, decision 1)', () => {
    const storage = { getItem: vi.fn(() => 'q=coop') }

    expect(
      readRestorableQuery(storage, 'table-url:transactions', 'status=categorized'),
    ).toBeNull()
    // Must not even consult storage once the URL already carries params —
    // this is also the pin for the v2.5 smart-back path.
  })

  test('returns null when the stored value is the empty string (cleared state)', () => {
    const storage = { getItem: vi.fn(() => '') }

    expect(readRestorableQuery(storage, 'table-url:transactions', '')).toBeNull()
  })

  test('returns null when the key is absent', () => {
    const storage = { getItem: vi.fn(() => null) }

    expect(readRestorableQuery(storage, 'table-url:transactions', '')).toBeNull()
  })

  test('returns null when storage is null', () => {
    expect(readRestorableQuery(null, 'table-url:transactions', '')).toBeNull()
  })

  test('does not throw and returns null when getItem throws', () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error('SecurityError')
      }),
    }

    expect(() =>
      readRestorableQuery(storage, 'table-url:transactions', ''),
    ).not.toThrow()
    expect(readRestorableQuery(storage, 'table-url:transactions', '')).toBeNull()
  })
})
