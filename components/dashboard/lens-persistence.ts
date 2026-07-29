'use client'

/**
 * Session persistence for the global dashboard cash/accrual lens (Phase 80, ADR 0019 §5,
 * D-01/D-02). Mirrors components/dashboard/overview/overview-persistence.ts's
 * readSavedYear/saveYear shape exactly: the `?lens=` URL param is the source of truth,
 * sessionStorage only seeds a bare mount (restore layer, ADR 0009/0010 pattern).
 *
 * Pure over an injected `Storage | null` so it is unit-testable and degrades silently when
 * storage is unavailable (SSR, private mode, quota).
 */

import type { Lens } from '@/lib/utils/search-params'
// Re-exported so lens-switch.tsx (a sibling of the overview/ directory) has one import path
// for both lens persistence and the shared storage-access helper — no duplication.
export { safeSessionStorage } from './overview/overview-persistence'

export const LENS_STORAGE_KEY = 'dashboard:lens'

/**
 * Reads the persisted lens, or null when absent/unavailable/not exactly 'competenza'.
 * Absence means 'cassa' in the caller — mirrors readSavedYear's null-means-default contract.
 */
export function readSavedLens(storage: Pick<Storage, 'getItem'> | null): Lens | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(LENS_STORAGE_KEY)
    return raw === 'competenza' ? 'competenza' : null
  } catch {
    return null
  }
}

/** Persists the selected lens. Silent no-op on null storage or a throwing setItem. */
export function saveLens(storage: Pick<Storage, 'setItem'> | null, lens: Lens): void {
  if (!storage) return
  try {
    storage.setItem(LENS_STORAGE_KEY, lens)
  } catch {
    // Storage unavailable (quota / private mode) — feature degrades silently.
  }
}
