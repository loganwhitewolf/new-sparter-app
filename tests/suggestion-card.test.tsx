import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  promoteSuggestionAction: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/actions/patterns', () => ({
  promoteSuggestionAction: mocks.promoteSuggestionAction,
}))

const { SuggestionCard } = await import('../components/import/suggestion-card')

const suggestion = {
  pattern: 'netflix',
  matchCount: 3,
  detectedAmountSign: 'negative' as const,
  sampleDescriptions: ['NETFLIX 10/01', 'NETFLIX 11/01', 'NETFLIX 12/01'],
}

const categories = [
  {
    id: 1,
    name: 'Spese',
    slug: 'spese',
    type: 'out' as const,
    userId: null,
    isOwned: false,
    subCategories: [
      {
        id: 42,
        name: 'Streaming',
        slug: 'streaming',
        originalName: 'Streaming',
        userId: null,
        isOwned: false,
        hasOverride: false,
        customName: null,
      },
    ],
  },
]

describe('SuggestionCard', () => {
  it('REV-02: hides sample descriptions by default and shows "Mostra N esempi" toggle', () => {
    const html = renderToStaticMarkup(
      createElement(SuggestionCard, { suggestion, categories }),
    )

    expect(html).toContain('Mostra 3 esempi')
    // None of the sample description strings are visible in initial SSR render
    expect(html).not.toContain('NETFLIX 10/01')
    expect(html).not.toContain('NETFLIX 11/01')
    expect(html).not.toContain('NETFLIX 12/01')
  })

  it('renders the matchCount as a "N match" badge', () => {
    const html = renderToStaticMarkup(
      createElement(SuggestionCard, { suggestion, categories }),
    )

    expect(html).toContain('3 match')
  })

  it('renders the pattern string in a monospace element', () => {
    const html = renderToStaticMarkup(
      createElement(SuggestionCard, { suggestion, categories }),
    )

    expect(html).toContain('netflix')
    // UI-SPEC requires font-mono on the pattern element
    expect(html).toMatch(/font-mono[^"]*"[^>]*>netflix|>netflix<\/code>|<code[^>]*font-mono/)
  })

  it('does not render the "Pattern creato" success badge in the default (un-promoted) state', () => {
    const html = renderToStaticMarkup(
      createElement(SuggestionCard, { suggestion, categories }),
    )

    expect(html).not.toContain('Pattern creato')
  })
})
