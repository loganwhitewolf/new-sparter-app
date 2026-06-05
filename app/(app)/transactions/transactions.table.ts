import type { TableConfig } from '@/lib/utils/table-config'

/**
 * Declarative table config for the Transactions table (Wave 4).
 * Consumed by DataTableToolbar — defines search, filters, sortable columns, and defaultSort.
 *
 * Field inventory (LOCKED per D-19..D-25):
 *   - search: q (description / customTitle)
 *   - months: month-multi (occurredAt)
 *   - amount: amount-range (absolute value, D-20)
 *   - platform: select (via file join)
 *   - category: select (via subCategory → category join)
 *   - status: categorization — 2 states (D-21/D-23)
 *   - sortable: every displayed column (D-17); no status sort (not in display columns)
 */
export const transactionsTableConfig: TableConfig = {
  id: 'transactions',
  search: { key: 'q', placeholder: 'Nome o descrizione…' },
  filters: [
    {
      key: 'months',
      label: 'Mesi',
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
      key: 'category',
      label: 'Categoria',
      type: 'select',
      options: [],
      toChip: (v) => `Categoria: ${v}`,
    },
    {
      key: 'status',
      label: 'Categorizzazione',
      type: 'status',
      toChip: (v) =>
        v === 'categorized' ? 'Solo categorizzate' : 'Solo da categorizzare',
    },
  ],
  sortable: [
    { key: 'occurredAt', label: 'Data' },
    { key: 'amount', label: 'Importo' },
    { key: 'description', label: 'Descrizione' },
    { key: 'category', label: 'Categoria' },
    { key: 'platform', label: 'Piattaforma' },
  ],
  defaultSort: { key: 'occurredAt', dir: 'desc' },
}
