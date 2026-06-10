# Nature segments computed by algebraic sum, not by amount sign

The redesigned EntrateUsciteChart computes each FlowNature segment by summing transaction amounts algebraically — including both positive and negative amounts within the same nature group — rather than splitting by amount sign first.

## Considered Options

- **Sign-split first (current approach):** `totalIn = sum(amount > 0)`, `totalOut = abs(sum(amount < 0))`. Matches the existing DAL. Breaks for refunds: a refund categorized under the same subcategory as the original expense still inflates the IN total, because the positive amount is counted as income regardless of category type.

- **Algebraic per nature (chosen):** `segment_amount = sum(all amounts for subcategories of that nature)`. A refund categorized under the same OUT subcategory as the original expense nets to zero within that segment. This enables the established refund pattern — categorize the refund under the same subcategory as the purchase — without introducing a dedicated `refund` nature value or a transaction-linking model.

## Consequences

- A nature segment can legitimately have a net positive amount even within an OUT-typed category (e.g., a bank fee fully refunded shows as zero; a segment with more refunds than charges goes positive). This is correct behavior, not a bug.
- No `refund` nature value is needed in the enum.
- The category breakdown view already uses `abs(sum(amount))` and handles netting correctly. The chart now aligns with that behavior.
- DAL queries for the new chart must group by nature (joining through `sub_category.nature`) and sum amounts without pre-filtering by sign.
- Existing KPI cards and the current chart are unaffected — they retain the sign-split model. _(Update 2026-06-09: ADR 0012 generalises algebraic-sum-by-direction to the KPI cards and category views as well — the sign-split model is being retired there.)_
