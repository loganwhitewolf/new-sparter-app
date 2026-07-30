---
phase: 260730-e6z-riepilogo-totali-netti-nel-footer-della-
reviewed: 2026-07-30T00:00:00Z
depth: quick
files_reviewed: 6
files_reviewed_list:
  - lib/utils/transaction-totals.ts
  - lib/utils/format-amount.ts
  - components/transactions/transaction-table.tsx
  - tests/transaction-totals.test.ts
  - tests/format-amount.test.ts
  - tests/transaction-table-footer-totals.test.tsx
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Quick Task 260730-e6z: Code Review Report

**Reviewed:** 2026-07-30
**Depth:** quick (with targeted reads of called helpers — `lib/utils/decimal.ts`, `lib/utils/amount-tone.ts`, `lib/db/schema.ts` currency/amount columns, and `lib/dal/transactions.ts`'s `pairedNetAmount` SQL — to verify claims made in this review)
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed `computeTransactionTotals`, the new `formatSignedAmount` formatter, and the transactions-table footer that wires them together. The sign-split / per-currency bucketing logic itself is correct and the arithmetic path is entirely Decimal.js (no native `+`/`-`/`*`/`/` on amounts, satisfying the project's monetary-arithmetic rule). The footer render gating (`hasMore === false && !isLoadingMore && loadedTransactions.length > 0`) is correctly wired and covered by tests. No security issues, no hardcoded secrets, no `eval`/`innerHTML` usage.

Two real gaps found:
1. `computeTransactionTotals` has no defensive handling for malformed decimal strings, inconsistent with every sibling helper touched in this same change (`formatAbsoluteAmount`, `formatSignedAmount`, the pre-existing `amountToneClass`), and is untested for that case.
2. The pre-existing `aria-live="polite"` footer region now wraps a totals summary that recomputes and re-renders on essentially every table mutation (delete, retitle, categorize, tag-assign, split, unlink, amortize/reimburse), which will cause a screen reader to re-announce the whole summary block on edits that have nothing to do with viewing totals.

Both are shipped-quality-affecting but neither is a security or data-loss issue, so both are filed as Warnings, not Blockers. Also noting minor code-duplication and test-assertion-strength issues as Info.

## Warnings

### WR-01: `computeTransactionTotals` has no defensive handling for invalid decimal strings, unlike every sibling helper in this change

**File:** `lib/utils/transaction-totals.ts:59`
**Issue:** `const net = toDecimal(row.pairedNetAmount ?? row.amount)` calls `new Decimal(value)` with no try/catch. `Decimal.js` throws a `DecimalError` on a non-numeric string. This function is invoked inside a `useMemo` at render time (`components/transactions/transaction-table.tsx:260-263`), so a single malformed row would throw during render and there is no error boundary visible around `TransactionTable` — the whole component (and likely the page) would crash instead of degrading.

This is a real inconsistency introduced within this same commit:
- `formatAbsoluteAmount` / `formatSignedAmount` (`lib/utils/format-amount.ts:52-60`, `74-82`) both guard with `Number.isFinite(numericAmount)` and fall back to a raw-string display instead of throwing.
- The pre-existing `amountToneClass` (`lib/utils/amount-tone.ts`) wraps the identical `toDecimal(amount)` call in a `try { ... } catch { return AMOUNT_TONE_CLASS.fallback }`.

`computeTransactionTotals` is the only one of the four monetary-display helpers touched by this change that assumes its input is always well-formed.

In practice this is low-probability to trigger today: `amount` is a Postgres `numeric`/`DECIMAL(10,2)` column and `pairedNetAmount` is built from a SQL expression that casts through `::numeric` and back to `::text` (`lib/dal/transactions.ts:212-229`), so both should always be well-formed at the DB boundary. But that's exactly the kind of assumption the sibling helpers in this same PR explicitly declined to make — and `tests/transaction-totals.test.ts` has no case for a non-numeric row, so this behavior difference is untested and will surface as a full-page crash the day it's ever violated (e.g. a future raw-SQL edge case, a manual data fix, or a schema relaxation).

**Fix:**
```ts
// lib/utils/transaction-totals.ts
for (const row of rows) {
  const currency = row.currency || 'EUR'
  let bucket = bucketsByCurrency.get(currency)
  if (!bucket) {
    bucket = { currency, count: 0, totalIn: new Decimal(0), totalOut: new Decimal(0), difference: new Decimal(0) }
    bucketsByCurrency.set(currency, bucket)
  }

  let net: Decimal
  try {
    net = toDecimal(row.pairedNetAmount ?? row.amount)
  } catch {
    bucket.count += 1
    continue // skip unparseable rows rather than crashing the whole footer
  }

  bucket.count += 1
  if (net.isPositive()) bucket.totalIn = bucket.totalIn.plus(net)
  else if (net.isNegative()) bucket.totalOut = bucket.totalOut.plus(net.abs())
}
```
Add a corresponding test case with a garbage `amount`/`pairedNetAmount` string asserting the function does not throw.

### WR-02: Footer summary lives inside a pre-existing `aria-live="polite"` region and re-renders (and likely re-announces) on unrelated edits

**File:** `components/transactions/transaction-table.tsx:967-1015` (region), totals recomputed at `260-263`, mutated at `setLoadedTransactions` call sites `301, 346, 351, 376, 397, 419, 443, 454, 476, 1142`
**Issue:** The `<div aria-live="polite">` wrapper itself is unchanged by this diff, but its content changed from a static "Tutte le transazioni disponibili sono caricate." message to a dynamic block (`transactionCountLabel` + per-currency Entrate/Uscite/Differenza) that is recomputed via `useMemo` on every change to `loadedTransactions`. `loadedTransactions` is mutated by delete, retitle, categorize, tag-assign, split/unlink, and amortize/reimburse actions — several of which do not change any amount at all (e.g. retitle, tag-assign). Because the changed text sits inside a polite live region, most screen readers will announce the new totals text after each such edit, even though the user's action had nothing to do with totals. This is noisier than the previous static message (which never changed after initial load) and risks confusing/irrelevant announcements firing on every unrelated row edit.

**Fix:** Move the totals summary outside the `aria-live` region (keep `aria-live="polite"` scoped to just the loading/"load more" states it originally covered), or wrap only the loading-state `<p>`/`<Button>` in the live region and mark the totals block with `aria-live="off"` (or omit the attribute, inheriting the ancestor's default) so recomputation from unrelated edits doesn't re-trigger announcements. If the totals summary itself should be announced when it first appears (i.e., "all data loaded"), consider a one-shot `aria-live="polite"` region distinct from the one now driven by every list mutation.

## Info

### IN-01: Duplicated formatter/cache scaffolding between `formatAbsoluteAmount` and `formatSignedAmount`

**File:** `lib/utils/format-amount.ts:10-39, 52-82`
**Issue:** `getCurrencyFormatter`/`getSignedCurrencyFormatter` are near-identical (separate `Map` caches, same `currency || 'EUR'` key normalization, same construction pattern), and `formatAbsoluteAmount`/`formatSignedAmount` duplicate the exact same `Number.isFinite` guard and fallback string template. Not a bug, but the file now carries two parallel implementations that will drift if one is changed without the other (e.g. the `useGrouping` ICU workaround only exists on the signed formatter).
**Fix:** Factor the shared `Number.isFinite` guard + fallback and the cache-or-create pattern into one internal helper parameterized by the `Intl.NumberFormatOptions` diff (`signDisplay`/`useGrouping`).

### IN-02: Footer integration test's "signed +60,00" assertion doesn't actually check the sign or its placement

**File:** `tests/transaction-table-footer-totals.test.tsx:147-150`
**Issue:** The comment states "Reconciling figures: Entrate 100,00 / Uscite 40,00 / Differenza +60,00", but the assertion is only `expect(html).toContain('60,00')` — a bare substring check that would still pass if the `+` sign were dropped, misplaced, or if `formatSignedAmount` regressed to unsigned output for this value. It also doesn't confirm '60,00' appears specifically inside the Differenza line rather than anywhere else in the document.
**Fix:** Assert on the more specific signed string, e.g. `expect(html).toContain('+60,00')`, or scope the query to the Differenza `<span>` before checking its text content.

### IN-03: No test exercises `computeTransactionTotals` with a non-numeric amount string

**File:** `tests/transaction-totals.test.ts`
**Issue:** Every test row uses well-formed numeric strings. There is no test asserting behavior (throw vs. graceful fallback) when `amount` or `pairedNetAmount` is not parseable — the exact gap described in WR-01. Related to WR-01: fixing the defensive-handling gap without adding a regression test would leave this silently un-covered again.
**Fix:** Add a case such as `computeTransactionTotals([row({ amount: 'not-a-number' })])` and assert the function either returns a sane bucket (0 contribution, still counted) or throws a documented error — whichever behavior is chosen for WR-01's fix.

---

_Reviewed: 2026-07-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
