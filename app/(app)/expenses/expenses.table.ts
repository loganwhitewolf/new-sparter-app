import type { TableConfig } from '@/lib/utils/table-config'

/**
 * Declarative table config for the Expenses table (Wave 4).
 * Consumed by DataTableToolbar — defines search, filters, sortable columns, and defaultSort.
 *
 * Field inventory (LOCKED per D-11, D-19..D-25):
 *   - search: q (title)
 *   - amount: amount-range (absolute value on totalAmount, D-20)
 *   - category: select (via subCategory → category join)
 *   - platform: select (via file join)
 *   - status: categorization — 2 states (D-21/D-23)
 *   - NO month-multi filter (D-11 — Expenses have no temporal filter; aggregate entity)
 *   - sortable: every displayed column (D-17)
 */
export const expensesTableConfig: TableConfig = {
  id: 'expenses',
  search: { key: 'q', placeholder: 'Titolo…' },
  filters: [
    {
      key: 'amountMin',
      label: 'Importo (€)',
      type: 'amount-range',
      toChip: (v) => `Importo ≥ ${v} €`,
    },
    {
      key: 'category',
      label: 'Categoria',
      type: 'select',
      options: [],
      toChip: (v) => `Categoria: ${v}`,
    },
    {
      key: 'platform',
      label: 'Piattaforma',
      type: 'select',
      options: [],
      toChip: (v) => `Piattaforma: ${v}`,
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
    { key: 'createdAt', label: 'Data' },
    { key: 'totalAmount', label: 'Importo' },
    { key: 'title', label: 'Titolo' },
    { key: 'category', label: 'Categoria' },
  ],
  defaultSort: { key: 'createdAt', dir: 'desc' },
}
