'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useTransition } from 'react'

/**
 * tableUrlStorageKey — derives the sessionStorage key for a table's route.
 * Shape: 'table-url:' + route with the leading '/' stripped (locked decision 3).
 * No per-table forking — the hook already receives route per table instance.
 */
export function tableUrlStorageKey(route: string): string {
  return `table-url:${route.replace(/^\//, '')}`
}

/**
 * safeSessionStorage — returns window.sessionStorage, or null when unavailable
 * (SSR, storage disabled, private-mode property-access throw).
 */
export function safeSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

/**
 * saveTableQuery — writes the current query string under key, including the
 * empty string (a cleared filter set must overwrite a previously-saved one —
 * locked decision 3). Silent no-op on null storage or a throwing setItem
 * (quota exceeded, private mode).
 */
export function saveTableQuery(
  storage: Pick<Storage, 'setItem'> | null,
  key: string,
  query: string,
): void {
  if (!storage) return
  try {
    storage.setItem(key, query)
  } catch {
    // Storage unavailable (quota / private mode) — feature degrades silently.
  }
}

/**
 * readRestorableQuery — returns the saved query string to restore on bare
 * mount, or null when restore must not happen: no storage, the current URL
 * already carries params (URL always wins — locked decision 1, also the pin
 * for the v2.5 smart-back path), a throwing getItem, an absent key, or a
 * saved-but-cleared ('') value.
 */
export function readRestorableQuery(
  storage: Pick<Storage, 'getItem'> | null,
  key: string,
  currentQuery: string,
): string | null {
  if (!storage) return null
  if (currentQuery !== '') return null
  let stored: string | null
  try {
    stored = storage.getItem(key)
  } catch {
    return null
  }
  if (!stored) return null
  return stored
}

/**
 * useTableUrl — URL-mutation hook for the unified filter/sort toolbar.
 * Encapsulates router.replace(scroll:false) + startTransition so every
 * DataTableToolbar instance is table-agnostic (receives route as an arg).
 *
 * sessionStorage restore layer (quick task 260707-fy4): URL remains the
 * single source of truth. Every write via replaceWith is also saved to a
 * per-tab, per-route sessionStorage key; a mount-only effect restores it via
 * router.replace, but only when the URL has no search params of its own —
 * a URL that already carries params (shared link, refresh, back/forward,
 * smart-back) is never overridden.
 *
 * Returns:
 *   searchParams  — current URLSearchParams (read-only snapshot)
 *   isPending     — true while the URL transition is in flight
 *   replaceWith   — replace all search params at once
 *   updateParam   — set or delete a single key
 *   updateParams  — set/delete multiple keys in one replace (used by "Cancella tutto")
 */
export function useTableUrl(route: string) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const storageKey = tableUrlStorageKey(route)

  function replaceWith(params: URLSearchParams) {
    const query = params.toString()
    saveTableQuery(safeSessionStorage(), storageKey, query)
    startTransition(() => {
      router.replace(query ? `${route}?${query}` : route, { scroll: false })
    })
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const restored = readRestorableQuery(safeSessionStorage(), storageKey, searchParams.toString())
    if (restored) {
      startTransition(() => {
        router.replace(`${route}?${restored}`, { scroll: false })
      })
    }
  }, [])

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value !== null) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    replaceWith(params)
  }

  function updateParams(entries: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(entries)) {
      if (value !== null) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    }
    replaceWith(params)
  }

  return { searchParams, isPending, replaceWith, updateParam, updateParams }
}
