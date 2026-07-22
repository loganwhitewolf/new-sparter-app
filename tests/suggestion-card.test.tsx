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
  sampleDescriptions: ['NETFLIX 10/01', 'NETFLIX 11/01', 'NETFLIX 12/01'],
  sampleAmounts: ['-12.99', '-12.99', '-12.99'],
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

const defaultProps = {
  suggestion,
  categories,
  fileId: 'file-abc',
}

describe('SuggestionCard', () => {
  it('REV-02: hides sample descriptions by default and shows "Mostra N esempi" toggle', () => {
    const html = renderToStaticMarkup(
      createElement(SuggestionCard, defaultProps),
    )

    expect(html).toContain('Mostra 3 esempi')
    // None of the sample description strings are visible in initial SSR render
    expect(html).not.toContain('NETFLIX 10/01')
    expect(html).not.toContain('NETFLIX 11/01')
    expect(html).not.toContain('NETFLIX 12/01')
  })

  it('renders the matchCount as a "N match" badge', () => {
    const html = renderToStaticMarkup(
      createElement(SuggestionCard, defaultProps),
    )

    expect(html).toContain('3 match')
  })

  it('renders the pattern string in a monospace element', () => {
    const html = renderToStaticMarkup(
      createElement(SuggestionCard, defaultProps),
    )

    expect(html).toContain('netflix')
    // UI-SPEC requires font-mono on the pattern element
    expect(html).toMatch(/font-mono[^"]*"[^>]*>netflix|>netflix<\/code>|<code[^>]*font-mono/)
  })

  it('does not render the "Pattern creato" success badge in the default (un-promoted) state', () => {
    const html = renderToStaticMarkup(
      createElement(SuggestionCard, defaultProps),
    )

    expect(html).not.toContain('Pattern creato')
  })

  it('does not render apply count copy in the default (un-promoted) state', () => {
    const html = renderToStaticMarkup(
      createElement(SuggestionCard, defaultProps),
    )

    expect(html).not.toContain('categorizzate')
    expect(html).not.toContain('ancora senza match')
  })

  it('APPLY-01: renders Italian apply count copy when initialApplyResult is set', () => {
    // Uses test-only initialApplyResult prop to pre-seed the promoted state in SSR.
    // Production path: handlePromoted receives PatternApplyResult from SuggestionPromoteForm callback.
    const html = renderToStaticMarkup(
      createElement(SuggestionCard, {
        ...defaultProps,
        initialApplyResult: { updatedCount: 5, notUpdatedCount: 3 },
      }),
    )

    expect(html).toContain('5 categorizzate')
    expect(html).toContain('3 ancora senza match')
    // Success badge must also be visible when promoted
    expect(html).toContain('Pattern creato')
  })

  it('APPLY-01: count copy shows correct zero values when no matches were applied', () => {
    const html = renderToStaticMarkup(
      createElement(SuggestionCard, {
        ...defaultProps,
        initialApplyResult: { updatedCount: 0, notUpdatedCount: 12 },
      }),
    )

    expect(html).toContain('0 categorizzate')
    expect(html).toContain('12 ancora senza match')
  })
})
