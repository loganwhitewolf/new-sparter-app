'use client'

import { useEffect, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type StoredCoverageNudge = {
  lastSeenCount: number
}

// ─── Pure helper (exported for unit tests) ───────────────────────────────────

/**
 * D-14: the nudge is SPECIFICALLY the exactly-1-raw-Covered-Month state — 0 Covered Months is the
 * separate whole-year-empty state (UI-SPEC `## Year With No Imported Data`), and 2+ means the
 * nudge's job is done regardless of pace-eligibility.
 *
 * Mirrors overview-nudge.tsx's shouldShowNudge lastSeenCount semantics (re-show if the dismissed
 * count no longer matches the current count), simplified since this nudge only ever fires at
 * exactly 1.
 */
export function shouldShowCoverageNudge(
  coveredMonthCount: number,
  stored: StoredCoverageNudge | null
): boolean {
  if (coveredMonthCount !== 1) return false
  if (!stored) return true
  return coveredMonthCount !== stored.lastSeenCount
}

// ─── localStorage key helpers (mirrors overview-nudge.tsx's buildStorageKey/readStored) ──────

function buildStorageKey(year: number): string {
  return `sparter-categories-nudge-${year}`
}

function readStored(year: number): StoredCoverageNudge | null {
  try {
    const raw = localStorage.getItem(buildStorageKey(year))
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'lastSeenCount' in parsed &&
      typeof (parsed as StoredCoverageNudge).lastSeenCount === 'number'
    ) {
      return parsed as StoredCoverageNudge
    }
    return null
  } catch {
    return null
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

type CategoryCoverageNudgeProps = {
  coveredMonthCount: number
  year: number
}

/**
 * D-14: with exactly 1 Covered Month in the selected year, states explicitly what is missing
 * (monthly pace, year-end projection) and how to get it, below the category list.
 *
 * Unlike OverviewNudge this is a persistent informational panel, not a dismissible pill — it is
 * informational about missing data rather than an actionable alert, so no dismiss control is
 * rendered. It still restores from localStorage in an SSR-safe effect (mirroring OverviewNudge's
 * hydration pattern) so a future dismiss affordance can be wired without changing this read path.
 * No server action or database write occurs (T-83-05).
 */
export function CategoryCoverageNudge({ coveredMonthCount, year }: CategoryCoverageNudgeProps) {
  // SSR-safe default: start hidden; restore from localStorage in useEffect after mount.
  // Never read localStorage in a useState initializer (hydration mismatch risk).
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const stored = readStored(year)
    setVisible(shouldShowCoverageNudge(coveredMonthCount, stored))
  }, [coveredMonthCount, year])

  if (!visible) return null

  return (
    <div
      role="status"
      className="rounded-lg border border-dashed border-border bg-muted px-4 py-4 text-sm leading-relaxed text-muted-foreground"
    >
      <span className="font-semibold text-foreground">Con un secondo mese importato</span>{' '}
      vedrai il ritmo mensile e la proiezione di fine anno. Serve almeno un mese concluso oltre a
      quello in corso.
    </div>
  )
}
