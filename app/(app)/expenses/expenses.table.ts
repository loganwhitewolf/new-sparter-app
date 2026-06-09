import { NATURE_LABELS } from '@/lib/utils/nature-labels'
import type { TableConfig } from '@/lib/utils/table-config'

const TYPE_LABELS: Record<string, string> = {
  in: 'Entrate',
  out: 'Uscite',
  transfer: 'Trasferimenti',
  unclassified: 'Non classificato',
}

/**
 * Declarative table config for the Expenses table (Wave 4, cascade extension lcp-01).
 * Consumed by DataTableToolbar — defines search, filters, sortable columns, and defaultSort.
 *
 * Field inventory (LOCKED per D-11, D-19..D-25; extended lcp-01):
 *   - search: q (title)
 *   - amount: amount-range (absolute value on totalAmount, D-20)
 *   - type: select (category type in/out/transfer/unclassified)
 *   - nature: select (FlowNature via subCategory, dependsOn:'type')
 *   - category: select (via subCategory → category join)
 *   - subCategory: select (dependsOn:'category')
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
      key: 'type',
      label: 'Tipo',
      type: 'select',
      options: [],
      toChip: (v) => `Tipo: ${TYPE_LABELS[v] ?? v}`,
    },
    {
      key: 'nature',
      label: 'Natura',
      type: 'select',
      dependsOn: 'type',
      options: [],
      toChip: (v) => `Natura: ${NATURE_LABELS[v as keyof typeof NATURE_LABELS] ?? v}`,
    },
    {
      key: 'category',
      label: 'Categoria',
      type: 'select',
      options: [],
      toChip: (v) => `Categoria: ${v}`,
    },
    {
      key: 'subCategory',
      label: 'Sottocategoria',
      type: 'select',
      dependsOn: 'category',
      options: [],
      toChip: (v) => `Sottocategoria: ${v}`,
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
