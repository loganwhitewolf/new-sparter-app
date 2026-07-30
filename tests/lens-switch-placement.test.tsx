import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Source-inspection test (not a rendered component tree): this repo's Node-only test env has
// no jsdom for a full RSC render, so D-12/RETIRE-03's "renders no LensSwitch" claim is verified
// by grepping the compiled-away source text instead — the established pattern noted in prior
// SUMMARYs (e.g. tests/dashboard-filters.test.ts's grep-style assertions).
function readSource(relativePath: string): string {
  return readFileSync(`${process.cwd()}/${relativePath}`, 'utf-8')
}

describe('LensSwitch render-site placement (D-12, RETIRE-03)', () => {
  it('Categories list page renders no LensSwitch and resolves no ledgerRowSource from the URL', () => {
    const source = readSource('app/(app)/dashboard/categories/page.tsx')
    expect(source).not.toContain('<LensSwitch')
    expect(source).not.toContain('resolveLedgerRowSource(')
  })

  it('Categories detail page renders no LensSwitch and resolves no ledgerRowSource from the URL', () => {
    const source = readSource('app/(app)/dashboard/categories/[id]/page.tsx')
    expect(source).not.toContain('<LensSwitch')
    expect(source).not.toContain('resolveLedgerRowSource(')
  })

  it('Tags page renders no LensSwitch (already compliant, LSD-05 — verify only, no edit)', () => {
    const source = readSource('app/(app)/dashboard/tags/page.tsx')
    expect(source).not.toContain('<LensSwitch')
  })

  it('Overview header remains the sole LensSwitch render site', () => {
    const source = readSource('components/dashboard/overview/overview-header.tsx')
    expect(source).toContain('<LensSwitch')
  })
})
