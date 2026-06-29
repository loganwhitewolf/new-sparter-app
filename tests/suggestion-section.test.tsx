import { describe, expect, it } from 'vitest'
import { shouldRedirectToImportList } from '../components/import/suggestion-section'

describe('shouldRedirectToImportList', () => {
  it('returns true when every regex suggestion has been promoted', () => {
    expect(
      shouldRedirectToImportList({ regexSuggestionCount: 2, promotedCount: 2 }),
    ).toBe(true)
  })

  it('returns false while regex suggestions remain unclassified', () => {
    expect(
      shouldRedirectToImportList({ regexSuggestionCount: 2, promotedCount: 1 }),
    ).toBe(false)
  })

  it('returns false when there are no regex suggestions', () => {
    expect(
      shouldRedirectToImportList({ regexSuggestionCount: 0, promotedCount: 0 }),
    ).toBe(false)
  })
})
