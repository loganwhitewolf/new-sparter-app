import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type * as React from 'react'

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children?: ReactNode }) => <div data-slot="sheet">{children}</div>,
  SheetContent: ({
    children,
    className,
    side,
  }: {
    children?: ReactNode
    className?: string
    side?: string
  }) => (
    <div data-slot="sheet-content" data-side={side} className={className}>
      {children}
    </div>
  ),
  SheetHeader: ({ children }: { children?: ReactNode }) => (
    <div data-slot="sheet-header">{children}</div>
  ),
  SheetTitle: ({ children }: { children?: ReactNode }) => (
    <h2 data-slot="sheet-title">{children}</h2>
  ),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('lucide-react', () => ({
  FolderTree: () => <svg data-icon="folder-tree" />,
  Regex: () => <svg data-icon="regex" />,
  Tags: () => <svg data-icon="tags" />,
  User: () => <svg data-icon="user" />,
}))

const { MobileMoreSheet } = await import('@/components/layout/mobile-more-sheet')

describe('MobileMoreSheet', () => {
  it('renders links to Categorie, Tag, Pattern, Profilo with their canonical routes', () => {
    const html = renderToStaticMarkup(
      createElement(MobileMoreSheet, { open: true, onOpenChange: vi.fn() })
    )

    expect(html).toContain('href="/settings/categories"')
    expect(html).toContain('href="/tags"')
    expect(html).toContain('href="/patterns"')
    expect(html).toContain('href="/settings/profile"')

    expect(html).toContain('Categorie')
    expect(html).toContain('Tag')
    expect(html).toContain('Pattern')
    expect(html).toContain('Profilo')
  })

  it('renders the Altro sheet title', () => {
    const html = renderToStaticMarkup(
      createElement(MobileMoreSheet, { open: true, onOpenChange: vi.fn() })
    )

    expect(html).toContain('Altro')
  })
})
