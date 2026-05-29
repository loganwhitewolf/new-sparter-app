# File-period model: month as derived projection

A file import does not have an assigned month. The temporal period covered by a file is derived on-the-fly from the dates of its transactions.

## Decisions

### Transaction date is the single source of truth for temporal placement

Transactions have their own `date` (or `timestamp`) column. A "month" in Sparter is always a projection — a `DATE_TRUNC('month', transaction.date)` grouping — not a property stored on the file.

The `file` table already has `referenceStartedAt` / `referenceEndedAt` (the actual date range of imported transactions). These are authoritative for range queries; no additional column is needed.

Alternatives considered:
- **`coveredMonths: date[]` column on `file`**: redundant with `referenceStartedAt/referenceEndedAt`. Useful only for "find files covering month X" queries — but the app navigates by *month* (transaction projection), not by file-of-month. Rejected as premature.
- **User-assigned month label on upload**: user declares "this file is May 2026." Rejected because it creates a mismatch when the file contains transactions from multiple months (e.g. an annual export), and forces re-reconciliation logic. The real date on each transaction is always more accurate than a user declaration.
- **Wizard "confirm month" step before import**: adds friction without adding correctness. A file from Fineco covering Jan–Dec 2025 cannot honestly be labeled a single month. Rejected.

### Months covered: derived label, not persisted metadata

When showing a file in the import list, the UI derives the months covered from the transaction data:

```sql
SELECT DATE_TRUNC('month', MIN(transaction.date)) AS first_month,
       DATE_TRUNC('month', MAX(transaction.date)) AS last_month
FROM transaction
WHERE transaction.importedFromFileId = :fileId
```

Displayed as a compact label: "Apr 2026" (single month) or "Apr–Giu 2026" (range).

This label is display-only. It is never stored, indexed, or used for filtering.

### File list: date-range filter (not month-picker)

The `/import` file list provides a date-range input to filter files by the period their transactions fall in. This is implemented as a filter on `file.referenceStartedAt` / `file.referenceEndedAt`, not on a stored month label.

A dedicated month-picker was considered but rejected in favour of a generic date-range input: a month-picker implies 1-file-per-month semantics, which contradicts this decision.

### Multi-month files: no special treatment

A file covering 12 months (e.g. an annual Fineco export) is treated identically to a file covering 1 month. The dashboard, Reference Period, Baseline, and Deviation calculations work on transaction dates regardless of how many files contributed them.

The onboarding overview (ADR 0005, Step 2) shows months covered as a derived label. If the file covers multiple months, the label shows a range — no per-month breakdown inside the onboarding flow. The per-month breakdown lives in the dashboard.

## Consequences

- No schema migration needed. `referenceStartedAt` / `referenceEndedAt` already exist on `file`.
- The months-covered label is a DAL query, not a stored field. It is computed when rendering the file list or the import overview.
- Dashboard and Reference Period logic are unaffected — they already operate on transaction dates.
- If a future use case requires "find all files containing transactions in month X" at scale, a `coveredMonths` index can be added then. This ADR does not preclude it — it defers it.
