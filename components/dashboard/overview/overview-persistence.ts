'use client'

/**
 * Session persistence for the dashboard Overview filters.
 *
 * Scope: sessionStorage (per-tab), matching the table filter restore layer
 * (ADR 0009/0010) — remembered while the tab lives, forgotten on browser close.
 *
 * Two independent concerns:
 * - Chart chips (Entrate/Uscite/Accantonamento): stored as the EXCLUDED keys per
 *   group. Default is all-on, so the common case stores empty arrays.
 * - Year selector: stored as the plain year string; the URL stays the source of
 *   truth, this only seeds a bare mount.
 *
 * All functions are pure over an injected `Storage | null` so they are unit-testable
 * and degrade silently when storage is unavailable (SSR, private mode, quota).
 */

import {
  ALLOCATION_KEYS,
  INCOME_KEYS,
  OUT_KEYS,
  type AllocationKey,
  type IncomeKey,
  type OutKey,
} from './overview-chart-utils'

export const CHIP_STORAGE_KEY = 'dashboard-overview:chart-chips'
export const YEAR_STORAGE_KEY = 'dashboard-overview:year'

/** window.sessionStorage, or null when unavailable (SSR / disabled / private-mode throw). */
export function safeSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export type ExcludedChips = {
  income: IncomeKey[]
  out: OutKey[]
  allocation: AllocationKey[]
}

function filterKnown<T extends string>(value: unknown, known: readonly T[]): T[] {
  if (!Array.isArray(value)) return []
  const allowed = new Set<string>(known)
  // Dedupe + keep only recognised keys — tolerate a stale/forged payload.
  return [...new Set(value.filter((v): v is T => typeof v === 'string' && allowed.has(v)))]
}

/**
 * Reads persisted excluded chip keys, or null when nothing valid is stored.
 * Unknown keys (e.g. after a taxonomy change) are dropped rather than trusted.
 */
export function readExcludedChips(storage: Pick<Storage, 'getItem'> | null): ExcludedChips | null {
  if (!storage) return null
  let raw: string | null
  try {
    raw = storage.getItem(CHIP_STORAGE_KEY)
  } catch {
    return null
  }
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (typeof parsed !== 'object' || parsed === null) return null
    return {
      income: filterKnown(parsed.income, INCOME_KEYS),
      out: filterKnown(parsed.out, OUT_KEYS),
      allocation: filterKnown(parsed.allocation, ALLOCATION_KEYS),
    }
  } catch {
    return null
  }
}

/** Persists excluded chip keys. Silent no-op on null storage or a throwing setItem. */
export function writeExcludedChips(
  storage: Pick<Storage, 'setItem'> | null,
  excluded: ExcludedChips,
): void {
  if (!storage) return
  try {
    storage.setItem(CHIP_STORAGE_KEY, JSON.stringify(excluded))
  } catch {
    // Storage unavailable (quota / private mode) — feature degrades silently.
  }
}

/** Reads the persisted year string, or null when absent/unavailable. */
export function readSavedYear(storage: Pick<Storage, 'getItem'> | null): string | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(YEAR_STORAGE_KEY)
    return raw && raw.trim() !== '' ? raw : null
  } catch {
    return null
  }
}

/** Persists the selected year. Silent no-op on null storage or a throwing setItem. */
export function saveYear(storage: Pick<Storage, 'setItem'> | null, year: string): void {
  if (!storage) return
  try {
    storage.setItem(YEAR_STORAGE_KEY, year)
  } catch {
    // Feature degrades silently.
  }
}
