import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// Radix Select portals into document.body and omits its content from static markup —
// mock it as flat passthrough divs, same pattern as tests/transaction-detail-page.test.tsx.
vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children?: ReactNode }) =>
    createElement('div', { 'data-slot': 'select' }, children),
  SelectTrigger: ({
    children,
    'aria-label': ariaLabel,
    className,
  }: {
    children?: ReactNode
    'aria-label'?: string
    className?: string
  }) =>
    createElement(
      'div',
      { 'data-slot': 'select-trigger', 'aria-label': ariaLabel, className },
      children
    ),
  SelectValue: () => createElement('span', { 'data-slot': 'select-value' }),
  SelectContent: ({ children }: { children?: ReactNode }) =>
    createElement('div', { 'data-slot': 'select-content' }, children),
  SelectItem: ({ children, value }: { children?: ReactNode; value?: string }) =>
    createElement('div', { 'data-slot': 'select-item', 'data-value': value }, children),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/dashboard/tags',
}))

import { buildTagFilterSearch, TagFilterSelect } from '../components/dashboard/tag-filter-select'
import type { TagRow } from '../lib/dal/tags'

function makeTagRow(overrides: Partial<TagRow> = {}): TagRow {
  return {
    id: 1,
    userId: 'user-1',
    name: 'Vacanza Sharm 2026',
    normalizedName: 'vacanza sharm 2026',
    archived: false,
    dateRangeStart: null,
    dateRangeEnd: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  } as TagRow
}

describe('buildTagFilterSearch', () => {
  it('sets ?tag=<id> when a real tag is selected', () => {
    expect(buildTagFilterSearch(new URLSearchParams(), '5')).toBe('tag=5')
  })

  it('removes ?tag= entirely (not empty-string) when the sentinel is selected', () => {
    expect(buildTagFilterSearch(new URLSearchParams('tag=5'), 'all')).toBe('')
  })

  it('preserves other params while updating tag', () => {
    expect(buildTagFilterSearch(new URLSearchParams('preset=this-year'), '3')).toBe(
      'preset=this-year&tag=3'
    )
    expect(buildTagFilterSearch(new URLSearchParams('preset=this-year&tag=3'), 'all')).toBe(
      'preset=this-year'
    )
  })
})

describe('TagFilterSelect', () => {
  it('renders only the "Tutti i tag" sentinel when tags is empty (never hidden)', () => {
    const html = renderToStaticMarkup(createElement(TagFilterSelect, { tags: [] }))

    expect(html).toContain('Tutti i tag')
    expect(html).toContain('data-slot="select-item"')
  })

  it('has aria-label="Filtro tag" and a w-[170px] trigger width', () => {
    const html = renderToStaticMarkup(createElement(TagFilterSelect, { tags: [] }))

    expect(html).toContain('aria-label="Filtro tag"')
    expect(html).toContain('w-[170px]')
  })

  it('lists an archived tag inline with the Archiviato badge, never a separate group', () => {
    const tags = [makeTagRow({ id: 2, name: 'Trasferta Milano', archived: true })]
    const html = renderToStaticMarkup(createElement(TagFilterSelect, { tags }))

    expect(html).toContain('Trasferta Milano')
    expect(html).toContain('Archiviato')
    expect(html).toContain('data-value="2"')
  })

  it('lists an active tag with no Archiviato badge', () => {
    const tags = [makeTagRow({ id: 3, name: 'Progetto casa', archived: false })]
    const html = renderToStaticMarkup(createElement(TagFilterSelect, { tags }))

    expect(html).toContain('Progetto casa')
    expect(html).not.toContain('Archiviato')
  })
})
