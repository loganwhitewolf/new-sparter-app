# Pattern amountSign is derived from the subcategory, not user-editable

`CategorizationPattern.amountSign` (`positive | negative | any`) gates whether a pattern matches incoming positive, negative, or any amounts. It is load-bearing: the import accumulator aggregates **all** transactions by `descriptionHash` regardless of sign, so a pattern like `amazon` assigned to an `out` subcategory would otherwise also match an Amazon refund (+50€) and miscategorize income as an expense.

We stop exposing `amountSign` as a form field. When a user creates a pattern (manual creation or promoting an import suggestion), the sign is **derived from the category type of the chosen subcategory**: `out → negative`, `in → positive`, `transfer`/`system → any`. The matching logic (`amountSignMatches`) stays unchanged. The pattern creation form reduces to regex + description + the subcategory picker.

This is recorded because a future reader will see the `amountSign` column with no UI behind it and wonder why. The sign is fully implied by the subcategory's category type, so a separate user control was redundant and could drift from the subcategory it describes.

Alternatives considered:
- **Keep the explicit field**: redundant — the subcategory already determines the sign, and two sources of truth can disagree.
- **Remove `amountSignMatches` entirely**: unsafe — categorization runs across both signs (the `expense` table holds income aggregations too), so dropping the guard lets patterns grab opposite-sign movements.
- **Compute the sign at match time** by joining pattern → subcategory → category.type instead of storing it: more normalized, but changes the categorization query path; category type is effectively immutable per subcategory, so storing the derived value at creation carries negligible drift risk.

Related: `confidence` for user-created patterns is hardcoded to `1` (the user decided the rule explicitly) and removed from the form — purely metadata, with no effect on pattern selection, which is ordered by user-before-system then `priority`.
