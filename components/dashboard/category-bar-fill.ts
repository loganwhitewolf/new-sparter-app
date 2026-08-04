/**
 * Per-month bar fill styling shared by the categories list sparkline (a Client Component) and the
 * category detail page's amounts chart (a Server Component).
 *
 * This lives in its own module — with no `'use client'` directive — precisely because of that
 * split: importing a plain function out of a `'use client'` module from a Server Component makes
 * React treat it as a client reference and throws at render time ("Attempted to call
 * resolveBarFillStyle() from the server"). Keep this file free of client-only APIs so both sides
 * can call it.
 */

export type BarFillState = 'covered' | 'current' | 'estimated' | 'uncovered'

export type BarFillStyle = {
  height: string
  backgroundColor?: string
  backgroundImage?: string
  opacity?: number
}

// UI-SPEC `## Sparkline Visual States` — one fill style per per-month state. 'estimated' and
// 'uncovered' never render a flat/zero-height bar: 'estimated' is normalized like any other bar,
// 'uncovered' is pinned to 100% height regardless of its (always '0.00') amount, so a data gap
// never reads as a month of zero spending.
export function resolveBarFillStyle(state: BarFillState, heightPercent: number, color: string): BarFillStyle {
  switch (state) {
    case 'covered':
      return { height: `${heightPercent}%`, backgroundColor: color, opacity: 0.45 }
    case 'current':
      return { height: `${heightPercent}%`, backgroundColor: color, opacity: 1 }
    case 'estimated':
      return {
        height: `${heightPercent}%`,
        backgroundImage: `repeating-linear-gradient(135deg, ${color} 0 3px, transparent 3px 6px)`,
      }
    case 'uncovered':
      return {
        height: '100%',
        backgroundImage: 'repeating-linear-gradient(45deg, transparent 0 3px, rgba(120,120,120,0.35) 3px 6px)',
      }
  }
}
