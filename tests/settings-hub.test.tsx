/**
 * Unit tests for SettingsHub (D-11, D-12)
 *
 * Strategy: SettingsHub is a Server Component (no hooks) — renderToStaticMarkup works.
 * Verifies: Aspetto section is rendered (D-11) and ThemeToggle is imported/rendered (D-12).
 */
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement('a', { href, className }, children),
}))

vi.mock('@/lib/routes', () => ({
  APP_ROUTES: {
    profileSettings: '/settings/profile',
    tagSettings: '/settings/tags',
  },
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children?: React.ReactNode; className?: string }) =>
    React.createElement('div', { 'data-slot': 'card', className }, children),
  CardHeader: ({ children, className }: { children?: React.ReactNode; className?: string }) =>
    React.createElement('div', { 'data-slot': 'card-header', className }, children),
  CardTitle: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', { 'data-slot': 'card-title' }, children),
  CardContent: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', { 'data-slot': 'card-content' }, children),
}))

vi.mock('lucide-react', () => ({
  ChevronRight: () => React.createElement('span', { 'data-icon': 'chevron-right' }),
  Tags: () => React.createElement('span', { 'data-icon': 'tags' }),
  UserCog: () => React.createElement('span', { 'data-icon': 'user-cog' }),
}))

// ThemeToggle mock: renders a stable testid so we can assert it appears
vi.mock('@/components/theme-toggle', () => ({
  ThemeToggle: () => React.createElement('button', { 'data-testid': 'theme-toggle' }, 'Tema'),
}))

const { SettingsHub } = await import('@/components/settings/settings-hub')

describe('SettingsHub (D-11, D-12)', () => {
  it('renders without throwing', () => {
    expect(() => renderToStaticMarkup(React.createElement(SettingsHub))).not.toThrow()
  })

  it('renders the Aspetto section heading (D-11)', () => {
    const html = renderToStaticMarkup(React.createElement(SettingsHub))
    expect(html).toContain('Aspetto')
  })

  it('renders ThemeToggle inside the Aspetto section (D-12)', () => {
    const html = renderToStaticMarkup(React.createElement(SettingsHub))
    expect(html).toContain('data-testid="theme-toggle"')
  })

  it('renders the Tema label in the Aspetto row (D-11)', () => {
    const html = renderToStaticMarkup(React.createElement(SettingsHub))
    expect(html).toContain('Tema')
    expect(html).toContain('Chiaro o scuro')
  })

  it('renders a navigation link to Profilo settings', () => {
    const html = renderToStaticMarkup(React.createElement(SettingsHub))
    expect(html).toContain('/settings/profile')
  })

  it('renders a navigation link to Tag settings (D-01)', () => {
    const html = renderToStaticMarkup(React.createElement(SettingsHub))
    expect(html).toContain('/settings/tags')
    expect(html).toContain('data-icon="tags"')
  })
})
