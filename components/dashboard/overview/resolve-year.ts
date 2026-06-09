/**
 * Resolves a year for the overview page based on D-04 logic.
 *
 * - If `years` is empty, returns null (no data at all).
 * - If `requested` is present in `years`, returns that year.
 * - Otherwise, returns the current calendar year if it is in `years`,
 *   or the most recent year with data (years[0], since they are DESC).
 *
 * Guarantees: the returned year is always a member of `years` (HEAD-03).
 * Pure function — no DAL imports, no side effects.
 */
export function resolveYear(requested: string | undefined, years: string[]): number | null {
  if (years.length === 0) return null

  // If the requested year is present in the list, use it.
  if (requested !== undefined && years.includes(requested)) {
    return Number(requested)
  }

  // Fall back: current calendar year if it has data, else most recent (years are DESC).
  const currentYear = String(new Date().getFullYear())
  if (years.includes(currentYear)) {
    return Number(currentYear)
  }

  return Number(years[0])
}
