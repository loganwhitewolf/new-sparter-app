# Strip platform description noise at import time, before normalization

Some banks (e.g. Fineco) append boilerplate to every transaction description — card number, operation date — that changes per transaction. Without stripping, two visits to the same merchant produce different `descriptionHash` values, which breaks expense aggregation (each visit becomes a separate expense record) and Tier 2 history categorization (the hash never accumulates enough weight).

We strip this noise at import time in `normalizeTransactionRow`, using a nullable `descriptionStripPattern` regex field on `Platform`. The stripped description is what gets stored, shown in the UI, and used for all hashing. The original raw row is preserved in `transaction.rawRow`.

Alternatives considered:
- **Strip only at categorization time** (Tier 1 regex + pattern suggestion detection): would fix pattern matching but not expense aggregation or Tier 2, since both rely on `descriptionHash` computed at import.
- **Store both original and clean description**: doubles the fields, complicates the UI, and still requires a decision about which hash to use for deduplication.
- **Generic token stripping** (extend `stripNumericTokens` to cover dates): would partially help pattern suggestions but not expense aggregation, and risks stripping legitimate content on other platforms.
