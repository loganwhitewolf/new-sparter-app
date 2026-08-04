import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/dashboard/categories/7',
}))

const { CategoryDetailViewToggle } = await import('@/components/dashboard/category-detail-view-toggle')

describe('CategoryDetailViewToggle (CDET-VIEW-02/05, 260804-br9 Task 3)', () => {
  test("view='ytd': 'Da inizio anno' is aria-pressed=true, 'Proiezione' is aria-pressed=false", () => {
    const html = renderToStaticMarkup(<CategoryDetailViewToggle view="ytd" />)

    expect(html).toMatch(/aria-pressed="true"[^>]*>Da inizio anno/)
    expect(html).toMatch(/aria-pressed="false"[^>]*>Proiezione/)
  })

  test("view='projection': the reverse", () => {
    const html = renderToStaticMarkup(<CategoryDetailViewToggle view="projection" />)

    expect(html).toMatch(/aria-pressed="false"[^>]*>Da inizio anno/)
    expect(html).toMatch(/aria-pressed="true"[^>]*>Proiezione/)
  })

  test('both labels are present in the markup regardless of the current view', () => {
    const ytdHtml = renderToStaticMarkup(<CategoryDetailViewToggle view="ytd" />)
    const projectionHtml = renderToStaticMarkup(<CategoryDetailViewToggle view="projection" />)

    expect(ytdHtml).toContain('Da inizio anno')
    expect(ytdHtml).toContain('Proiezione')
    expect(projectionHtml).toContain('Da inizio anno')
    expect(projectionHtml).toContain('Proiezione')
  })
})
