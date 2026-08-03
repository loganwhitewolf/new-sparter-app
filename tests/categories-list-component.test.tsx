import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import type * as React from 'react'

// VALIDATION.md Wave-0 requirement (Plan 83-04): a dedicated component-level test for the
// Categories page's testable pieces (DirectionFilter/SortToggle/NoYearsEmptyState), extracted
// into components/dashboard/category-list-controls.tsx (Rule 3 auto-fix: Next.js's App Router
// route-typing rejects any named export from a page.tsx file beyond its allowed route exports —
// see that file's header comment). The page's own default export is an async Server Component
// awaiting DAL calls and is not exercised here; only its testable sub-components are.
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}))

const { DirectionFilter, NoYearsEmptyState, SortToggle } = await import(
  '@/components/dashboard/category-list-controls'
)

describe('Categories page — local components (page)', () => {
  test('DirectionFilter renders exactly 3 links in Uscite/Entrate/Accantonamenti order', () => {
    const html = renderToStaticMarkup(<DirectionFilter year={2026} direction="out" sort="amount" />)

    const usciteIndex = html.indexOf('Uscite')
    const entrateIndex = html.indexOf('Entrate')
    const accantonamentiIndex = html.indexOf('Accantonamenti')

    expect(usciteIndex).toBeGreaterThan(-1)
    expect(entrateIndex).toBeGreaterThan(usciteIndex)
    expect(accantonamentiIndex).toBeGreaterThan(entrateIndex)
    expect((html.match(/<a\s/g) ?? []).length).toBe(3)
  })

  test('DirectionFilter every option always points at buildDashboardCategoriesHref, never disabled', () => {
    const html = renderToStaticMarkup(<DirectionFilter year={2026} direction="allocation" sort="amount" />)

    // 'out' is the href builder's default type, so its href omits the `type` param entirely.
    expect(html).toContain('href="/dashboard/categories?year=2026"')
    expect(html).toContain('href="/dashboard/categories?year=2026&amp;type=in"')
    expect(html).toContain('href="/dashboard/categories?year=2026&amp;type=allocation"')
    expect(html).not.toContain('aria-disabled')
  })

  test('SortToggle renders Proiezione as a disabled span with the exact reason when unavailable', () => {
    const html = renderToStaticMarkup(
      <SortToggle year={2026} direction="out" sort="amount" projectionSortAvailable={false} />
    )

    expect(html).toMatch(/<span[^>]*aria-disabled="true"[^>]*>Proiezione<\/span>/)
    expect(html).toContain('title="Serve un secondo mese importato per calcolare la proiezione."')
  })

  test('SortToggle renders Proiezione as a Link when available', () => {
    const html = renderToStaticMarkup(
      <SortToggle year={2026} direction="out" sort="amount" projectionSortAvailable={true} />
    )

    expect(html).not.toContain('aria-disabled')
    expect(html).toMatch(/<a[^>]*>Proiezione<\/a>/)
  })

  test('SortToggle always renders Totale as an enabled Link, regardless of projection availability', () => {
    const html = renderToStaticMarkup(
      <SortToggle year={2026} direction="out" sort="amount" projectionSortAvailable={false} />
    )

    expect(html).toMatch(/<a[^>]*>Totale<\/a>/)
  })

  test('NoYearsEmptyState renders the import CTA link', () => {
    const html = renderToStaticMarkup(<NoYearsEmptyState />)

    expect(html).toContain('Nessuna transazione registrata')
    expect(html).toContain('href="/import"')
  })
})
