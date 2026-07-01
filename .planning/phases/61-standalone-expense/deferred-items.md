# Deferred Items — Phase 61 Plan 01

Pre-existing issues discovered during execution that are out of scope for this plan
(not caused by this plan's changes). Not fixed here per the scope boundary rule.

## Pre-existing `yarn check:language` failures

Discovered while running `yarn check:language` as part of Task 2 verification.
None of these files were touched by 61-01:

- `components/expenses/bulk-categorize-dialog.tsx:18` — developer-facing comment should be English
- `components/expenses/expense-uncategorized-cta.tsx:16` — developer-facing comment should be English
- `lib/dal/expenses.ts:92` — developer-facing comment should be English
- `lib/dal/transactions.ts:202` — developer-facing comment should be English
