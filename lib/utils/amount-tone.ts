import { toDecimal } from '@/lib/utils/decimal'

type CategoryType = 'in' | 'out' | 'allocation' | 'transfer' | 'system' | null | undefined

export const AMOUNT_TONE_CLASS = {
  positive: 'text-total-in',
  negative: 'text-total-out',
  neutralTransfer: 'text-total-transfer/80',
  zero: 'text-foreground/80',
  fallback: 'text-foreground',
  allocation: 'text-total-out',
} as const

export function amountToneClass(amount: string, categoryType?: CategoryType): string {
  if (categoryType === 'transfer') return AMOUNT_TONE_CLASS.neutralTransfer
  if (categoryType === 'allocation') return AMOUNT_TONE_CLASS.allocation

  try {
    const value = toDecimal(amount)
    if (value.isZero()) return AMOUNT_TONE_CLASS.zero
    return value.isPositive() ? AMOUNT_TONE_CLASS.positive : AMOUNT_TONE_CLASS.negative
  } catch {
    return AMOUNT_TONE_CLASS.fallback
  }
}
