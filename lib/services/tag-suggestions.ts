import { getTransactionsInDateRange } from '@/lib/dal/tag-suggestions'
import { getActiveTagsWithDateRange, getTag } from '@/lib/dal/tags'
import { getAlreadyTaggedTransactionIds } from '@/lib/dal/transaction-tags'

// D-09: pure inclusive-boundary predicate — true at exactly `start`, exactly `end`, and
// strictly between; false outside. Documents the boundary contract independently of the DB
// query (which ALSO uses gte/lte — belt-and-suspenders, since a caller could in principle
// re-filter an already-fetched list with this function).
export function isOccurredAtInRange(occurredAt: Date, start: Date, end: Date): boolean {
  return occurredAt.getTime() >= start.getTime() && occurredAt.getTime() <= end.getTime()
}

// Carries the display fields straight through from TransactionForSuggestion so Plans 67-08/67-09
// can render a recognizable checklist row without a second lookup.
export type TagSuggestionMatch = {
  transactionId: string
  occurredAt: Date
  description: string
  customTitle: string | null
  amount: string
  currency: string
}

export type TagSuggestionGroup = {
  tagId: number
  tagName: string
  matches: TagSuggestionMatch[]
}

// The single shared core both suggestion triggers (D-08a create-time modal, D-08b post-import
// block) delegate to. Never calls into the assignment service — suggestion computation must
// never auto-assign a tag without an explicit user confirmation click (D-08).
export async function computeSuggestionsForTag(
  userId: string,
  tag: { id: number; name: string; dateRangeStart: Date | null; dateRangeEnd: Date | null },
): Promise<TagSuggestionMatch[]> {
  if (!tag.dateRangeStart || !tag.dateRangeEnd) return []

  const transactions = await getTransactionsInDateRange(userId, tag.dateRangeStart, tag.dateRangeEnd)

  // D-10: dedup — exclude transactions already carrying this tag, even though they fall in range.
  const alreadyTagged = await getAlreadyTaggedTransactionIds(
    tag.id,
    transactions.map((t) => t.id),
  )

  return transactions
    .filter((t) => !alreadyTagged.has(t.id))
    .map((t) => ({
      transactionId: t.id,
      occurredAt: t.occurredAt,
      description: t.description,
      customTitle: t.customTitle,
      amount: t.amount,
      currency: t.currency,
    }))
}

// D-08a: create-time trigger — loads the ONE just-created tag and computes its suggestions.
// Returns the group even if matches is empty; the caller (Plan 67-08) decides whether to skip
// opening the modal for an empty result — this function's job is only to compute.
export async function computeSuggestionsForNewTag(input: {
  userId: string
  tagId: number
}): Promise<TagSuggestionGroup | null> {
  const t = await getTag(input.userId, input.tagId)
  if (!t) return null

  const matches = await computeSuggestionsForTag(input.userId, t)
  return { tagId: t.id, tagName: t.name, matches }
}

// D-08b: post-import trigger — re-scans EVERY non-archived date-ranged tag's FULL date range
// against ALL of the user's transactions on every call (not just a single import's newly-inserted
// rows). This is what makes "each subsequent import" meaningfully re-propose transactions that
// arrived in a PRIOR import but were never confirmed. Empty-match tags are omitted (unlike
// computeSuggestionsForNewTag, which always returns its one group), since this feeds a
// multi-tag summary block that should only render blocks with something to confirm.
export async function computeAllTagSuggestions(input: { userId: string }): Promise<TagSuggestionGroup[]> {
  const tags = await getActiveTagsWithDateRange(input.userId)

  const groups = await Promise.all(
    tags.map(async (t) => ({
      tagId: t.id,
      tagName: t.name,
      matches: await computeSuggestionsForTag(input.userId, t),
    })),
  )

  return groups.filter((g) => g.matches.length > 0)
}
