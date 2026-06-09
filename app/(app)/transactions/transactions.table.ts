import { NATURE_LABELS } from '@/lib/utils/nature-labels'
import type { TableConfig } from '@/lib/utils/table-config'

const TYPE_LABELS: Record<string, string> = {
  in: 'Entrate',
  out: 'Uscite',
  transfer: 'Trasferimenti',
  unclassified: 'Non classificato',
}

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
 *   - nature: select (FlowNature via subCategory, Task 1)
 *   - type: select (category type In/Out/Transfer, Task 1)
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
    {
      key: 'nature',
      label: 'Natura',
      type: 'select',
      options: [],
      toChip: (v) => `Natura: ${NATURE_LABELS[v as keyof typeof NATURE_LABELS] ?? v}`,
    },
    {
      key: 'type',
      label: 'Tipo',
      type: 'select',
      options: [],
      toChip: (v) => `Tipo: ${TYPE_LABELS[v] ?? v}`,
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
