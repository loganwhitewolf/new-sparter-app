'use client'

// PROTOTYPE — wipe me. Inviting nudge that lives on the title row (right side) so it
// doesn't steal a full layout row, while still carrying the full inviting copy.
// Click "Categorizza ora" → categorize; X → dismiss.
//
// Real feature = option A (smart dismiss), localStorage only, NO DB value:
//   on dismiss, persist a snapshot of the uncategorized count; the nudge reappears when
//   the current count exceeds the last seen value (i.e. new uncategorized arrived).
// The prototype keeps a simple boolean dismiss because the mock count is static and
// year-switching would make a count-based reappear misfire. See NOTES.md.
// Rendered only when there is something to act on.
import { useEffect, useState } from 'react'
import { TriangleAlert, X } from 'lucide-react'
import { getKpis } from './mock-data'

const DISMISS_KEY = 'proto-uncat-dismissed'

export function UncategorizedNudge({ year }: { year: number }) {
  const { uncategorized } = getKpis(year, new Set(), new Set())
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Read the persisted dismiss flag on mount (localStorage is client-only). The real
    // feature uses option A (lastSeenCount); see NOTES.md.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(localStorage.getItem(DISMISS_KEY) === '1')
  }, [])

  if (uncategorized <= 0 || dismissed) return null

  return (
    <div className="flex max-w-xs shrink-0 items-start gap-2 text-amber-700 dark:text-amber-300">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      <div className="text-xs leading-snug">
        <p className="text-pretty">
          <span className="font-medium">Hai delle spese da categorizzare</span>, rendi il tuo report più preciso.
        </p>
        <button type="button" className="mt-0.5 font-medium underline underline-offset-2 hover:no-underline">
          Categorizza ora
        </button>
      </div>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, '1')
          setDismissed(true)
        }}
        aria-label="Nascondi definitivamente"
        title="Nascondi definitivamente"
        className="-mr-1 flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}
