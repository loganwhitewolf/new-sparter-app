/**
 * Shared type vocabulary for the unified filter + sort toolbar system.
 * Consumed by DataTableToolbar (Wave 2) and per-table config files (Wave 4).
 * Pure types only — no runtime code.
 */

export type FilterFieldType =
  | 'text'
  | 'select'
  | 'multi-select'
  | 'month-multi'
  | 'amount-range'
  | 'status'

export type FilterField = {
  key: string
  label: string
  type: FilterFieldType
  options?: { value: string; label: string }[]
  /** Converts raw URL value to display chip label */
  toChip: (v: string) => string
}

export type SortColumn = {
  key: string
  label: string
}

export type TableConfig = {
  id: 'transactions' | 'expenses' | 'files'
  search: { key: 'q'; placeholder: string } | null
  filters: FilterField[]
  sortable: SortColumn[]
  defaultSort: { key: string; dir: 'asc' | 'desc' }
}
