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
  /**
   * When set, this field is a dependent child of the field identified by the given key.
   * The toolbar resolves this field's options from dependentOptions[this.key][parentUrlValue]
   * (or the '' all-bucket when the parent is unset). Pure types only — no runtime code.
   */
  dependsOn?: string
  /**
   * Converts the raw URL value to a display chip label.
   * The optional second argument is the resolved option label for select /
   * multi-select fields (the toolbar matches the raw value against the effective
   * option set and passes the matched label). Filters whose chip is derived
   * purely from the raw value ignore it; filters whose stored value is an id
   * (e.g. the tag filter) use it to show a human-readable name. Additive and
   * backward-compatible — single-parameter toChip implementations stay assignable.
   */
  toChip: (v: string, label?: string) => string
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
