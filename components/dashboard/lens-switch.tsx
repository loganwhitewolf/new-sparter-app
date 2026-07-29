'use client'

import { useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { Lens } from '@/lib/utils/search-params'
import { readSavedLens, safeSessionStorage, saveLens } from './lens-persistence'

type LensSwitchProps = {
  lens: Lens
  /** D-05: disabled on lens-invariant surfaces (e.g. /dashboard/tags) — never mutates the URL. */
  disabled?: boolean
  /** Short muted-text note rendered beside the group (D-05's no-op explanation copy). */
  note?: string
}

/**
 * Global cassa/competenza dashboard lens switch (Phase 80, ADR 0019 §5, D-01/D-03/D-04).
 * Mirrors OverviewHeader's year-selector update()/bare-mount-restore pattern exactly, but for
 * the `lens` param: URL is canonical, sessionStorage is a restore layer for bare navigation.
 */
export function LensSwitch({ lens, disabled, note }: LensSwitchProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  function update(next: Lens) {
    if (disabled) return
    saveLens(safeSessionStorage(), next)
    const params = new URLSearchParams(searchParams.toString())
    params.set('lens', next)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  // On a bare mount (no ?lens in the URL), restore the last-selected lens. URL params always
  // win otherwise. Guarded by `disabled` so a lens-invariant surface never mutates the URL.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (disabled) return
    if (searchParams.has('lens')) return
    const saved = readSavedLens(safeSessionStorage())
    if (saved && saved !== lens) {
      router.replace(`${pathname}?lens=${saved}`, { scroll: false })
    }
  }, [])

  return (
    <div className="flex items-center gap-2">
      <div role="group" aria-label="Lente" className="inline-flex overflow-hidden rounded-full border text-sm font-medium">
        <button
          type="button"
          aria-pressed={lens === 'cassa'}
          disabled={disabled}
          onClick={() => update('cassa')}
          className="px-3 py-1 aria-pressed:bg-foreground aria-pressed:text-background disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cassa
        </button>
        <button
          type="button"
          aria-pressed={lens === 'competenza'}
          disabled={disabled}
          onClick={() => update('competenza')}
          className="px-3 py-1 aria-pressed:bg-foreground aria-pressed:text-background disabled:cursor-not-allowed disabled:opacity-60"
        >
          Competenza
        </button>
      </div>
      {note != null && <span className="text-xs text-muted-foreground">{note}</span>}
    </div>
  )
}
