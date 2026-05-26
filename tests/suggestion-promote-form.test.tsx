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

const { SuggestionPromoteForm } = await import('../components/import/suggestion-promote-form')

const suggestion = {
  pattern: 'netflix',
  matchCount: 3,
  detectedAmountSign: 'negative' as const,
  sampleDescriptions: ['NETFLIX 10/01', 'NETFLIX 11/01'],
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
        effectiveNature: null,
      },
    ],
  },
]

const noopOnPromoted = () => {}

describe('SuggestionPromoteForm', () => {
  it('REV-03: renders hidden inputs for pattern and amountSign sourced from the suggestion', () => {
    const html = renderToStaticMarkup(
      createElement(SuggestionPromoteForm, {
        suggestion,
        categories,
        onPromoted: noopOnPromoted,
      }),
    )

    expect(html).toMatch(/<input[^>]*type="hidden"[^>]*name="pattern"[^>]*value="netflix"/)
    expect(html).toMatch(/<input[^>]*type="hidden"[^>]*name="amountSign"[^>]*value="negative"/)
  })

  it('REV-03: renders visible Categoria and Sottocategoria labels', () => {
    const html = renderToStaticMarkup(
      createElement(SuggestionPromoteForm, {
        suggestion,
        categories,
        onPromoted: noopOnPromoted,
      }),
    )

    expect(html).toContain('Categoria')
    expect(html).toContain('Sottocategoria')
  })

  it('renders the "Crea pattern" submit button', () => {
    const html = renderToStaticMarkup(
      createElement(SuggestionPromoteForm, {
        suggestion,
        categories,
        onPromoted: noopOnPromoted,
      }),
    )

    expect(html).toContain('Crea pattern')
  })

  it('REV-05: does not render a destructive Alert in the initial { error: null } state', () => {
    const html = renderToStaticMarkup(
      createElement(SuggestionPromoteForm, {
        suggestion,
        categories,
        onPromoted: noopOnPromoted,
      }),
    )

    expect(html).not.toContain('data-variant="destructive"')
  })

  it('does NOT submit a `confidence` hidden input (server hardcodes 0.85; preventing FormData tampering)', () => {
    const html = renderToStaticMarkup(
      createElement(SuggestionPromoteForm, {
        suggestion,
        categories,
        onPromoted: noopOnPromoted,
      }),
    )

    expect(html).not.toMatch(/<input[^>]*name="confidence"/)
  })
})
