'use client'

import { Input } from '@/components/ui/input'

// ---- Props -----------------------------------------------------------------

type AmountRangePickerProps = {
  min: string
  max: string
  onMin: (v: string) => void
  onMax: (v: string) => void
}

// ---- Component -------------------------------------------------------------

/**
 * Two numeric inputs for absolute-value amount range (D-20).
 * Absolute-value semantics are enforced DAL-side (Wave 4); the UI collects
 * two non-negative numbers and writes amountMin / amountMax to the URL.
 */
export function AmountRangePicker({ min, max, onMin, onMax }: AmountRangePickerProps) {
  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        inputMode="decimal"
        placeholder="min €"
        value={min}
        onChange={(e) => onMin(e.currentTarget.value)}
        className="w-24"
      />
      <span className="text-muted-foreground">–</span>
      <Input
        type="number"
        inputMode="decimal"
        placeholder="max €"
        value={max}
        onChange={(e) => onMax(e.currentTarget.value)}
        className="w-24"
      />
    </div>
  )
}
