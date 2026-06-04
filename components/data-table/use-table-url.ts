'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

/**
 * useTableUrl — URL-mutation hook for the unified filter/sort toolbar.
 * Encapsulates router.replace(scroll:false) + startTransition so every
 * DataTableToolbar instance is table-agnostic (receives route as an arg).
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

  function replaceWith(params: URLSearchParams) {
    const query = params.toString()
    startTransition(() => {
      router.replace(query ? `${route}?${query}` : route, { scroll: false })
    })
  }

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    replaceWith(params)
  }

  function updateParams(entries: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(entries)) {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    }
    replaceWith(params)
  }

  return { searchParams, isPending, replaceWith, updateParam, updateParams }
}
