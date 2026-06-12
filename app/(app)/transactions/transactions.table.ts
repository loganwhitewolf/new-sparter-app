import { NATURE_LABELS } from '@/lib/utils/nature-labels'
import type { TableConfig } from '@/lib/utils/table-config'

const DIRECTION_LABELS: Record<string, string> = {
  in: 'Entrate',
  out: 'Uscite',
  allocation: 'Accantonamenti',
  transfer: 'Trasferimenti',
  unclassified: 'Non classificato',
}

/**
 * Declarative table config for the Transactions table (Wave 4, cascade extension lcp-01).
 * Consumed by DataTableToolbar — defines search, filters, sortable columns, and defaultSort.
 *
 * Field inventory (LOCKED per D-19..D-25; extended lcp-01, D-08):
 *   - search: q (description / customTitle)
 *   - months: month-multi (occurredAt)
 *   - amount: amount-range (absolute value, D-20)
 *   - platform: select (via file join)
 *   - direction: select (direction code In/Out/Accantonamenti/Trasferimenti, D-08)
 *   - nature: select (FlowNature via subCategory, dependsOn:'direction')
 *   - category: select (via subCategory → category join)
 *   - subCategory: select (dependsOn:'category')
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
      key: 'direction',
      label: 'Direzione',
      type: 'select',
      options: [],
      toChip: (v) => `Direzione: ${DIRECTION_LABELS[v] ?? v}`,
    },
    {
      key: 'nature',
      label: 'Natura',
      type: 'select',
      dependsOn: 'direction',
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
