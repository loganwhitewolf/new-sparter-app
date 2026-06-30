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
 * Declarative table config for the Expenses table (Wave 4, cascade extension lcp-01).
 * Consumed by DataTableToolbar — defines search, filters, sortable columns, and defaultSort.
 *
 * Field inventory (LOCKED per D-11, D-19..D-25; extended lcp-01, D-08):
 *   - search: q (title)
 *   - amount: amount-range (absolute value on totalAmount, D-20)
 *   - direction: select (direction code in/out/allocation/transfer/unclassified, D-08)
 *   - nature: select (FlowNature via subCategory, dependsOn:'direction')
 *   - category: select (via subCategory → category join)
 *   - subCategory: select (dependsOn:'category')
 *   - platform: select (via file join)
 *   - status: removed from toolbar — quick CTA in page header (quick-260630-dhw)
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
      dependsOn: 'direction',
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
  ],
  sortable: [
    { key: 'createdAt', label: 'Data' },
    { key: 'totalAmount', label: 'Importo' },
    { key: 'title', label: 'Titolo' },
    { key: 'category', label: 'Categoria' },
  ],
  defaultSort: { key: 'createdAt', dir: 'desc' },
}
