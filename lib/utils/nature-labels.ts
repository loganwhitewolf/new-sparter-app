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

// Compiler-enforced exhaustiveness anchor for NATURE_FILTER_VALUES below: adding a 9th
// FlowNature member and forgetting to add its key here fails `tsc` with a missing-property
// error; removing a member while leaving a stale key here fails `tsc` with an excess-property
// error. This is what makes the ?nature= filter allowlist structurally impossible to drift out
// of sync with FlowNature (dead codes lingering, live codes missing) the way it did before.
const FLOW_NATURE_MEMBERS: Record<FlowNature, true> = {
  essential: true,
  discretionary: true,
  income: true,
  income_extraordinary: true,
  debt: true,
  transfer: true,
  savings: true,
  investment: true,
}

/**
 * Single source of truth for the `?nature=` filter allowlist consumed by
 * lib/validations/transactions.ts and lib/validations/expense.ts. Derived from FLOW_NATURE_MEMBERS
 * plus the 'unclassified' sentinel (no category assigned) — never hand-maintained as a separate
 * literal.
 */
export const NATURE_FILTER_VALUES: readonly string[] = [
  ...Object.keys(FLOW_NATURE_MEMBERS),
  'unclassified',
]

export const NATURE_LABELS: Record<FlowNature | 'unclassified', string> = {
  essential: 'Essenziale',
  discretionary: 'Discrezionale',
  income: 'Entrate ricorrenti',
  income_extraordinary: 'Straordinaria',
  debt: 'Debiti',
  transfer: 'Trasferimento',
  savings: 'Risparmio',        // renamed from extraordinary (same label family)
  investment: 'Investimento',
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

/**
 * Maps FlowNature codes to their seed-data nature.id values (stable — seeded once in Phase 46).
 * Used to resolve a nature code to its DB id for write operations.
 */
export const NATURE_ID_BY_CODE: Record<FlowNature, number> = {
  income: 1,
  income_extraordinary: 2,
  essential: 3,
  discretionary: 4,
  debt: 5,
  transfer: 6,
  savings: 7,
  investment: 8,
}

/** Ledger direction codes (nature.direction_id → direction.code). */
export type DirectionCode = 'in' | 'out' | 'allocation' | 'transfer'

export const DIRECTION_LABELS: Record<DirectionCode, string> = {
  in: 'Entrate',
  out: 'Uscite',
  allocation: 'Accantonamenti',
  transfer: 'Trasferimenti',
}

export const DIRECTION_ORDER: readonly DirectionCode[] = [
  'out',
  'in',
  'allocation',
  'transfer',
]

/** Natures that belong to each direction (seed nature.direction_id). */
export const NATURES_BY_DIRECTION: Record<DirectionCode, readonly FlowNature[]> = {
  in: ['income', 'income_extraordinary'],
  out: ['essential', 'discretionary', 'debt'],
  allocation: ['savings', 'investment'],
  transfer: ['transfer'],
}

/**
 * Default nature when adding a subcategory under a direction-scoped category.
 */
export const DEFAULT_NATURE_BY_DIRECTION: Record<DirectionCode, FlowNature> = {
  in: 'income',
  out: 'discretionary',
  allocation: 'savings',
  transfer: 'transfer',
}

/** Stable seed ids for direction.code (scripts/seed-data.ts). */
export const DIRECTION_ID_BY_CODE: Record<DirectionCode, number> = {
  in: 1,
  out: 2,
  allocation: 3,
  transfer: 4,
}

export function isDirectionCode(value: string | null | undefined): value is DirectionCode {
  return value === 'in' || value === 'out' || value === 'allocation' || value === 'transfer'
}
