/**
 * Resolves a year for the overview page based on D-04 logic.
 *
 * - If `years` (the ACTIVE lens's years) is empty, returns null (no data at all).
 * - If `requested` is present in `years`, returns that year.
 * - Otherwise, if `requested` is a member of `yearsForOtherLens` but not of `years` (D-10 —
 *   the requested period existed only under the OTHER lens, e.g. a future instalment-only year
 *   under competenza, and the user just flipped to cassa), clamp to the active lens's latest
 *   year (`years[0]`, since `years` is DESC) rather than falling through to the generic
 *   current-year/most-recent fallback below — that fallback would silently ignore that the
 *   mismatch came from a lens switch, not a stale bookmark.
 * - Otherwise, returns the current calendar year if it is in `years`,
 *   or the most recent year with data (years[0], since they are DESC).
 *
 * Guarantees: the returned year is always a member of `years` (HEAD-03).
 * Pure function — no DAL imports, no side effects.
 */
export function resolveYear(
  requested: string | undefined,
  years: string[],
  yearsForOtherLens?: string[],
): number | null {
  if (years.length === 0) return null

  // If the requested year is present in the list, use it.
  if (requested !== undefined && years.includes(requested)) {
    return Number(requested)
  }

  // D-10: requested existed only in the OTHER lens — clamp to the active lens's latest year.
  if (requested !== undefined && yearsForOtherLens?.includes(requested)) {
    return Number(years[0])
  }

  // Fall back: current calendar year if it has data, else most recent (years are DESC).
  const currentYear = String(new Date().getFullYear())
  if (years.includes(currentYear)) {
    return Number(currentYear)
  }

  return Number(years[0])
}
