export type ExpensePeriod =
  | 'this-month'
  | 'last-3-months'
  | 'last-6-months'
  | 'this-year'
  | 'last-year'
export type DateRange = { from: Date; to: Date }

function endOfMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0, 23, 59, 59, 999)
}

export function periodToDateRange(period: ExpensePeriod | string, now = new Date()): DateRange {
  const to = endOfMonth(now.getFullYear(), now.getMonth())

  switch (period) {
    case 'last-3-months':
      return { from: new Date(now.getFullYear(), now.getMonth() - 2, 1), to }
    case 'last-6-months':
      return { from: new Date(now.getFullYear(), now.getMonth() - 5, 1), to }
    case 'this-year':
      return { from: new Date(now.getFullYear(), 0, 1), to }
    case 'last-year':
      return {
        from: new Date(now.getFullYear() - 1, 0, 1),
        to: new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999),
      }
    default:
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to }
  }
}

export function monthKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function monthLabel(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('it-IT', { month: 'short' }).format(
    new Date(year, monthNumber - 1, 1)
  )
}

export function monthsBetween(from: Date, to: Date): string[] {
  const months: string[] = []
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1)
  const end = new Date(to.getFullYear(), to.getMonth(), 1)

  while (cursor <= end) {
    months.push(monthKey(cursor))
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return months
}

/**
 * Formats an Italian short month abbreviation from a Date.
 * Strips trailing dot (Intl may emit "mag." in some locales) and capitalizes first letter.
 * Examples: "Mag", "Gen", "Dic"
 */
function formatMonthShort(date: Date, locale: string): string {
  const raw = new Intl.DateTimeFormat(locale, { month: 'short' }).format(date)
  const stripped = raw.replace(/\.$/, '')
  return stripped.charAt(0).toUpperCase() + stripped.slice(1)
}

/**
 * Formats a date range as a human-readable Italian short-month label (R-OB-10 / D-10).
 *
 * - Same month+year: "Mag 2026"
 * - Same year, different months: "Apr–Mag 2026" (en-dash U+2013)
 * - Different years: "Dic 2025–Gen 2026"
 *
 * Month names are produced by Intl.DateTimeFormat with the given locale (default 'it-IT').
 */
export function formatMonthRange(first: Date, last: Date, locale = 'it-IT'): string {
  const firstYear = first.getFullYear()
  const lastYear = last.getFullYear()
  const firstShort = formatMonthShort(first, locale)
  const lastShort = formatMonthShort(last, locale)

  if (firstYear === lastYear && first.getMonth() === last.getMonth()) {
    // Single month
    return `${firstShort} ${firstYear}`
  }

  if (firstYear === lastYear) {
    // Same year, different months — append year once at the end
    return `${firstShort}–${lastShort} ${firstYear}`
  }

  // Different years — each side includes its own year
  return `${firstShort} ${firstYear}–${lastShort} ${lastYear}`
}

/**
 * Where a date falls on a Jan 1 -> Dec 31 timeline for `year`, as a percentage.
 * Jan 1 00:00:00.000 -> 0, Dec 31 23:59:59.999 -> 100. Dates outside the year are
 * clamped (never negative, never above 100) — used to position a range-bar fill
 * (GBH-01) without requiring the caller to pre-validate the date is in-year.
 */
export function yearProgressPercent(date: Date, year: number): number {
  const start = new Date(year, 0, 1).getTime()
  const end = new Date(year, 11, 31, 23, 59, 59, 999).getTime()
  const clamped = Math.min(Math.max(date.getTime(), start), end)
  return ((clamped - start) / (end - start)) * 100
}

/**
 * Formats a day+month range for the platform year-coverage bar (GBH-01):
 * "1 gen – 30 apr" — day number + lowercase Italian short month, en-dash separator,
 * no year (the enclosing section already scopes to a single year). Deliberately does
 * NOT capitalize (unlike formatMonthShort's "Mag 2026" style) and does not dedupe a
 * same-day start/end — the caller decides whether to collapse a single-day range.
 */
export function formatDayMonthRange(start: Date, end: Date, locale = 'it-IT'): string {
  const format = (date: Date) => {
    const shortMonth = new Intl.DateTimeFormat(locale, { month: 'short' })
      .format(date)
      .replace(/\.$/, '')
    return `${date.getDate()} ${shortMonth}`
  }

  return `${format(start)} – ${format(end)}`
}

/**
 * Day + long month for highlight copy (GBH-01): "17 luglio". Lowercase Italian month,
 * no year — the coverage card already scopes to a selected year.
 */
export function formatDayMonthLong(date: Date, locale = 'it-IT'): string {
  const longMonth = new Intl.DateTimeFormat(locale, { month: 'long' })
    .format(date)
    .replace(/\.$/, '')
  return `${date.getDate()} ${longMonth}`
}

/**
 * Optional-range label for entities carrying a nullable start/end pair (e.g. a tag's
 * descriptive date range). Either bound missing means "no range" — a half-open range is not
 * a meaningful label here.
 */
export function formatOptionalDateRange(
  start: Date | null,
  end: Date | null,
  locale = 'it-IT',
): string {
  if (!start || !end) return 'Nessun intervallo'
  return `${start.toLocaleDateString(locale)} — ${end.toLocaleDateString(locale)}`
}
