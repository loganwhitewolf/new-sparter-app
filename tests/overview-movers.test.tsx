import { describe, expect, it } from 'vitest'
import {
  formatMoverLine,
  splitMovers,
  takeTopMovers,
  moverAmountTone,
  moverQualifier,
} from '@/components/dashboard/overview/overview-movers-format'
import type { MonthOverMonthChange } from '@/lib/dal/overview'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const positiveItem: MonthOverMonthChange = {
  categoryId: 1,
  name: 'Spesa',
  delta: '42.50',
  isNew: false,
}

const negativeItem: MonthOverMonthChange = {
  categoryId: 2,
  name: 'Bollette',
  delta: '-30.00',
  isNew: false,
}

const isNewItem: MonthOverMonthChange = {
  categoryId: 3,
  name: 'Palestra',
  delta: '80.00',
  isNew: true,
}

const isNewItemWithNegativeDelta: MonthOverMonthChange = {
  categoryId: 4,
  name: 'Abbonamento',
  delta: '-20.00',
  isNew: true, // isNew wins regardless of delta sign
}

// ─── formatMoverLine ─────────────────────────────────────────────────────────

describe('formatMoverLine', () => {
  it('positive delta: produces "in più" sentence with absolute euro amount', () => {
    const result = formatMoverLine(positiveItem)
    expect(result).toContain('in più')
    expect(result).toContain('Spesa')
    expect(result).not.toContain('in meno')
    expect(result).not.toContain('spesa nuova')
  })

  it('negative delta: produces "in meno" sentence with absolute euro amount', () => {
    const result = formatMoverLine(negativeItem)
    expect(result).toContain('in meno')
    expect(result).toContain('Bollette')
    expect(result).not.toContain('in più')
    expect(result).not.toContain('spesa nuova')
    // must display absolute value (no negative sign)
    expect(result).not.toContain('-')
  })

  it('isNew: true → produces "spesa nuova" regardless of delta value', () => {
    const result = formatMoverLine(isNewItem)
    expect(result).toBe('Palestra · spesa nuova')
    expect(result).not.toContain('in più')
    expect(result).not.toContain('in meno')
    expect(result).not.toContain('%')
    expect(result).not.toContain('→')
  })

  it('isNew: true with negative delta → still produces "spesa nuova" (isNew wins)', () => {
    const result = formatMoverLine(isNewItemWithNegativeDelta)
    expect(result).toBe('Abbonamento · spesa nuova')
    expect(result).not.toContain('in meno')
  })

  it('MOVE-03: no output string contains "%" (no percentages)', () => {
    expect(formatMoverLine(positiveItem)).not.toContain('%')
    expect(formatMoverLine(negativeItem)).not.toContain('%')
    expect(formatMoverLine(isNewItem)).not.toContain('%')
  })

  it('MOVE-03: no output string contains "→" (no prev→curr arrows)', () => {
    expect(formatMoverLine(positiveItem)).not.toContain('→')
    expect(formatMoverLine(negativeItem)).not.toContain('→')
    expect(formatMoverLine(isNewItem)).not.toContain('→')
  })

  it('D-08: uses separator "·" between category name and sentence', () => {
    expect(formatMoverLine(positiveItem)).toContain('Spesa · ')
    expect(formatMoverLine(negativeItem)).toContain('Bollette · ')
    expect(formatMoverLine(isNewItem)).toContain('Palestra · ')
  })
})

// ─── takeTopMovers ───────────────────────────────────────────────────────────

describe('takeTopMovers', () => {
  const makeItem = (id: number): MonthOverMonthChange => ({
    categoryId: id,
    name: `Cat ${id}`,
    delta: '10.00',
    isNew: false,
  })

  it('caps at 5: 7 inputs return 5 outputs', () => {
    const items = [1, 2, 3, 4, 5, 6, 7].map(makeItem)
    expect(takeTopMovers(items)).toHaveLength(5)
  })

  it('passes through: 3 inputs return 3 outputs', () => {
    const items = [1, 2, 3].map(makeItem)
    expect(takeTopMovers(items)).toHaveLength(3)
  })

  it('preserves input order (takes first N)', () => {
    const items = [1, 2, 3, 4, 5, 6].map(makeItem)
    const result = takeTopMovers(items)
    expect(result.map((m) => m.categoryId)).toEqual([1, 2, 3, 4, 5])
  })

  it('custom limit: returns at most limit entries', () => {
    const items = [1, 2, 3, 4, 5].map(makeItem)
    expect(takeTopMovers(items, 3)).toHaveLength(3)
  })

  it('empty input returns empty array', () => {
    expect(takeTopMovers([])).toHaveLength(0)
  })
})

// ─── moverAmountTone ─────────────────────────────────────────────────────────

describe('moverAmountTone', () => {
  it('positive delta → "increase"', () => {
    expect(moverAmountTone({ categoryId: 1, name: 'X', delta: '10.00', isNew: false })).toBe('increase')
  })

  it('isNew with negative delta → "increase" (isNew wins)', () => {
    expect(moverAmountTone({ categoryId: 1, name: 'X', delta: '-20.00', isNew: true })).toBe('increase')
  })

  it('negative delta, not new → "decrease"', () => {
    expect(moverAmountTone({ categoryId: 1, name: 'X', delta: '-15.00', isNew: false })).toBe('decrease')
  })

  it('zero delta, not new → "decrease"', () => {
    expect(moverAmountTone({ categoryId: 1, name: 'X', delta: '0.00', isNew: false })).toBe('decrease')
  })
})

// ─── moverQualifier ──────────────────────────────────────────────────────────

describe('moverQualifier', () => {
  it('isNew → "spesa nuova"', () => {
    expect(moverQualifier({ categoryId: 1, name: 'X', delta: '50.00', isNew: true })).toBe('spesa nuova')
  })

  it('positive delta → "in più"', () => {
    expect(moverQualifier({ categoryId: 1, name: 'X', delta: '30.00', isNew: false })).toBe('in più')
  })

  it('negative delta → "in meno"', () => {
    expect(moverQualifier({ categoryId: 1, name: 'X', delta: '-25.00', isNew: false })).toBe('in meno')
  })

  it('isNew wins over positive delta', () => {
    expect(moverQualifier({ categoryId: 1, name: 'X', delta: '100.00', isNew: true })).toBe('spesa nuova')
  })
})

// ─── splitMovers ─────────────────────────────────────────────────────────────

describe('splitMovers', () => {
  it('empty array returns two empty arrays', () => {
    const result = splitMovers([])
    expect(result.increases).toEqual([])
    expect(result.savings).toEqual([])
  })

  it('positive delta item goes to increases', () => {
    const result = splitMovers([positiveItem])
    expect(result.increases).toContain(positiveItem)
    expect(result.savings).not.toContain(positiveItem)
  })

  it('negative delta item goes to savings', () => {
    const result = splitMovers([negativeItem])
    expect(result.savings).toContain(negativeItem)
    expect(result.increases).not.toContain(negativeItem)
  })

  it('D-07: isNew item goes to increases (not savings), even if delta is zero or negative', () => {
    const result = splitMovers([isNewItem])
    expect(result.increases).toContain(isNewItem)
    expect(result.savings).not.toContain(isNewItem)
  })

  it('D-07: isNew item with negative delta still lands in increases', () => {
    const result = splitMovers([isNewItemWithNegativeDelta])
    expect(result.increases).toContain(isNewItemWithNegativeDelta)
    expect(result.savings).not.toContain(isNewItemWithNegativeDelta)
  })

  it('mixed array: partitions correctly and preserves input order within each section', () => {
    const items = [positiveItem, negativeItem, isNewItem]
    const result = splitMovers(items)
    expect(result.increases).toEqual([positiveItem, isNewItem])
    expect(result.savings).toEqual([negativeItem])
  })

  it('all increases: savings is empty', () => {
    const result = splitMovers([positiveItem, isNewItem])
    expect(result.increases).toHaveLength(2)
    expect(result.savings).toHaveLength(0)
  })

  it('all savings: increases is empty', () => {
    const result = splitMovers([negativeItem])
    expect(result.increases).toHaveLength(0)
    expect(result.savings).toHaveLength(1)
  })
})
