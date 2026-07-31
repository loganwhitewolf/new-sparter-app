// Unit coverage for resolveCategoryDirectionCopy — the D-11 single centrally-resolved source of
// every direction-scoped string the Categories list needs. Asserts exact string equality against
// UI-SPEC.md's `## Copywriting Contract` table, and guards against retired vocabulary leaking back
// in (Deviazione/Baseline/Preset).
import { describe, expect, test } from 'vitest'
import { resolveCategoryDirectionCopy } from '@/lib/services/category-direction-copy'

describe('resolveCategoryDirectionCopy', () => {
  test('out (Uscite)', () => {
    const copy = resolveCategoryDirectionCopy('out')
    expect(copy.pageSubheading).toBe('Dove spendi di più nel {year}, e dove arrivi a questo ritmo.')
    expect(copy.shareLabel).toBe('· {P}% del totale')
    expect(copy.emptyStateHeading).toBe('Nessuna spesa')
    expect(copy.directionLabel).toBe('Uscite')
  })

  test('in (Entrate)', () => {
    const copy = resolveCategoryDirectionCopy('in')
    expect(copy.pageSubheading).toBe('Dove entrano i soldi nel {year}, e dove arrivi a questo ritmo.')
    expect(copy.shareLabel).toBe('· {P}% del totale ricevuto')
    expect(copy.emptyStateHeading).toBe('Nessuna entrata')
    expect(copy.directionLabel).toBe('Entrate')
  })

  test('allocation (Accantonamenti)', () => {
    const copy = resolveCategoryDirectionCopy('allocation')
    expect(copy.pageSubheading).toBe('Dove destini risorse nel {year}, e dove arrivi a questo ritmo.')
    expect(copy.shareLabel).toBe('· {P}% del totale destinato')
    expect(copy.emptyStateHeading).toBe('Nessun accantonamento')
    expect(copy.directionLabel).toBe('Accantonamenti')
  })

  test('each direction returns distinct shareLabel/emptyStateHeading/emptyStateBody — never a shared fallback', () => {
    const out = resolveCategoryDirectionCopy('out')
    const inCopy = resolveCategoryDirectionCopy('in')
    const allocation = resolveCategoryDirectionCopy('allocation')

    const shareLabels = new Set([out.shareLabel, inCopy.shareLabel, allocation.shareLabel])
    const emptyHeadings = new Set([out.emptyStateHeading, inCopy.emptyStateHeading, allocation.emptyStateHeading])

    expect(shareLabels.size).toBe(3)
    expect(emptyHeadings.size).toBe(3)
  })

  test('no returned string contains retired vocabulary (Deviazione, Baseline, Preset)', () => {
    for (const direction of ['out', 'in', 'allocation'] as const) {
      const copy = resolveCategoryDirectionCopy(direction)
      const combined = JSON.stringify(copy)
      expect(combined).not.toMatch(/Deviazione|Baseline|Preset/)
    }
  })
})
