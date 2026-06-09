'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { APP_ROUTES } from '@/lib/routes'

// ─── Types ────────────────────────────────────────────────────────────────────

type StoredNudge = {
  lastSeenCount: number
}

// ─── Pure helper (exported for unit tests) ───────────────────────────────────

/**
 * Determine whether the nudge should be visible based on current count and
 * any previously stored dismissal record (lastSeenCount semantics).
 *
 * Rules:
 * - count <= 0 → always hidden (NUDGE-04)
 * - no stored value → shown (first time, NUDGE-01)
 * - count > stored.lastSeenCount → reappears (new uncategorized arrived, NUDGE-03)
 * - count <= stored.lastSeenCount → hidden (dismissed at or above current count)
 */
export function shouldShowNudge(
  count: number,
  stored: StoredNudge | null
): boolean {
  if (count <= 0) return false
  if (!stored) return true
  return count > stored.lastSeenCount
}

// ─── localStorage key helpers ─────────────────────────────────────────────────

function buildStorageKey(year: number): string {
  return `sparter-overview-nudge-${year}`
}

function readStored(year: number): StoredNudge | null {
  try {
    const raw = localStorage.getItem(buildStorageKey(year))
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'lastSeenCount' in parsed &&
      typeof (parsed as StoredNudge).lastSeenCount === 'number'
    ) {
      return parsed as StoredNudge
    }
    return null
  } catch {
    return null
  }
}

// ─── Build months param for CTA URL ──────────────────────────────────────────

/**
 * Build a comma-separated list of all 12 YYYY-MM tokens for the given year.
 * Used for the `months` query param on the /transactions CTA.
 */
function buildMonthsParam(year: number): string {
  const months: string[] = []
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0')
    months.push(`${year}-${mm}`)
  }
  return months.join(',')
}

// ─── Component ───────────────────────────────────────────────────────────────

type OverviewNudgeProps = {
  uncategorizedCount: number
  year: number
}

/**
 * Inline amber nudge shown on the overview title row when the selected year
 * has uncategorized OUT expenses.
 *
 * Dismissal is stored in localStorage only — year-scoped with lastSeenCount semantics.
 * The nudge reappears when the uncategorized count rises above the last dismissed count.
 * No server action or database write occurs.
 */
export function OverviewNudge({ uncategorizedCount, year }: OverviewNudgeProps) {
  // SSR-safe default: start hidden; restore from localStorage in useEffect after mount.
  // Never read localStorage in a useState initializer (hydration mismatch risk).
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const stored = readStored(year)
    setVisible(shouldShowNudge(uncategorizedCount, stored))
  }, [uncategorizedCount, year])

  function dismiss() {
    const key = buildStorageKey(year)
    localStorage.setItem(key, JSON.stringify({ lastSeenCount: uncategorizedCount }))
    setVisible(false)
  }

  if (!visible) return null

  // Build the CTA href: /transactions?status=uncategorized&months=YYYY-MM,...
  const params = new URLSearchParams({
    status: 'uncategorized',
    months: buildMonthsParam(year),
  })
  const ctaHref = `${APP_ROUTES.transactions}?${params.toString()}`

  // FRU-FIX-03: compact inline pill aligned right on the title row (no longer a full-width banner).
  return (
    <div
      role="status"
      className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 pl-2.5 pr-1.5 py-1 text-xs text-amber-800"
    >
      <Link
        href={ctaHref}
        className="font-medium underline-offset-2 hover:underline hover:text-amber-900 whitespace-nowrap"
      >
        Movimenti da categorizzare
      </Link>
      <button
        type="button"
        aria-label="Chiudi avviso"
        onClick={dismiss}
        className="shrink-0 rounded-full p-0.5 hover:bg-amber-100"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}
