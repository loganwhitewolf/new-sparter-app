import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi, beforeEach } from 'vitest'

/**
 * tag-mutation-dialogs test strategy (repo constraint: no jsdom/@testing-library — see
 * tests/merge-expenses-dialog.test.tsx's precedent). renderToStaticMarkup cannot simulate
 * typing/clicking through CreateTagDialog's submit -> maybe-fetch-suggestions ->
 * maybe-open-next-dialog decision, so that decision is extracted as pure/async exports and
 * unit-tested directly:
 *  - hasCompleteDateRange: both-fields-filled gate for the create-time suggestion trigger
 *  - shouldOfferCreateSuggestions: the success + range + tagId decision (a type-guard)
 *  - runFetchNewTagSuggestions: thin async wrapper around getNewTagSuggestionsAction
 * A static-render smoke test per dialog (Dialog mocked as a flat passthrough, useActionState
 * mocked to a stable [state, action, false] tuple, same technique as
 * tests/expense-title-edit.test.tsx) covers each trigger's visible text.
 */

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return {
    ...actual,
    useActionState: vi.fn(() => [{ error: null }, vi.fn(), false]),
  }
})

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

const {
  CreateTagDialog,
  EditTagDialog,
  ArchiveTagDialog,
  hasCompleteDateRange,
  shouldOfferCreateSuggestions,
  runFetchNewTagSuggestions,
} = await import('../components/tags/tag-mutation-dialogs')
const { getNewTagSuggestionsAction } = await import('../lib/actions/tag-suggestions')

const getNewTagSuggestionsActionMock = vi.mocked(getNewTagSuggestionsAction)

beforeEach(() => {
  getNewTagSuggestionsActionMock.mockReset()
})

const MOCK_TAG = {
  id: 1,
  userId: 'user-1',
  name: 'Vacanza Sharm 2026',
  normalizedName: 'vacanza sharm 2026',
  dateRangeStart: new Date('2026-08-01T00:00:00.000Z'),
  dateRangeEnd: new Date('2026-08-15T00:00:00.000Z'),
  archived: false,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
}

describe('hasCompleteDateRange', () => {
  it('is true when both dates are filled', () => {
    expect(hasCompleteDateRange('2026-08-01', '2026-08-15')).toBe(true)
  })

  it('is false when the start date is empty', () => {
    expect(hasCompleteDateRange('', '2026-08-15')).toBe(false)
  })

  it('is false when the end date is empty', () => {
    expect(hasCompleteDateRange('2026-08-01', '')).toBe(false)
  })

  it('is false when both dates are empty', () => {
    expect(hasCompleteDateRange('', '')).toBe(false)
  })

  it('treats whitespace-only values as empty', () => {
    expect(hasCompleteDateRange('  ', '2026-08-15')).toBe(false)
  })
})

describe('shouldOfferCreateSuggestions', () => {
  it('is true on success, with a range, and a numeric tagId', () => {
    expect(shouldOfferCreateSuggestions({ error: null, tagId: 42 }, true)).toBe(true)
  })

  it('is false on success with no range submitted', () => {
    expect(shouldOfferCreateSuggestions({ error: null, tagId: 42 }, false)).toBe(false)
  })

  it('is false when the action returned an error, even with a range and a tagId', () => {
    expect(shouldOfferCreateSuggestions({ error: 'Tag con questo nome esiste già.', tagId: 42 }, true)).toBe(
      false,
    )
  })

  it('is false when tagId is missing', () => {
    expect(shouldOfferCreateSuggestions({ error: null }, true)).toBe(false)
  })
})

describe('runFetchNewTagSuggestions', () => {
  it('delegates to getNewTagSuggestionsAction with the given tagId', async () => {
    getNewTagSuggestionsActionMock.mockResolvedValue({ group: null, error: null })

    const result = await runFetchNewTagSuggestions(42)

    expect(getNewTagSuggestionsActionMock).toHaveBeenCalledTimes(1)
    expect(getNewTagSuggestionsActionMock).toHaveBeenCalledWith({ tagId: 42 })
    expect(result).toEqual({ group: null, error: null })
  })
})

describe('CreateTagDialog (render smoke test)', () => {
  it('renders the "Nuovo tag" trigger button', () => {
    const html = renderToStaticMarkup(createElement(CreateTagDialog))
    expect(html).toContain('Nuovo tag')
  })
})

describe('EditTagDialog (render smoke test)', () => {
  it('renders the edit trigger with an accessible "Modifica tag" label', () => {
    const html = renderToStaticMarkup(createElement(EditTagDialog, { tag: MOCK_TAG }))
    expect(html).toContain(`aria-label="Modifica tag ${MOCK_TAG.name}"`)
  })
})

describe('ArchiveTagDialog (render smoke test)', () => {
  it('renders the "Archivia" trigger button', () => {
    const html = renderToStaticMarkup(createElement(ArchiveTagDialog, { tag: MOCK_TAG }))
    expect(html).toContain('Archivia')
  })

  it('never mentions delete/elimina anywhere in its rendered markup', () => {
    const html = renderToStaticMarkup(createElement(ArchiveTagDialog, { tag: MOCK_TAG }))
    expect(html.toLowerCase()).not.toContain('elimina')
    expect(html.toLowerCase()).not.toContain('delete')
  })
})
