import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as React from 'react'

const sidebarCollapsedMock = vi.hoisted(() => ({
  collapsed: false,
  setCollapsed: vi.fn(),
}))

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

vi.mock('lucide-react', () => {
  const Icon = (name: string) => () => <svg data-icon={name} />
  return {
    CalendarClock: Icon('calendar-clock'),
    ChevronLeft: Icon('chevron-left'),
    ChevronRight: Icon('chevron-right'),
    FolderTree: Icon('folder-tree'),
    LayoutDashboard: Icon('layout-dashboard'),
    Link2: Icon('link-2'),
    List: Icon('list'),
    LogOut: Icon('log-out'),
    Receipt: Icon('receipt'),
    Regex: Icon('regex'),
    Tags: Icon('tags'),
    Upload: Icon('upload'),
    User: Icon('user'),
  }
})

vi.mock('@/components/layout/sidebar-provider', () => ({
  useSidebarCollapsed: () => sidebarCollapsedMock,
}))

vi.mock('@/components/ui/client-mount-icon', () => ({
  ClientMountIcon: ({ className }: { className?: string }) => (
    <span data-testid="icon" className={className} />
  ),
}))

vi.mock('@/lib/actions/auth', () => ({
  signOutAction: vi.fn(),
}))

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => <div data-avatar>{children}</div>,
  AvatarImage: () => null,
  AvatarFallback: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children, ...props }: React.ComponentProps<'button'>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
}))

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('@/components/ui/separator', () => ({
  Separator: (props: React.ComponentProps<'hr'>) => <hr {...props} />,
}))

const { Sidebar } = await import('@/components/layout/sidebar')

const user = { name: 'Andrea', email: 'a@example.com', image: null }

describe('Sidebar sections (quick-260730-bfa Option A)', () => {
  beforeEach(() => {
    sidebarCollapsedMock.collapsed = false
  })

  it('renders four section labels when expanded', () => {
    const html = renderToStaticMarkup(createElement(Sidebar, { user }))

    expect(html).toContain('Panoramica')
    expect(html).toContain('Movimenti')
    expect(html).toContain('Ingresso dati')
    expect(html).toContain('Configurazione')
  })

  it('keeps Option A item membership and hrefs', () => {
    const html = renderToStaticMarkup(createElement(Sidebar, { user }))

    expect(html).toContain('href="/dashboard"')
    expect(html).toContain('href="/transactions"')
    expect(html).toContain('href="/expenses"')
    expect(html).toContain('href="/reimbursements"')
    expect(html).toContain('href="/amortizations"')
    expect(html).toContain('href="/import"')
    expect(html).toContain('href="/settings/categories"')
    expect(html).toContain('href="/tags"')
    expect(html).toContain('href="/patterns"')
  })

  it('hides section labels when collapsed', () => {
    sidebarCollapsedMock.collapsed = true
    const html = renderToStaticMarkup(createElement(Sidebar, { user }))

    expect(html).not.toContain('Panoramica')
    expect(html).not.toContain('Movimenti')
    expect(html).not.toContain('Ingresso dati')
    expect(html).not.toContain('Configurazione')
    // Links still present
    expect(html).toContain('href="/dashboard"')
    expect(html).toContain('href="/patterns"')
  })
})
