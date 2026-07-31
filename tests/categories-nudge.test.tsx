// Unit coverage for shouldShowCoverageNudge — the pure visibility rule behind CategoryCoverageNudge
// (D-14: the nudge is specifically the exactly-1-raw-Covered-Month state). No render needed.
import { describe, expect, test } from 'vitest'
import { shouldShowCoverageNudge } from '@/components/dashboard/category-coverage-nudge'

describe('shouldShowCoverageNudge', () => {
  test('shows the nudge the first time with exactly 1 Covered Month (D-14)', () => {
    expect(shouldShowCoverageNudge(1, null)).toBe(true)
  })

  test('does not show the nudge with 0 Covered Months — that is the whole-year-empty state, not this nudge\'s job', () => {
    expect(shouldShowCoverageNudge(0, null)).toBe(false)
  })

  test('does not show the nudge with 2 or more Covered Months — the nudge\'s job is done', () => {
    expect(shouldShowCoverageNudge(2, null)).toBe(false)
  })

  test('does not show the nudge again once dismissed at this exact count', () => {
    expect(shouldShowCoverageNudge(1, { lastSeenCount: 1 })).toBe(false)
  })

  test('re-shows if the stored dismissal count no longer matches the current count', () => {
    expect(shouldShowCoverageNudge(1, { lastSeenCount: 0 })).toBe(true)
  })

  test('never shows for any count above 1, even with no stored dismissal', () => {
    expect(shouldShowCoverageNudge(3, null)).toBe(false)
    expect(shouldShowCoverageNudge(12, null)).toBe(false)
  })
})
