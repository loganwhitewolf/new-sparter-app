export type FlowNature =
  | 'essential'
  | 'discretionary'
  | 'operational'
  | 'financial'
  | 'income'
  | 'debt'
  | 'extraordinary'
  | 'transfer'

export const NATURE_LABELS: Record<FlowNature | 'unclassified', string> = {
  essential: 'Essenziale',
  discretionary: 'Discrezionale',
  operational: 'Operativo',
  financial: 'Finanziario',
  income: 'Entrate',
  debt: 'Debiti',
  extraordinary: 'Straordinario',
  transfer: 'Trasferimento',
  unclassified: 'Non classificato',
}

export const NATURE_ORDER: ReadonlyArray<FlowNature | null> = [
  'essential',
  'discretionary',
  'operational',
  'financial',
  'income',
  'debt',
  'extraordinary',
  'transfer',
  null,
]

export const NATURE_COLORS: Record<FlowNature | 'unclassified', string> = {
  essential: '#4ade80',
  discretionary: '#f97316',
  operational: '#60a5fa',
  financial: '#a78bfa',
  income: '#34d399',
  debt: '#f87171',
  extraordinary: '#fbbf24',
  transfer: '#94a3b8',
  unclassified: '#a1a1aa',
}
