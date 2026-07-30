'use client'

import { useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronDownIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Lens } from '@/lib/utils/search-params'
import { readSavedLens, safeSessionStorage, saveLens } from './lens-persistence'

type LensSwitchProps = {
  lens: Lens
}

const LENS_OPTIONS: Array<{ value: Lens; label: string; description: string }> = [
  {
    value: 'cassa',
    label: 'per cassa',
    description: 'Ogni spesa nel mese in cui i soldi sono usciti dal conto.',
  },
  {
    value: 'competenza',
    label: 'per competenza',
    description: 'I costi ammortati spalmati sui mesi delle rate, anno intero.',
  },
]

/**
 * Title-integrated cassa/competenza dashboard lens dropdown (lens-selector redesign, LSD-01/
 * LSD-02, superseding Phase 80's bordered pill segmented control). Rendered inside the page
 * heading as a text trigger — heading typography, dotted-underline affordance — not a pill, so
 * it no longer mimics the year filter. Mirrors OverviewHeader's year-selector
 * update()/bare-mount-restore pattern exactly for the `lens` param: URL is canonical,
 * sessionStorage is a restore layer for bare navigation.
 */
export function LensSwitch({ lens }: LensSwitchProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  function update(next: Lens) {
    saveLens(safeSessionStorage(), next)
    const params = new URLSearchParams(searchParams.toString())
    params.set('lens', next)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  // On a bare mount (no ?lens in the URL), restore the last-selected lens. URL params always
  // win otherwise.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (searchParams.has('lens')) return
    const saved = readSavedLens(safeSessionStorage())
    if (saved && saved !== lens) {
      router.replace(`${pathname}?lens=${saved}`, { scroll: false })
    }
  }, [])

  const active = LENS_OPTIONS.find((option) => option.value === lens) ?? LENS_OPTIONS[0]!

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-0.5 rounded-md px-1 -mx-1 text-lg font-semibold hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          {/* The separator dot sits outside the underlined label so the affordance marks only the
              lens value itself. It lives inside the trigger (not the caller's heading) so LSD-04's
              plan-less case drops the dot along with the control, at every call site. */}
          <span className="text-muted-foreground">·&nbsp;</span>
          {/* Resting dotted underline — not hover-only: it is the only signal that the lens value
              in the heading is interactive at all (LSD-01). */}
          <span className="underline decoration-dotted decoration-muted-foreground decoration-1 underline-offset-4">
            {active.label}
          </span>
          <ChevronDownIcon className="size-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuRadioGroup value={lens} onValueChange={(value) => update(value as Lens)}>
          {LENS_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value} className="flex-col items-start gap-0.5 py-2">
              <span className="text-sm font-medium">{option.label}</span>
              <span className="text-xs text-muted-foreground">{option.description}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
