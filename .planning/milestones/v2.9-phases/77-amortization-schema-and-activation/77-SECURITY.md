---
phase: 77
slug: amortization-schema-and-activation
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-07-28
---

# Phase 77 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser → `createAmortizationPlan` Server Action | Untrusted `transactionId`/`months` cross here | Transaction identity + plan duration |
| Browser → `removeAmortizationPlan` Server Action | Untrusted `planId` crosses here | Plan identity |
| Browser → `createTransaction` Server Action (extended) | Untrusted `amortizationEnabled`/`amortizationMonths` alongside description/amount/date | New transaction + inline plan duration |
| Server Action → Postgres | Raw SQL inside the `ledger_entry` views and the guard/aggregation queries | User-scoped financial rows |
| `ledger_entry_cash` view → 10 aggregation functions | No new user input (already-validated filters/date ranges) | Aggregated cash-lens amounts |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-77-01 | Elevation of Privilege | createAmortizationPlan | high | mitigate | `verifySession()` supplies `userId` server-side; `activatePlanTx` load scoped `eq(transaction.userId, userId) AND eq(expense.userId, userId)` → foreign id = `TRANSACTION_NOT_FOUND` (`amortization.ts:36`, `amortization-activation.ts:78-84`, `amortization-guards.ts:38-39`) | closed |
| T-77-02 | Tampering | months input | medium | mitigate | `z.number().int().min(2)` + `validateMonthsForAmount` rejects sub-€0.01 instalments server-side (`amortization.ts` schema:9, `amortization-math.ts:61-78`, invoked at `activation:94`) | closed |
| T-77-03 | Tampering | ledger_entry_cash view SQL | high | mitigate | View SQL built exclusively from Drizzle `sql` tagged-template table/column refs — no string concat of user input; static migration-time object (`schema.ts:734-828`) | closed |
| T-77-04 | Tampering | activatePlanTx atomicity | high | mitigate | detach + plan insert + instalment insert all on one passed-in `tx`; every call site wraps in `db.transaction` — no standalone-`db` bypass (`amortization-activation.ts:99-129`, `amortization.ts:39`, `transactions.ts:79-89`) | closed |
| T-77-05 | Information Disclosure | getAmortizationEligibility reasons | low | accept | Guard reasons scoped to caller's own userId-filtered query — no cross-user exposure | closed |
| T-77-06 | Elevation of Privilege | removeAmortizationPlan | high | mitigate | `verifySession()` + plan lookup scoped `id=planId AND userId=userId`; `reverseDetachTx` re-scopes `id AND userId AND transactionId` (`amortization.ts:83-95`, `transaction-detach.ts:195-205`) | closed |
| T-77-07 | Tampering | reverseDetachTx atomicity | high | mitigate | expenseId re-point + plan/instalment delete + reconcile all on one `tx`; `reconcileExpensesAfterTransactionRemoval` takes `DbOrTx`, no nested transaction; call site wraps in `db.transaction` (`transaction-detach.ts:271-287`, `expense-reconciliation.ts:173-190`, `amortization.ts:97-103`) | closed |
| T-77-08 | Repudiation | removeAmortizationPlan | low | accept | No audit-log regression vs. existing forward-detach path (neither writes an explicit audit row) | closed |
| T-77-09 | Tampering | amortizationMonths input | medium | mitigate | `CreateTransactionSchema` superRefine requires integer ≥2 when enabled; identical `validateMonthsForAmount` server-side re-check (`transactions.ts` validation:26-42) | closed |
| T-77-10 | Tampering | combined create+amortize atomicity | high | mitigate | `insertManualTransactionTx` + `activatePlanTx` inside ONE `db.transaction`; guard/write failure rolls back the transaction insert too (`transactions.ts:79-89`) | closed |
| T-77-11 | Tampering | getCategoryDetail dual join | medium | mitigate | Join keyed `eq(ledgerEntryCash.id, transactionTable.id)` (PK-shaped, no user input); userId scope preserved via `dateScopedTransactions` (`dashboard.ts:1382,1405`) | closed |
| T-77-12 | Information Disclosure | ledger_entry_cash join scope | low | accept | Migrated functions retain `dateScopedTransactions(..., userId, ...)` + expense-status predicates unchanged (spot-verified in `overview.ts`) | closed |
| T-77-13 | Tampering | getTagTotals zero-transaction-tag path | medium | mitigate | LEFT JOIN chain preserved; exclusion via `FILTER` clause not outer `WHERE`, so zero-transaction tags still surface (`tags.ts:212-254`) | closed |
| T-77-14 | Information Disclosure | getTagDetail dual join | low | accept | Join key carries no user-controlled value; userId/tagId scoping in outer WHERE unchanged | closed |
| T-77-15 | Tampering | test-only changes | low | accept | Plan 77-06 touches only test mocks + a comment; no production write path | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `high` count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-77-01 | T-77-05 | Guard reason strings reveal only facts about the caller's own userId-scoped transaction | Andrea | 2026-07-28 |
| R-77-02 | T-77-08 | Undo writes no audit row — matches the existing forward-detach path (no regression) | Andrea | 2026-07-28 |
| R-77-03 | T-77-12 | Seam swap does not touch the userId-scoping boundary on migrated aggregations | Andrea | 2026-07-28 |
| R-77-04 | T-77-14 | getTagDetail dual-join key carries no user-controlled value | Andrea | 2026-07-28 |
| R-77-05 | T-77-15 | Test-only changes, no production write path or trust boundary | Andrea | 2026-07-28 |

*Accepted risks do not resurface in future audit runs. All five are `low` severity — below the `high` block threshold.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-28 | 15 | 15 | 0 | gsd-security-auditor (ASVS L1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-28
