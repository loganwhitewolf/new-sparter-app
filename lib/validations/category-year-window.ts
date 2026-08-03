// D-01/D-02/D-03 (Phase 84): the category detail page's window contract. This is the ONLY
// place window clamping happens — the DAL and every UI control trust its output verbatim
// (Pitfall 1). `months`/`from` mirror the two controls of the locked prototype variant A
// (.scratch/dashboard-categories/detail-table.html).

/** The four selectable window lengths (D-01). 12 = whole year, the implicit default. */
export const CATEGORY_DETAIL_WINDOW_LENGTHS = [12, 9, 6, 3] as const

export type CategoryDetailWindowLength = (typeof CATEGORY_DETAIL_WINDOW_LENGTHS)[number]

/** The parsed, already-clamped window: a length + a `YYYY-MM` start month, always inside `year`. */
export type CategoryDetailWindow = {
  months: CategoryDetailWindowLength
  from: string
}

function firstOf(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/**
 * Parses `?months=&from=` for the category detail page's URL contract (D-01), scoped to `year`.
 *
 * Total function — never throws, never returns a window crossing the year boundary (D-03):
 * - `months` absent/invalid (not one of 12/9/6/3) -> whole year: `{ months: 12, from: '{year}-01' }`.
 *   An explicit `months=12` degrades identically — a whole-year window always starts in January
 *   regardless of any `from` present in the URL.
 * - `months` a valid reduced length (9/6/3) and `from` absent -> D-02's "ends on the current
 *   month" default: `defaultEndMonth` is the current calendar month when `year` is the current
 *   year, else December (a closed past year); `defaultStartMonth` is clamped into
 *   `[1, 13 - months]` so the window never crosses the year boundary.
 * - `months` valid and `from=YYYY-MM` present -> the `YYYY` part is always ignored and
 *   re-stamped with this function's own `year` argument (D-04's free re-anchoring depends on
 *   this); the `MM` part is clamped into `[1, 13 - months]`, never rejected.
 */
export function parseCategoryDetailWindow(
  year: number,
  params: { months?: string | string[]; from?: string | string[] },
  today: Date = new Date(),
): CategoryDetailWindow {
  const rawMonths = firstOf(params.months)
  const monthsCandidate = rawMonths !== undefined ? Number(rawMonths) : Number.NaN
  const months = (CATEGORY_DETAIL_WINDOW_LENGTHS as readonly number[]).includes(monthsCandidate)
    ? (monthsCandidate as CategoryDetailWindowLength)
    : 12

  if (months === 12) {
    return { months: 12, from: `${year}-01` }
  }

  const maxStartMonth = 13 - months
  const rawFrom = firstOf(params.from)
  const fromMatch = rawFrom ? /^\d{4}-(\d{2})$/.exec(rawFrom) : null

  let startMonth: number

  if (fromMatch) {
    const parsedMonth = Number(fromMatch[1])
    startMonth = Number.isFinite(parsedMonth) ? Math.min(Math.max(parsedMonth, 1), maxStartMonth) : 1
  } else {
    const defaultEndMonth = year === today.getFullYear() ? today.getMonth() + 1 : 12
    const defaultStartMonth = defaultEndMonth - months + 1
    startMonth = Math.min(Math.max(defaultStartMonth, 1), maxStartMonth)
  }

  return { months, from: `${year}-${String(startMonth).padStart(2, '0')}` }
}
