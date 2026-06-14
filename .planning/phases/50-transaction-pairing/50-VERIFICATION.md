---
phase: 50-transaction-pairing
verified: 2026-06-14T17:00:00Z
status: human_needed
score: 10/10 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Link two opposite transactions via 'Collega rimborso', confirm badge appears and dashboard nets correctly"
    expected: "Badge shows signed net (e.g. €-50); dashboard OUT total for the primary's month reflects the algebraic net; secondary no longer counts independently"
    why_human: "Visual badge rendering, dashboard aggregation display, and date-scoped netting correctness require a running application with real DB data"
  - test: "Open the counterpart picker dialog and verify eligible list filtering"
    expected: "Picker shows only opposite-sign, in-range (±90 days), not-already-paired counterparts; widening the date range loads more; self is excluded"
    why_human: "Dynamic list population from server action depends on live DB query output and real transaction data"
  - test: "Click the pair badge, verify popover shows correct counterpart details including distinct Importo vs Netto values"
    expected: "Popover shows counterpart description, Importo (counterpart's own amount), Netto (algebraic net), date, and working 'Vai alla transazione' link"
    why_human: "Popover data accuracy requires real pairedAmount vs pairedNetAmount values from the DB; 'Vai alla transazione' anchor navigation requires a running app"
  - test: "Unlink via 'Scollega' on either leg, confirm both rows lose the badge and dashboard returns to independent aggregation"
    expected: "Badge disappears from both rows immediately without page reload; dashboard totals return to treating each transaction independently"
    why_human: "Key-based remount behavior (TransactionTable key changes), badge disappearance, and baseline-restoration in dashboard require live interaction"
---

# Phase 50: Transaction Pairing Verification Report

**Phase Goal:** Explicit 1:1 transaction↔opposite linking (order↔refund); paired display in the transaction list; unlink flow; implicit netting baseline unchanged (ADR 0004 preserved for unpaired transactions).
**Verified:** 2026-06-14T17:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | transaction_pair table exists with dual single-column UNIQUEs and ON DELETE CASCADE FKs | VERIFIED | `drizzle/migrations/0020_transaction_pair.sql` contains CREATE TABLE, CONSTRAINT transaction_pair_a_unique, CONSTRAINT transaction_pair_b_unique, FK references with ON DELETE cascade; applied via yarn db:migrate |
| 2 | createPair verifies both transactions belong to session user before any insert (IDOR-blocked) | VERIFIED | `lib/services/transaction-pairs.ts` checks both t1.userId and t2.userId; 29/29 service tests GREEN including ownership rejection cases |
| 3 | createPair resolves primary by larger abs(amount) via Decimal.js, tie-breaking on earlier occurredAt | VERIFIED | Lines 90-113 of services/transaction-pairs.ts use toDecimal().abs() — no Math.abs or native arithmetic; tests for primary resolution and tie-break pass GREEN |
| 4 | Self-pair guard rejects transactionId === counterpartId (CR-01 fix applied) | VERIFIED | Lines 30-32 of services/transaction-pairs.ts; test "throws when transactionId === counterpartId, before any DB read or insert" passes GREEN (commit 221382b) |
| 5 | Opposite-sign enforcement rejects same-sign or zero-amount pairing (CR-03 fix applied) | VERIFIED | Lines 81-86 of services/transaction-pairs.ts use Decimal gt/lt 0; picker DAL returns sql\`false\` for zero reference; tests GREEN (commit 221382b) |
| 6 | createPair and deletePairByTransactionId are wrapped in db.transaction (CR-02 fix applied) | VERIFIED | Lines 38 and 138 of services/transaction-pairs.ts; atomicity tests GREEN (commit 221382b) |
| 7 | Shared isNotSecondary() and effectiveAmount() are applied at all aggregation sites with no inline re-derivation | VERIFIED | dashboard.ts: 9 isNotSecondary() calls, 11 effectiveAmount() calls; overview.ts: 5 isNotSecondary() calls, 5 effectiveAmount() calls — all via import from transaction-pairs-sql.ts; grep for inline NOT EXISTS / CASE WHEN EXISTS on transaction_pair returns 0 matches |
| 8 | Unpaired transactions aggregate as before (ADR 0004 baseline unchanged) | VERIFIED | ADR 0004 regression guard test in tests/dashboard-dal.test.ts passes GREEN; effectiveAmount() ELSE branch returns transaction.amount unchanged for unpaired rows |
| 9 | Transaction list select exposes pairedWithId, pairedNetAmount, pairedAmount, pairedDescription, pairedOccurredAt | VERIFIED | lib/dal/transactions.ts lines 93-147: all 5 correlated subquery fields present on transactionListSelect; TransactionListRow type declares all nullable; select-shape tests GREEN |
| 10 | "Collega rimborso"/"Scollega" row actions, inline badge, and counterpart picker dialog are present in the UI | VERIFIED | transaction-table.tsx contains both text strings, pairTarget state, CounterpartPickerDialog mount, TransactionPairPopover badge; counterpart-picker-dialog.tsx wired to createTransactionPairAction; transaction-pair-popover.tsx uses Popover + Badge + Link2 + toDecimal |

**Score:** 10/10 truths verified

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PAIR-01 | 50-01, 50-02, 50-03, 50-05 | User can explicitly link a transaction to its opposite (expense↔reimbursement) as 1:1 pairing | SATISFIED | createPair service with IDOR check + atomic write; createTransactionPairAction action; "Collega rimborso" row action + CounterpartPickerDialog |
| PAIR-02 | 50-01, 50-04, 50-05 | Paired transactions have dedicated display making the link and netting effect visible | SATISFIED | pairedWithId/pairedNetAmount/pairedAmount/pairedDescription/pairedOccurredAt on transactionListSelect; TransactionPairPopover badge + popover with signed net via toDecimal |
| PAIR-03 | 50-01, 50-02, 50-03, 50-04, 50-05 | Unlinking is possible; implicit-netting baseline unchanged for unpaired transactions | SATISFIED | deletePairByTransactionId with atomic ownership check + or-predicate delete; "Scollega" row action; isNotSecondary()/effectiveAmount() have no effect on unpaired rows (ELSE branch); ADR 0004 regression guard GREEN |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|---------|--------|---------|
| `lib/db/schema.ts` | transactionPair pgTable + relations | VERIFIED | Exists, contains transactionPair, dual unique constraints, ON DELETE CASCADE FKs, transactionPairRelations — no userId column |
| `drizzle/migrations/0020_transaction_pair.sql` | CREATE TABLE transaction_pair + indexes | VERIFIED | Additive-only: CREATE TABLE, 2 UNIQUE constraints, 2 FK ALTERs, 2 btree indexes; no DROP/ALTER on existing tables |
| `lib/dal/transaction-pairs-sql.ts` | isNotSecondary() + effectiveAmount() | VERIFIED | Both exported; import 'server-only'; references transaction as transactionTable; NOT EXISTS and CASE WHEN EXISTS fragments confirmed |
| `lib/validations/transaction-pairs.ts` | CreatePairSchema, DeletePairSchema | VERIFIED | Both exported using z.string().min(1) (not z.number()); CreatePairInput and DeletePairInput types present |
| `lib/services/transaction-pairs.ts` | createPair + deletePairByTransactionId | VERIFIED | Both exported; import 'server-only'; db.transaction wrappers; toDecimal for amount comparison; or-predicate delete |
| `lib/actions/transaction-pairs.ts` | createTransactionPairAction + deleteTransactionPairAction | VERIFIED | Both exported with 'use server'; verifySession after Zod parse; revalidatePath('/transactions') and revalidatePath('/overview') in both |
| `lib/dal/transaction-pairs.ts` | getEligibleCounterparts | VERIFIED | Exported as cache(); verifySession; eq(transaction.userId, userId); ne(self); signFilter via Decimal; NOT EXISTS already-paired; zero-reference returns sql\`false\` |
| `lib/dal/dashboard.ts` | Netting applied to 6 aggregation sites | VERIFIED | import from transaction-pairs-sql; isNotSecondary() in 9 WHERE clauses; effectiveAmount() in 11 SUM expressions; getOverviewAmountTotals, getCategoriesBreakdown, getCategoryRanking, getCategoryDeviations, getCategoryDetail, getMonthlyTrendByNature all modified |
| `lib/dal/overview.ts` | Netting applied to 2 sites | VERIFIED | import from transaction-pairs-sql; isNotSecondary() at lines 230, 264, 309, 343, 482; effectiveAmount() at lines 205, 239, 283, 317, 458; getOverview NOT modified (delegates to getOverviewAmountTotals — no double-count) |
| `lib/dal/transactions.ts` | pairedWithId + 4 paired fields on transactionListSelect | VERIFIED | pairedWithId, pairedNetAmount, pairedAmount, pairedDescription, pairedOccurredAt as correlated subqueries (no new LEFT JOIN); all 5 nullable on TransactionListRow |
| `components/transactions/counterpart-picker-dialog.tsx` | CounterpartPickerDialog | VERIFIED | 'use client'; useActionState(createTransactionPairAction); submittedRef; Dialog/Input/hidden counterpartId; loadEligibleCounterpartsAction wired; key={pairTarget.id} per-dialog remount |
| `components/transactions/transaction-pair-popover.tsx` | TransactionPairPopover | VERIFIED | Popover + Badge + Link2; toDecimal for net and amount; no dangerouslySetInnerHTML; "Vai alla transazione" link present |
| `components/transactions/transaction-table.tsx` | Collega/Scollega actions + badge | VERIFIED | "Collega rimborso" and "Scollega" present; pairTarget state; CounterpartPickerDialog mounted; TransactionPairPopover badge renders when pairedWithId && pairedNetAmount; natural row order (no re-sort) |
| `app/(app)/transactions/page.tsx` | RSC with key-based remount | VERIFIED | No 'use client'; pairedWithId and pairedNetAmount included in buildTransactionTableKey |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `lib/services/transaction-pairs.ts` | `transaction.userId` | ownership query before insert/delete | WIRED | t1.userId !== input.userId and t2.userId !== input.userId checks at lines 73-74 |
| `lib/actions/transaction-pairs.ts` | `lib/services/transaction-pairs.ts` | createPair / deletePairByTransactionId after verifySession | WIRED | import at line 6; verifySession before service call |
| `lib/dal/dashboard.ts` | `lib/dal/transaction-pairs-sql.ts` | import isNotSecondary, effectiveAmount | WIRED | import at line 38; both helpers used at all 6 function sites |
| `lib/dal/overview.ts` | `lib/dal/transaction-pairs-sql.ts` | import isNotSecondary, effectiveAmount | WIRED | import at line 18; both helpers used at 2 function sites |
| `lib/dal/transactions.ts` (transactionListSelect) | `transaction_pair` | correlated subqueries for 5 paired fields | WIRED | SQL `FROM transaction_pair tp WHERE tp.transaction_a_id = ... OR tp.transaction_b_id = ...` at lines 98-148 |
| `components/transactions/transaction-table.tsx` | `components/transactions/counterpart-picker-dialog.tsx` | pairTarget state opens the dialog | WIRED | setPairTarget on "Collega rimborso"; CounterpartPickerDialog open={pairTarget !== null} |
| `components/transactions/counterpart-picker-dialog.tsx` | `lib/actions/transaction-pairs.ts` | useActionState(createTransactionPairAction) | WIRED | import at line 18; wired via useActionState |
| `components/transactions/transaction-table.tsx` | `lib/actions/transaction-pairs.ts` | deleteTransactionPairAction on Scollega | WIRED | import at line 45; handleUnpair calls deleteTransactionPairAction |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `counterpart-picker-dialog.tsx` | counterparts | `loadEligibleCounterpartsAction` → `getEligibleCounterparts` (DAL query with WHERE user/sign/date/paired filters) | Yes — DB query against live transaction_pair + transaction tables | FLOWING |
| `transaction-pair-popover.tsx` | netAmount / pairedDescription / pairedAmount | `transactionListSelect` correlated subqueries in `lib/dal/transactions.ts` | Yes — SQL correlated subqueries joining transaction_pair at query time | FLOWING |
| `transaction-table.tsx` badge | transaction.pairedWithId, transaction.pairedNetAmount | `getTransactions` → `transactionListSelect` | Yes — pairedWithId and pairedNetAmount come from live correlated subqueries; null when unpaired | FLOWING |
| `lib/dal/dashboard.ts` totals | totalIn / totalOut / totalAllocation | effectiveAmount() adds secondary.amount to primary via SQL; isNotSecondary() excludes secondary from its own bucket | Yes — algebraic net computed in SQL at query time via shared fragment helpers | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| createPair/deletePair service tests (ownership, primary resolution, self-pair, opposite-sign, atomicity) | `yarn test tests/transaction-pairs-service.test.ts tests/transaction-pairs-dal.test.ts` | 29 passed (2 files) | PASS |
| Dashboard netting helpers + ADR 0004 regression guard | `yarn test tests/dashboard-dal.test.ts tests/transactions-dal.test.ts` | 77 passed (2 files) | PASS |
| Module exports `isNotSecondary` and `effectiveAmount` | grep of lib/dal/transaction-pairs-sql.ts | Both exported as named functions | PASS |
| Migration 0020 is additive-only (no DROP/ALTER on existing tables) | Read drizzle/migrations/0020_transaction_pair.sql | Only CREATE TABLE, ALTER TABLE ADD CONSTRAINT (FKs), CREATE INDEX — no DROP or ALTER of pre-existing tables | PASS |
| transactions/page.tsx stays RSC (no 'use client') | grep 'use client' app/(app)/transactions/page.tsx | 0 matches | PASS |

### Probe Execution

No declared probes for this phase. Step 7c SKIPPED — phase has no probe-*.sh scripts.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `lib/dal/dashboard.ts` | 470, 954, 1014, 1121, 1178, 1336 | Blanket `catch {}` returns ZERO_AMOUNT / empty arrays with no logging | WARNING (WR-01 from code review) | Broken effectiveAmount() / isNotSecondary() fragments would silently degrade to €0.00 with no observable error; pre-dates this phase |
| `lib/actions/transaction-pairs.ts` | 60-73 | `loadEligibleCounterpartsAction` has no Zod validation on referenceId / referenceAmount | WARNING (WR-02 from code review) | Client can send arbitrary referenceAmount to influence sign filter; session scoping limits cross-user risk but sign decouples from the real reference transaction |
| `components/transactions/transaction-table.tsx` | 400-401 | `pairedAmount ?? pairedNetAmount` and `pairedOccurredAt ?? new Date()` fallbacks could render wrong data | WARNING (WR-05 from code review) | If DAL returns null pairedAmount/pairedOccurredAt on a paired row, popover shows net as Importo and today as counterpart date |
| `components/transactions/counterpart-picker-dialog.tsx` | 52-56 | `offsetDateISO` uses local-time `toISOString().slice(0,10)` for ±90-day window | WARNING (WR-07 from code review) | Off-by-one date at UTC+1/+2 near midnight; affects picker date range boundary; Italian users affected |

No TBD/FIXME/XXX debt markers found in any phase 50 file. The one `placeholder` match is an HTML attribute value (`placeholder="Filtra per descrizione…"`) — not a code stub.

### Human Verification Required

#### 1. Link Flow: "Collega rimborso" → Picker → Pair Created → Badge Appears

**Test:** On the transactions list, open a row dropdown for a transaction (e.g. -€100 dinner), click "Collega rimborso". Select a +€50 credit from the picker. Confirm.
**Expected:** Both rows now show the 🔗 badge with the same signed net (e.g. €-50); rows remain in their natural chronological position; no page reload required (key-based remount).
**Why human:** Badge rendering, chronological order preservation, and immediate-update-without-reload require a running app with real paired DB rows.

#### 2. Counterpart Picker Filtering

**Test:** Open the counterpart picker for a negative transaction. Verify the list shows only positive-amount, in-range (±90 days from transaction date), not-already-paired transactions. Widen the date range and confirm more results load. Verify the reference transaction itself is absent from the list.
**Expected:** Only opposite-sign, in-window, unpaired counterparts appear; list updates when date range changes; self is excluded.
**Why human:** Dynamic list filtering requires live DB rows and real server action execution.

#### 3. Pair Popover Content and Navigation

**Test:** Click the 🔗 badge on a paired row. Inspect the popover.
**Expected:** Popover shows: counterpart description; Importo = counterpart's own original amount (distinct from Netto); Netto = algebraic sum (primary.amount + secondary.amount); counterpart date; "Vai alla transazione" link that navigates correctly.
**Why human:** Importo vs Netto distinction requires live pairedAmount vs pairedNetAmount DB values; link navigation requires browser execution.

#### 4. Dashboard Netting Effect

**Test:** After pairing a -€100 dinner with a +€50 reimbursement, open the dashboard for that month.
**Expected:** The OUT total for that month reflects -€50 net (not -€100); the secondary +€50 does NOT appear as IN independently; an unrelated unpaired +€100 salary still appears as IN unchanged.
**Why human:** Dashboard aggregation correctness (isNotSecondary + effectiveAmount effect on live data) requires a populated DB and rendered dashboard UI.

#### 5. Unlink Flow: "Scollega" → Baseline Restored

**Test:** On either paired row, open the dropdown, click "Scollega". Confirm.
**Expected:** Badge disappears from both rows immediately (no page reload); dashboard returns to treating both transactions independently (original totals restored).
**Why human:** Key-based remount behavior for badge disappearance, and dashboard baseline-restoration after unlink, require live interaction with a running app.

### Gaps Summary

No blockers. All 10 must-haves verified. Three code-review blockers (CR-01 self-pair, CR-02 non-atomic write, CR-03 opposite-sign) were resolved in commit 221382b with test coverage. Remaining 7 warnings and 4 info findings from the code review are open tracked items that do not block goal achievement (they affect robustness: logging on catch, Zod on one action, popover fallback values, date timezone edge case). All PAIR-01/PAIR-02/PAIR-03 requirements are marked complete in REQUIREMENTS.md. Status is `human_needed` because the end-to-end UX flow (badge rendering, popover content, dashboard netting on live data, unlink behavior) cannot be verified programmatically.

---

_Verified: 2026-06-14T17:00:00Z_
_Verifier: Claude (gsd-verifier)_
