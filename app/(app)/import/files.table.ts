import type { TableConfig } from '@/lib/utils/table-config'

/**
 * Declarative table config for the Files (import) table (Wave 4).
 * Consumed by DataTableToolbar — defines search, filters, sortable columns, and defaultSort.
 *
 * Field inventory (LOCKED per D-22, D-23, O-02):
 *   - search: q (filename / display label)
 *   - months: month-multi (coverage months via referenceStartedAt)
 *   - amount: amount-range (absolute value on negativeTotal, D-20)
 *   - platform: select (via importFormatVersion join)
 *   - statusBucket: status with 3 processing buckets (D-22/D-23: label 'Elaborazione')
 *   - NO category filter (field inventory: Files have no category)
 *   - sortable: every displayed data column (O-02: import date sortable, not a filter)
 */
export const filesTableConfig: TableConfig = {
  id: 'files',
  search: { key: 'q', placeholder: 'Nome file…' },
  filters: [
    {
      key: 'months',
      label: 'Mesi coperti',
      type: 'month-multi',
      toChip: (v) => `Mesi: ${v}`,
    },
    {
      key: 'amountMin',
      label: 'Importo (€)',
      type: 'amount-range',
      toChip: (v) => `Importo ≥ ${v} €`,
    },
    {
      key: 'platform',
      label: 'Piattaforma',
      type: 'select',
      options: [],
      toChip: (v) => `Piattaforma: ${v}`,
    },
    {
      key: 'statusBucket',
      label: 'Elaborazione',
      type: 'status',
      options: [
        { value: 'imported', label: 'Importato' },
        { value: 'pending', label: 'Da completare' },
        { value: 'failed', label: 'In errore' },
      ],
      toChip: (v) => {
        if (v === 'imported') return 'Importato'
        if (v === 'pending') return 'Da completare'
        if (v === 'failed') return 'In errore'
        return v
      },
    },
  ],
  sortable: [
    { key: 'displayName', label: 'File' },
    { key: 'status', label: 'Stato' },
    { key: 'platform', label: 'Piattaforma' },
    { key: 'importedAt', label: 'Importato il' },
    { key: 'rowCount', label: 'Righe' },
    { key: 'positiveTotal', label: 'Totale entrate' },
    { key: 'negativeTotal', label: 'Totale uscite' },
    { key: 'referenceStartedAt', label: 'Periodo' },
  ],
  defaultSort: { key: 'importedAt', dir: 'desc' },
}
