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
    default: {
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      return {
        from: previousMonth,
        to: endOfMonth(previousMonth.getFullYear(), previousMonth.getMonth()),
      }
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
