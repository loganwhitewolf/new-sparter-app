import {
  CreditCard,
  Home,
  PiggyBank,
  Repeat,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { NATURE_COLORS } from '@/lib/utils/nature-labels'
import type { AllocationKey, IncomeKey, OutKey } from './overview-chart-utils'

/**
 * Shared nature identity: one icon + one colour per chart nature key (260711-gfd
 * follow-up). The SAME glyph appears under the KPI composition bars AND on the filter
 * chips, so the user learns a symbol once and recognises it in both places. Colour is
 * the nature's NATURE_COLORS identity (distinct per nature) — stable across chip and
 * legend; the composition bar keeps its own monochrome ramp (proportion, not identity).
 */
export type NatureKey = IncomeKey | OutKey | AllocationKey

export const NATURE_ICONS: Record<NatureKey, LucideIcon> = {
  recurring: Repeat,
  extraordinary: Sparkles,
  essential: Home,
  discretionary: ShoppingBag,
  debt: CreditCard,
  savings: PiggyBank,
  investment: TrendingUp,
}

/** Identity colour per chart key (recurring/extraordinary map onto the income hues). */
export const NATURE_KEY_COLORS: Record<NatureKey, string> = {
  recurring: NATURE_COLORS.income,
  extraordinary: NATURE_COLORS.income_extraordinary,
  essential: NATURE_COLORS.essential,
  discretionary: NATURE_COLORS.discretionary,
  debt: NATURE_COLORS.debt,
  savings: NATURE_COLORS.savings,
  investment: NATURE_COLORS.investment,
}
