import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

/**
 * TagSettingsPanel static-render tests (repo constraint: no jsdom — the panel is now a plain
 * index of links into /tags/[id] with no client state, so a static render covers its structure
 * directly). The CreateTagDialog trigger is stubbed as a flat marker element (same technique as
 * bulk-assign-tags-dialog's mocks elsewhere in this repo).
 */

vi.mock('@/components/tags/tag-mutation-dialogs', () => ({
  CreateTagDialog: () => createElement('button', { 'data-slot': 'create-tag-dialog' }, 'Nuovo tag'),
  EditTagDialog: ({ tag }: { tag: { id: number } }) =>
    createElement('button', { 'data-slot': 'edit-tag-dialog', 'data-tag-id': tag.id }, 'Modifica'),
  ArchiveTagDialog: ({ tag }: { tag: { id: number } }) =>
    createElement('button', { 'data-slot': 'archive-tag-dialog', 'data-tag-id': tag.id }, 'Archivia'),
}))

const { TagSettingsPanel } = await import('../components/tags/tag-settings-panel')

function makeTag(overrides: Partial<{
  id: number
  name: string
  archived: boolean
  dateRangeStart: Date | null
  dateRangeEnd: Date | null
}> = {}) {
  return {
    id: 1,
    userId: 'user-1',
    name: 'Vacanza Sharm 2026',
    normalizedName: 'vacanza sharm 2026',
    dateRangeStart: null,
    dateRangeEnd: null,
    archived: false,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    ...overrides,
  }
}

describe('TagSettingsPanel (empty state)', () => {
  it('renders the empty-state message when there are no tags', () => {
    const html = renderToStaticMarkup(createElement(TagSettingsPanel, { tags: [] }))
    expect(html).toContain('Nessun tag disponibile')
  })

  it('still renders the CreateTagDialog trigger even with zero tags', () => {
    const html = renderToStaticMarkup(createElement(TagSettingsPanel, { tags: [] }))
    expect(html).toContain('data-slot="create-tag-dialog"')
  })
})

describe('TagSettingsPanel (mixed active + archived fixture, D-04)', () => {
  const tags = [
    makeTag({ id: 1, name: 'Vacanza Sharm 2026', archived: false }),
    makeTag({ id: 2, name: 'Trasferta Milano 2025', archived: true }),
  ]

  it('lists both the active and the archived tag in the sidebar', () => {
    const html = renderToStaticMarkup(createElement(TagSettingsPanel, { tags }))
    expect(html).toContain('Vacanza Sharm 2026')
    expect(html).toContain('Trasferta Milano 2025')
  })

  it('shows an "Archiviato" badge for the archived tag', () => {
    const html = renderToStaticMarkup(createElement(TagSettingsPanel, { tags }))
    expect(html).toContain('Archiviato')
  })

  it('renders each tag row as a link to its dedicated /tags/[id] page', () => {
    const html = renderToStaticMarkup(createElement(TagSettingsPanel, { tags }))
    expect(html).toContain('href="/tags/1"')
    expect(html).toContain('href="/tags/2"')
  })

  it('renders "Nessun intervallo" for a tag with no date range', () => {
    const html = renderToStaticMarkup(createElement(TagSettingsPanel, { tags }))
    expect(html).toContain('Nessun intervallo')
  })

  it('formats a complete date range using it-IT locale', () => {
    const rangedTags = [
      makeTag({
        id: 3,
        name: 'Vacanza con date',
        dateRangeStart: new Date('2026-08-01T00:00:00.000Z'),
        dateRangeEnd: new Date('2026-08-15T00:00:00.000Z'),
      }),
    ]
    const html = renderToStaticMarkup(createElement(TagSettingsPanel, { tags: rangedTags }))
    expect(html).toContain('—')
  })
})
