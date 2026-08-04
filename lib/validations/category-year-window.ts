// CDET-VIEW-01..05 (260804-br9): the category detail page's view contract. This is the ONLY
// place `?view=` parsing happens — the DAL and every UI control trust its output verbatim.

function firstOf(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/** The two selectable views (CDET-VIEW-02). `ytd` is the implicit default. */
export type CategoryDetailView = 'ytd' | 'projection'

/**
 * Parses `?view=` for the category detail page's URL contract (CDET-VIEW-02/04), scoped to the
 * current year only implicitly — this function has no year-awareness of its own.
 *
 * Total function — never throws: `'projection'` only when the first value is exactly
 * `'projection'`, `'ytd'` for every other input (absent, an array whose first element isn't
 * `'projection'`, garbage like `'months=6'`, anything else). This is the "stale deep link
 * degrades silently" contract (CDET-VIEW-04) — there is nothing left to validate against, so
 * there is no error path to construct.
 */
export function parseCategoryDetailView(params: { view?: string | string[] }): CategoryDetailView {
  return firstOf(params.view) === 'projection' ? 'projection' : 'ytd'
}
