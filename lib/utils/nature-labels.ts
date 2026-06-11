// v2.0 FlowNature vocabulary — 8 codes mirroring the seeded nature.code values.
// Renames: financial → investment, extraordinary → savings; operational dissolved.
export type FlowNature =
  | 'essential'
  | 'discretionary'
  | 'income'
  | 'income_extraordinary'
  | 'debt'
  | 'transfer'
  | 'savings'
  | 'investment'

export const NATURE_LABELS: Record<FlowNature | 'unclassified', string> = {
  essential: 'Essenziale',
  discretionary: 'Discrezionale',
  income: 'Entrate ricorrenti',
  income_extraordinary: 'Straordinaria',
  debt: 'Debiti',
  transfer: 'Trasferimento',
  savings: 'Risparmio',        // renamed from extraordinary (same label family)
  investment: 'Finanziario',   // renamed from financial (same label retained)
  unclassified: 'Non classificato',
}

export const NATURE_ORDER: ReadonlyArray<FlowNature | null> = [
  'essential',
  'discretionary',
  'income',
  'income_extraordinary',
  'debt',
  'transfer',
  'savings',
  'investment',
  null,
]

export const NATURE_COLORS: Record<FlowNature | 'unclassified', string> = {
  essential: '#4ade80',
  discretionary: '#f97316',
  income: '#34d399',
  income_extraordinary: '#a7f3d0',
  debt: '#f87171',
  transfer: '#94a3b8',
  savings: '#fbbf24',     // reuse old extraordinary color
  investment: '#a78bfa',  // reuse old financial color
  unclassified: '#a1a1aa',
}
