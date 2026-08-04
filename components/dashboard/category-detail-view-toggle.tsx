'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { CategoryDetailView } from '@/lib/validations/category-year-window'

type Props = {
  view: CategoryDetailView
}

/**
 * CDET-VIEW-02/05 (260804-br9): the category detail page's YTD/Proiezione toggle, replacing the
 * deleted window-controls component. Mirrors CategoryDetailWindowControls' own
 * useSearchParams/useRouter/usePathname + router.replace pattern exactly — every OTHER param
 * (`year`, `type`, `lens`) is preserved verbatim by construction, the same mechanism the retired
 * file relied on.
 *
 * No `isCurrentYear`/`disabled` prop: CDET-VIEW-05 hides this component entirely for a past year
 * (the page alone decides whether to render it at all) rather than disabling it here.
 */
export function CategoryDetailViewToggle({ view }: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  function replaceWith(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString())
    mutate(params)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function selectYtd() {
    // CDET-VIEW-02: ytd is the absent/default state — deleting `view` (not setting it to 'ytd')
    // keeps the URL contract's implicit-default shape, mirroring the retired window-controls'
    // own months === 12 delete-not-set convention.
    replaceWith((params) => {
      params.delete('view')
    })
  }

  function selectProjection() {
    replaceWith((params) => {
      params.set('view', 'projection')
    })
  }

  return (
    <div role="group" aria-label="Vista" className="flex overflow-hidden rounded-full border">
      <button
        type="button"
        aria-pressed={view === 'ytd'}
        onClick={selectYtd}
        className={cn(
          'px-3 py-1 text-sm font-medium transition-colors',
          view === 'ytd'
            ? 'bg-primary text-primary-foreground'
            : 'bg-transparent text-muted-foreground hover:bg-muted',
        )}
      >
        Da inizio anno
      </button>
      <button
        type="button"
        aria-pressed={view === 'projection'}
        onClick={selectProjection}
        className={cn(
          'px-3 py-1 text-sm font-medium transition-colors',
          view === 'projection'
            ? 'bg-primary text-primary-foreground'
            : 'bg-transparent text-muted-foreground hover:bg-muted',
        )}
      >
        Proiezione
      </button>
    </div>
  )
}
