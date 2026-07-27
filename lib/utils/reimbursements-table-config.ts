import type { TableConfig } from '@/lib/utils/table-config'

const STATUS_LABELS: Record<string, string> = {
  owed: 'Dovuti',
  settled: 'Saldato',
  surplus: 'Surplus',
}

/**
 * Declarative table config for the Reimbursements list (Phase 76 Plan 02, RMB-10).
 * Consumed by DataTableToolbar — defines search, the status filter, sortable columns, and
 * defaultSort. Filtering/sorting here narrows the already-fetched `reimbursements` row set
 * client-side (ReimbursementTable), never a fresh server round-trip — see D-01.
 *
 * Field inventory:
 *   - search: q (title or anchor title substring, D-03)
 *   - status: select (owed/settled/surplus, D-11 — the exact 3-state vocabulary)
 *   - sortable: title, anchorDate, residual (D-02 default: anchorDate desc)
 */
export const REIMBURSEMENTS_TABLE_CONFIG: TableConfig = {
  id: 'reimbursements',
  search: { key: 'q', placeholder: 'Cerca per titolo o ancora…' },
  filters: [
    {
      key: 'status',
      label: 'Stato',
      type: 'status',
      options: [
        { value: 'owed', label: 'Dovuti' },
        { value: 'settled', label: 'Saldato' },
        { value: 'surplus', label: 'Surplus' },
      ],
      toChip: (v) => STATUS_LABELS[v] ?? v,
    },
  ],
  sortable: [
    { key: 'anchorDate', label: 'Data' },
    { key: 'title', label: 'Titolo' },
    { key: 'residual', label: 'Netto' },
  ],
  defaultSort: { key: 'anchorDate', dir: 'desc' },
}
