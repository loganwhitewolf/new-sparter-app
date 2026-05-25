# v1.10 Research: Pitfalls

## Correctness Pitfalls

- Treating the 2-token minimum as exactly 2 tokens. The ADR defines a floor; longer common prefixes should be preserved.
- Running suggestions on already categorized rows, creating noisy duplicate coverage.
- Including duplicate import rows or existing transaction duplicates in suggestion counts.
- Failing to escape generated regex source. Prefixes derived from descriptions can contain regex metacharacters.
- Grouping by raw case/spacing instead of normalized descriptions, causing missed matches.
- Inferring `detectedAmountSign` from mixed groups incorrectly; mixed signs must become `any`.
- Letting invalid regex patterns from existing data fail analysis; match checks must keep the existing "skip invalid regex" behavior.

## UX Pitfalls

- Blocking import confirmation until suggestions are handled. Suggestions should be helpful, not mandatory.
- Showing too many suggestions; the cap exists to keep the review checkpoint scan-friendly.
- Hiding sample descriptions; users need examples to trust a suggested regex prefix.
- Asking users to write regex manually when the system already produced the prefix.
- Creating a pattern without requiring destination subcategory selection.

## Security / Privacy Pitfalls

- Leaking raw R2 object keys, presigned URLs, or raw row payloads in errors/logs.
- Allowing post-import re-analysis by `fileId` without checking the file belongs to the session user.
- Letting a crafted suggestion create a pattern for another user's subcategory; existing pattern actions should be paired with category ownership validation if absent.

## Integration Pitfalls

- Promoting a pattern before import does not automatically affect the already computed preview unless the analysis is rerun or the UI explains it affects confirmation/future categorization. Best behavior is to keep confirmation available and make the created pattern available to `importFile`, which reloads active patterns at commit time.
- Post-import pattern creation will not automatically reclassify transactions unless a revalidation/reclassification action is added. Keep the milestone wording precise.
- Adding route or test strings in Italian outside user-facing copy can violate `yarn check:language`.

## Phase Ownership Hints

- Detector phase should own pure algorithm and edge cases.
- Pre-import integration phase should own `ImportAnalysisResult`, `analyzeFile`, and import action tests.
- Promotion UI phase should own client component behavior and pattern action integration.
- Post-import phase should own persisted transaction query, row action/dialog, and access-control tests.
