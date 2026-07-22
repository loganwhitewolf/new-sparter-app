import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type * as React from 'react'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('lucide-react', () => ({
  LayoutDashboard: () => <svg data-icon="layout-dashboard" />,
  List: () => <svg data-icon="list" />,
  Receipt: () => <svg data-icon="receipt" />,
  Upload: () => <svg data-icon="upload" />,
  MoreHorizontal: () => <svg data-icon="more-horizontal" />,
}))

vi.mock('@/components/layout/mobile-more-sheet', () => ({
  MobileMoreSheet: ({ open }: { open: boolean }) => (
    <div data-testid="mobile-more-sheet" data-open={open} />
  ),
  MORE_SHEET_ROUTES: ['/settings/categories', '/tags', '/patterns', '/settings/profile'],
}))

const { BottomNav } = await import('@/components/layout/bottom-nav')

describe('BottomNav', () => {
  it('renders exactly the 4 primary links', () => {
    const html = renderToStaticMarkup(createElement(BottomNav))

    expect(html).toContain('href="/dashboard"')
    expect(html).toContain('href="/expenses"')
    expect(html).toContain('href="/transactions"')
    expect(html).toContain('href="/import"')
  })

  it('renders an Altro button and the mobile more sheet', () => {
    const html = renderToStaticMarkup(createElement(BottomNav))

    expect(html).toContain('Altro')
    expect(html).toContain('data-testid="mobile-more-sheet"')
  })

  it('does not render Impostazioni or a /settings link', () => {
    const html = renderToStaticMarkup(createElement(BottomNav))

    expect(html).not.toContain('Impostazioni')
    expect(html).not.toContain('href="/settings"')
  })
})
