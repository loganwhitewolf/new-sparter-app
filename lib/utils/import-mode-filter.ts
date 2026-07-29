export type ImportMode = 'from-last' | 'all' | 'range'

export type ImportModeFilterableRow = {
  occurredAt: string | Date | null | undefined
}

export type ApplyImportModeFilterInput<T extends ImportModeFilterableRow> = {
  rows: readonly T[]
  mode: ImportMode
  lastImportedDate: string | null
  rangeStart?: string | null
  rangeEnd?: string | null
}

export type DateRangeWindow = {
  start: string | null
  end: string | null
}

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Calendar YYYY-MM-DD from ISO string or Date (UTC date slice). */
export function toCalendarDate(value: string | Date | null | undefined): string | null {
  if (value == null) return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return value.toISOString().slice(0, 10)
  }
  const trimmed = value.trim()
  if (!trimmed) return null
  if (DATE_ONLY_RE.test(trimmed)) return trimmed
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

function addCalendarDays(dateOnly: string, days: number): string | null {
  const match = DATE_ONLY_RE.exec(dateOnly)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const utc = new Date(Date.UTC(year, month - 1, day))
  utc.setUTCDate(utc.getUTCDate() + days)
  return utc.toISOString().slice(0, 10)
}

/**
 * Shared import mode filter for preview UI and importFile (D-01–D-04).
 * `all` keeps undated rows; from-last/range drop rows without a parseable date.
 */
export function applyImportModeFilter<T extends ImportModeFilterableRow>(
  input: ApplyImportModeFilterInput<T>,
): T[] {
  const { rows, mode, lastImportedDate, rangeStart, rangeEnd } = input

  switch (mode) {
    case 'all':
      return [...rows]
    case 'from-last': {
      if (lastImportedDate == null) {
        return rows.filter((row) => toCalendarDate(row.occurredAt) != null)
      }
      return rows.filter((row) => {
        const date = toCalendarDate(row.occurredAt)
        return date != null && date > lastImportedDate
      })
    }
    case 'range': {
      const start = rangeStart ?? null
      const end = rangeEnd ?? null
      return rows.filter((row) => {
        const date = toCalendarDate(row.occurredAt)
        if (date == null) return false
        if (start != null && date < start) return false
        if (end != null && date > end) return false
        return true
      })
    }
    default: {
      const _exhaustive: never = mode
      return _exhaustive
    }
  }
}

/** D-04: range defaults to day-after-last → fileEnd; empty platform → fileStart → fileEnd. */
export function defaultRangeWindow(
  lastImportedDate: string | null,
  fileStart: string | null,
  fileEnd: string | null,
): DateRangeWindow {
  if (lastImportedDate == null) {
    return { start: fileStart, end: fileEnd }
  }
  return {
    start: addCalendarDays(lastImportedDate, 1),
    end: fileEnd,
  }
}

/** D-06: min/max calendar dates of rows with a parseable occurredAt. */
export function periodSpan(rows: readonly ImportModeFilterableRow[]): DateRangeWindow {
  let start: string | null = null
  let end: string | null = null
  for (const row of rows) {
    const date = toCalendarDate(row.occurredAt)
    if (date == null) continue
    if (start == null || date < start) start = date
    if (end == null || date > end) end = date
  }
  return { start, end }
}
