import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type * as React from 'react'
import type { TagTotalItem } from '@/lib/dal/tags'

// tag-ranking-list.tsx imports ArchiveTagDialog from tag-mutation-dialogs.tsx, which pulls in
// Radix Dialog, sonner, and the tag-suggestions action/dialog modules at module scope — mirrors
// tests/tag-mutation-dialogs.test.tsx's mocking strategy exactly (repo constraint: no
// jsdom/@testing-library, renderToStaticMarkup only).
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return {
    ...actual,
    useActionState: vi.fn(() => [{ error: null }, vi.fn(), false]),
  }
})

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/lib/actions/tags', () => ({
  createTagAction: vi.fn(),
  updateTagAction: vi.fn(),
  archiveTagAction: vi.fn(),
}))

vi.mock('@/lib/actions/tag-suggestions', () => ({
  getNewTagSuggestionsAction: vi.fn(),
  confirmTagSuggestionAction: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children?: ReactNode }) =>
    createElement('div', { 'data-slot': 'dialog' }, children),
  DialogTrigger: ({ children }: { children?: ReactNode }) =>
    createElement('div', { 'data-slot': 'dialog-trigger' }, children),
  DialogContent: ({ children }: { children?: ReactNode }) =>
    createElement('div', { 'data-slot': 'dialog-content' }, children),
  DialogHeader: ({ children }: { children?: ReactNode }) =>
    createElement('div', { 'data-slot': 'dialog-header' }, children),
  DialogTitle: ({ children }: { children?: ReactNode }) =>
    createElement('h2', { 'data-slot': 'dialog-title' }, children),
  DialogDescription: ({ children }: { children?: ReactNode }) =>
    createElement('p', { 'data-slot': 'dialog-description' }, children),
  DialogFooter: ({ children }: { children?: ReactNode }) =>
    createElement('div', { 'data-slot': 'dialog-footer' }, children),
  DialogClose: ({ children }: { children?: ReactNode }) =>
    createElement('div', { 'data-slot': 'dialog-close' }, children),
}))

vi.mock('@/components/tags/tag-creation-suggestions-dialog', () => ({
  TagCreationSuggestionsDialog: () =>
    createElement('div', { 'data-slot': 'tag-creation-suggestions-dialog' }),
}))

const { TagRankingList } = await import('@/components/dashboard/tag-ranking-list')
const { TagRankingSkeleton } = await import('@/components/dashboard/tag-ranking-skeleton')

const baseTag: TagTotalItem = {
  tagId: 1,
  name: 'Vacanza Sharm 2026',
  archived: false,
  count: 4,
  minDate: '2026-08-01 00:00:00+00',
  maxDate: '2026-08-15 00:00:00+00',
  total: '350.75',
}

describe('TagRankingList', () => {
  it('renders the dashed empty-state box with the locked copy and a working settings link', () => {
    const html = renderToStaticMarkup(createElement(TagRankingList, { items: [] }))

    expect(html).toContain('Nessun tag creato')
    expect(html).toContain('href="/tags"')
    expect(html).toContain('border-dashed')
  })

  it('renders a single card with no layout awkwardness for one tag', () => {
    const html = renderToStaticMarkup(createElement(TagRankingList, { items: [baseTag] }))

    expect(html).toContain('Vacanza Sharm 2026')
    // Phase 69 (69-03, D6): the primary name link now points at the dedicated per-tag page,
    // not the tag-filtered transactions list.
    expect(html).toContain('href="/tags/1"')
    expect(html).not.toContain('Nessun tag creato')
  })

  it('renders every tag in a many-tags list, no cap', () => {
    const items = Array.from({ length: 12 }).map((_, i) => ({
      ...baseTag,
      tagId: i + 1,
      name: `Tag ${i + 1}`,
    }))
    const html = renderToStaticMarkup(createElement(TagRankingList, { items }))

    items.forEach((item) => {
      expect(html).toContain(`Tag ${item.tagId}`)
    })
  })

  it('truncates a long tag name and sets title= to the full name', () => {
    const longName = 'Un nome di tag estremamente lungo che deve essere troncato nella card'
    const html = renderToStaticMarkup(
      createElement(TagRankingList, { items: [{ ...baseTag, name: longName }] })
    )

    expect(html).toContain('truncate')
    expect(html).toContain(`title="${longName}"`)
  })

  it('shows the Archiviato badge and keeps the Archivia action present/enabled for an archived tag', () => {
    const html = renderToStaticMarkup(
      createElement(TagRankingList, { items: [{ ...baseTag, archived: true }] })
    )

    expect(html).toContain('Archiviato')
    expect(html).toContain('Archivia')
    expect(html).not.toMatch(/\sdisabled(?!:)/)
  })

  it('colors the total green for a non-negative sum and red for a negative sum', () => {
    const positiveHtml = renderToStaticMarkup(
      createElement(TagRankingList, { items: [{ ...baseTag, total: '100.00' }] })
    )
    const negativeHtml = renderToStaticMarkup(
      createElement(TagRankingList, { items: [{ ...baseTag, total: '-100.00' }] })
    )

    expect(positiveHtml).toContain('text-[var(--total-in)]')
    expect(negativeHtml).toContain('text-[var(--total-out)]')
  })

  it('renders "0 movimenti" with no date range for a zero-transaction tag (partial/zero-total case)', () => {
    const html = renderToStaticMarkup(
      createElement(TagRankingList, {
        items: [{ ...baseTag, count: 0, minDate: null, maxDate: null, total: '0.00' }],
      })
    )

    expect(html).toContain('0 movimenti')
    expect(html).not.toContain('undefined')
    // name/badge/total/caption/archive action all still present — never partially rendered
    expect(html).toContain(baseTag.name)
    expect(html).toContain('Archivia')
  })

  it('uses singular "1 movimento" when count is exactly 1', () => {
    const html = renderToStaticMarkup(
      createElement(TagRankingList, { items: [{ ...baseTag, count: 1 }] })
    )

    expect(html).toContain('1 movimento')
    expect(html).not.toContain('1 movimenti')
  })
})

describe('TagRankingSkeleton', () => {
  it('renders a pulse-box card grid', () => {
    const html = renderToStaticMarkup(createElement(TagRankingSkeleton))

    expect(html).toContain('animate-pulse')
    expect(html).toContain('Caricamento classifica tag')
  })
})
