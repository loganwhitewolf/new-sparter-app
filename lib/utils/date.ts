export const DASHBOARD_PRESETS = [
  'last-month',
  'last-3-months',
  'last-6-months',
  'this-year',
  'last-year',
] as const

export type DashboardPreset = (typeof DASHBOARD_PRESETS)[number]
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

export function dashboardPresetToDateRange(
  preset: DashboardPreset | string,
  now = new Date()
): DateRange {
  const to = endOfMonth(now.getFullYear(), now.getMonth())

  switch (preset) {
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
    case 'last-month':
    default:
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        to: endOfMonth(now.getFullYear(), now.getMonth() - 1),
      }
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
