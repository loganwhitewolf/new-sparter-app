import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { TransactionTagsChip } from '@/components/transactions/transaction-tags-chip'

// Static render: the Popover panel mounts only once opened, so these assertions cover the
// trigger chip — count, accessible name, and the render-nothing case. The popover list itself
// is interaction-driven and is covered by the human-verify checkpoint (no jsdom in this repo).
describe('TransactionTagsChip', () => {
  const tags = [
    { tagId: 1, tagName: 'Viaggio Giappone', archived: false },
    { tagId: 2, tagName: 'Rimborsabili', archived: true },
  ]

  it('renders nothing when the transaction carries no tags', () => {
    const html = renderToStaticMarkup(createElement(TransactionTagsChip, { tags: [] }))
    expect(html).toBe('')
  })

  it('renders the tag count on the chip', () => {
    const html = renderToStaticMarkup(createElement(TransactionTagsChip, { tags }))
    expect(html).toContain('2')
  })

  it('exposes every tag name in the accessible label so the names are not hover-only', () => {
    const html = renderToStaticMarkup(createElement(TransactionTagsChip, { tags }))
    expect(html).toContain('2 tag collegati')
    expect(html).toContain('Viaggio Giappone')
    expect(html).toContain('Rimborsabili')
  })

  it('uses the singular label for a single tag', () => {
    const html = renderToStaticMarkup(
      createElement(TransactionTagsChip, { tags: [tags[0]] }),
    )
    expect(html).toContain('1 tag collegato')
  })

  it('keeps the chip shrink-0 so a truncated title cannot squeeze it out', () => {
    const html = renderToStaticMarkup(createElement(TransactionTagsChip, { tags }))
    expect(html).toContain('shrink-0')
  })
})
