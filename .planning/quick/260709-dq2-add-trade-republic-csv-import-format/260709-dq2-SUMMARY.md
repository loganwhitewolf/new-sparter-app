---
quick_id: 260709-dq2
description: Add Trade Republic CSV import format
date: 2026-07-09
status: complete
---

# Quick Task 260709-dq2 — Summary

## Goal

Add a CSV import format for Trade Republic (they now offer a CSV export, more reliable
than the PDF). The existing PDF contract is untouched; CSV is a second format version on
the same platform.

## What changed

1. **`scripts/seed-data.ts`** — appended a new `importFormatVersions` row: `trade-republic`
   **version 2**, `delimiter ","`, `descriptionColumn "description"`, `amountType "single"`,
   `amountColumn "amount"`, `timestampColumn "datetime"` (ISO-8601), `dateFormat null`,
   `dateReplace/decimalReplace false`, `multiplyBy 1`, `descriptionStripPattern
   "quantity:\\s*[\\d.,]+\\s*"` (reused from the PDF contract so recurring savings-plan
   buys aggregate into one Expense). English comment block documents coexistence with v1
   and the fee/tax limitation.
2. **`tests/fixtures/import/trade-republic-csv.csv`** (new) — real TR CSV header + 7
   synthetic rows (no personal data) covering CARD_TRANSACTION, savings-plan BUY,
   TRANSFER_INSTANT_INBOUND, INTEREST_PAYMENT, DIVIDEND, TAX_OPTIMIZATION, and a duplicate
   pair.
3. **`tests/import-detector.test.ts`** — added coverage that builds the v2 candidate
   explicitly by slug+version (the existing `.map().find()` scaffold resolves v1), then
   asserts: trade-republic detected with confidence ≥ 0.8; coexistence with v1 + all
   seeded formats; savings-plan BUY normalizes with `quantity:` stripped and a negative
   amount; ISO `datetime` parses to a valid `occurredAt`.

## No migration

No Drizzle migration — every parsing-contract column already exists on
`import_format_version`. This is a seed-data addition applied idempotently by `yarn
db:seed` (`.onConflictDoNothing()` on the `(platformId, version)` unique key). The
production DAL `loadImportFormatsForDetection` loads all active versions as independent
candidates, so v2 (CSV) and v1 (PDF) coexist; header scoring routes each upload to the
right one.

## Verification

- `npx vitest run tests/import-detector.test.ts` — 34/34 passed (re-run on the target
  branch after cherry-pick).
- `npx tsc --noEmit` — no new errors in touched files (pre-existing unrelated errors
  untouched).
- `node scripts/check-code-language.mjs` — passed.

## Known limitation (documented, deferred)

Only `amount` is read; `fee`/`tax` are ignored. INTEREST_PAYMENT/DIVIDEND import gross
(withholding not netted); TAX_OPTIMIZATION rows (`amount = 0.000000`) import as €0
transactions. Card/buy/transfer rows — the primary use — map exactly.

## Deploy note

- **Fresh installs:** `yarn db:seed` inserts the global CSV format at `(trade-republic, 2)`.
- **Existing production:** a user had already created a *private* CSV format via the wizard,
  which took `version 2` (`MAX(version)+1` off the PDF v1). Because the
  `(platformId, version)` unique constraint has no owner scoping, `seed.ts`'s
  `onConflictDoNothing()` insert of the global `(trade-republic, 2)` was a silent no-op —
  the global CSV format was never added. Fixed with an idempotent **seed-extras step**
  `ensure-trade-republic-csv-global-format` that inserts the global CSV format at the next
  free version (`MAX+1`), guarded by the CSV header signature so it is a no-op once a
  global CSV format exists (including fresh installs).
- **Run on deploy:** `yarn db:seed` then `yarn db:seed-extras`. No `db:migrate` needed.
- Follow-up (deferred): a proper operator/admin promotion surface (promote a pending
  private format to global in place vs. author a new global version) — the real fix for
  the recurring "users create private formats, operator promotes them" workflow. The
  schema lifecycle fields (`reviewStatus`, `visibility`, `proposedByUserId`/`ownerUserId`,
  `role: admin`) already exist; only the review/promote surface is missing. Planned as the
  v2.3 platform/format moderation feature.

## Commits (cherry-picked onto gsd/quick-260709-bdk-file-re-import — same trees, new hashes)

- `b294064` feat: add Trade Republic CSV import format seed row
- `00936ef` test: add Trade Republic CSV detection fixture
- `30f153f` test: add Trade Republic CSV detector coverage
