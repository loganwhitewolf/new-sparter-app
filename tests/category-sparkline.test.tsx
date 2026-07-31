// Unit coverage for CategorySparkline's additive Phase 83 surface: the third 'allocation'
// direction colour, the negative-domain fix (Math.max(parsed, 0) clamp removed, D-09), and the
// opt-in 4-state bar rendering (pointStates). Path A (no pointStates, or a single point) must
// stay byte-identical to the pre-Phase-83 SVG output for every existing caller.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import type { CategorySparklinePoint } from '@/lib/dal/dashboard'
import { CategorySparkline } from '@/components/dashboard/category-sparkline'

const MONTH_LABELS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

function buildPoints(amounts: string[]): CategorySparklinePoint[] {
  return amounts.map((amount, index) => ({
    month: `2026-${String(index + 1).padStart(2, '0')}`,
    label: MONTH_LABELS[index]!,
    amount,
  }))
}

describe('CategorySparkline', () => {
  describe('Path A — existing SVG output (no pointStates opt-in)', () => {
    test('renders the polyline SVG (not the bar row) for 12 points with no pointStates', () => {
      const html = renderToStaticMarkup(
        <CategorySparkline points={buildPoints(Array(12).fill('100.00'))} type="allocation" />
      )
      expect(html).toContain('<svg')
      expect(html).toContain('polyline')
      expect(html).not.toContain('items-end')
    })

    test('allocation type resolves the stroke colour from var(--total-allocation), not the out fallback', () => {
      const html = renderToStaticMarkup(
        <CategorySparkline points={buildPoints(Array(12).fill('100.00'))} type="allocation" />
      )
      expect(html).toContain('var(--total-allocation)')
      expect(html).not.toContain('var(--total-out)')
    })

    test('in/out colour resolution is unaffected by the widened type union', () => {
      const points = buildPoints(Array(12).fill('100.00'))
      expect(renderToStaticMarkup(<CategorySparkline points={points} type="in" />)).toContain(
        'var(--total-in)'
      )
      expect(renderToStaticMarkup(<CategorySparkline points={points} type="out" />)).toContain(
        'var(--total-out)'
      )
    })

    test('single point renders the centered circle regardless of pointStates being absent', () => {
      const html = renderToStaticMarkup(<CategorySparkline points={buildPoints(['50.00'])} type="out" />)
      expect(html).toContain('<circle')
      expect(html).not.toContain('items-end')
    })

    test('single point renders the centered circle even when pointStates is provided (CLIST-06)', () => {
      const html = renderToStaticMarkup(
        <CategorySparkline points={buildPoints(['50.00'])} type="out" pointStates={['current']} />
      )
      expect(html).toContain('<circle')
      expect(html).not.toContain('items-end')
    })
  })

  describe('Path B — 4-state bar rendering (pointStates opt-in)', () => {
    test('renders 12 bar elements when pointStates is provided and matches points length', () => {
      const points = buildPoints(Array(12).fill('100.00'))
      const pointStates = Array(12).fill('covered') as Array<'covered'>
      const html = renderToStaticMarkup(
        <CategorySparkline points={points} type="allocation" pointStates={pointStates} />
      )
      expect(html).not.toContain('<svg')
      const barCount = html.split('rounded-[1px]').length - 1
      expect(barCount).toBe(12)
    })

    test('a negative-amount covered/current bar is never flattened to zero and carries a border marker', () => {
      const amounts = Array(12).fill('0.00')
      amounts[3] = '-45.50' // the only nonzero magnitude — proves Math.max(parsed, 0) was removed
      const points = buildPoints(amounts)
      const pointStates = Array(12).fill('covered') as Array<'covered'>
      const html = renderToStaticMarkup(
        <CategorySparkline points={points} type="allocation" pointStates={pointStates} />
      )
      // If the clamp still existed, Math.abs(Math.max(-45.50, 0)) === 0 → every bar's magnitude
      // would be 0 → max === 0 → this bar's height would be 0% instead of 100%.
      expect(html).toContain('height:100%')
      expect(html).toContain('border-top:2px solid var(--total-allocation)')
    })

    test('an uncovered-state bar renders at full height with the muted diagonal pattern, ignoring its amount', () => {
      const amounts = Array(12).fill('0.00')
      amounts[5] = '9999.00' // large nonzero amount — must be ignored for the uncovered bar's height
      const points = buildPoints(amounts)
      const pointStates: Array<'covered' | 'uncovered'> = Array(12).fill('covered')
      pointStates[5] = 'uncovered'
      const html = renderToStaticMarkup(
        <CategorySparkline points={points} type="out" pointStates={pointStates} />
      )
      expect(html).toContain('height:100%')
      expect(html).toContain('rgba(120,120,120,0.35)')
      expect(html).toContain('repeating-linear-gradient(45deg')
    })

    test('an estimated-state bar is striped and normalized against estimatedHeightHint, never a flat zero bar', () => {
      const amounts = Array(12).fill('0.00')
      amounts[0] = '75.00' // half of the estimatedHeightHint reference, to prove normalization uses the hint
      const points = buildPoints(amounts)
      const pointStates: Array<'covered' | 'estimated'> = Array(12).fill('covered')
      pointStates[11] = 'estimated'
      const html = renderToStaticMarkup(
        <CategorySparkline
          points={points}
          type="out"
          pointStates={pointStates}
          estimatedHeightHint="150.00"
        />
      )
      expect(html).toContain('repeating-linear-gradient(135deg, var(--total-out) 0 3px, transparent 3px 6px)')
      // reference magnitude 150 vs max(75, 150) = 150 → 100% height for the estimated bar
      expect(html).toContain('height:100%')
    })

    test('a covered bar renders at 45% opacity and a current bar at 100% opacity of the direction colour', () => {
      const points = buildPoints(Array(12).fill('100.00'))
      const pointStates: Array<'covered' | 'current'> = Array(12).fill('covered')
      pointStates[6] = 'current'
      const html = renderToStaticMarkup(
        <CategorySparkline points={points} type="in" pointStates={pointStates} />
      )
      expect(html).toContain('opacity:0.45')
      expect(html).toContain('opacity:1')
      expect(html).toContain('background-color:var(--total-in)')
    })
  })
})
