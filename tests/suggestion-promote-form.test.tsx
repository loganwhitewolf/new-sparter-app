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
  it('REV-03: renders hidden input for pattern but NOT for amountSign (server-derived per ADR 0008)', () => {
    // amountSign was removed from the form — the Server Action derives it server-side from
    // the subCategoryId via getCategoryTypeForSubCategory. This prevents FormData tampering (T-39-09).
    const html = renderToStaticMarkup(
      createElement(SuggestionPromoteForm, {
        suggestion,
        categories,
        onPromoted: noopOnPromoted,
      }),
    )

    // pattern hidden input MUST exist
    expect(html).toMatch(/<input[^>]*type="hidden"[^>]*name="pattern"[^>]*value="netflix"/)
    // subCategoryId hidden input MUST exist (filled via picker interaction)
    expect(html).toMatch(/<input[^>]*type="hidden"[^>]*name="subCategoryId"/)
    // amountSign MUST NOT be sent from the form (security: server derives it)
    expect(html).not.toMatch(/<input[^>]*name="amountSign"/)
  })

  it('REV-03: renders only Sottocategoria label — no cascading Categoria+Sottocategoria pair', () => {
    // The rebuilt form removed the cascading Category→Subcategory Select pair (plan 39-05).
    // Only a single "Sottocategoria" label + picker trigger remains.
    const html = renderToStaticMarkup(
      createElement(SuggestionPromoteForm, {
        suggestion,
        categories,
        onPromoted: noopOnPromoted,
      }),
    )

    // "Sottocategoria" label still present
    expect(html).toContain('Sottocategoria')
    // "Categoria" as a standalone label no longer exists (was removed with the cascading Select)
    // Note: "Sottocategoria" contains the substring "categoria" — we check for the exact label text
    // by looking for patterns that would indicate a separate Categoria label element
    expect(html).not.toMatch(/<label[^>]*>\s*Categoria\s*<\/label>/)
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
