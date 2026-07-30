import type { TableConfig } from '@/lib/utils/table-config'

const STATUS_LABELS: Record<string, string> = {
  open: 'Aperto',
  closed: 'Chiuso',
}

/**
 * Declarative table config for the Amortizations list (Phase 79, REG-01/REG-03). Consumed by
 * DataTableToolbar — defines search, the status filter, sortable columns, and defaultSort.
 * Filtering/sorting here narrows the already-fetched `plans` row set client-side
 * (AmortizationTable), never a fresh server round-trip.
 *
 * Field inventory:
 *   - search: q (displayed description substring)
 *   - status: select (open/closed; absent/"Tutte" = all statuses via resolveEffectiveStatusFilter)
 *   - transactionId: deep-link from transaction detail (chip: "Transazione collegata")
 *   - sortable: remainingMonths, description, transactionDate, initialAmount, consumedAmount,
 *     netValue
 *   - defaultSort: remainingMonths ASC (D-C2 — plans closest to completion on top)
 */
export const AMORTIZATIONS_TABLE_CONFIG: TableConfig = {
  id: 'amortizations',
  search: { key: 'q', placeholder: 'Cerca per descrizione…' },
  filters: [
    {
      key: 'status',
      label: 'Stato',
      type: 'status',
      options: [
        { value: 'open', label: 'Aperto' },
        { value: 'closed', label: 'Chiuso' },
      ],
      toChip: (v) => STATUS_LABELS[v] ?? v,
    },
    // Deep-link from transaction detail (Visualizza ammortamento). Chip-only UX primary —
    // the Filtri sheet text input is secondary; Cancella tutto clears it via this field.
    {
      key: 'transactionId',
      label: 'Transazione',
      type: 'text',
      toChip: () => 'Transazione collegata',
    },
  ],
  sortable: [
    { key: 'remainingMonths', label: 'Rate rimanenti' },
    { key: 'description', label: 'Descrizione' },
    { key: 'transactionDate', label: 'Data' },
    { key: 'initialAmount', label: 'Importo iniziale' },
    { key: 'consumedAmount', label: 'Consumato' },
    { key: 'netValue', label: 'Netto' },
  ],
  defaultSort: { key: 'remainingMonths', dir: 'asc' },
}
