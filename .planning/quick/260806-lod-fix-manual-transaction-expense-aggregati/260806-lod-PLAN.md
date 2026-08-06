---
phase: 260806-lod
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/dal/transactions.ts
  - tests/manual-transaction-expense-aggregation.test.ts
autonomous: true
requirements:
  - MANUALTX-01
  - MANUALTX-02
  - MANUALTX-03

estimate:
  tokens: 55000
  raw_tokens: 40000
  tasks: 1
  confidence: low

must_haves:
  truths:
    - "Creating two manual transactions with the identical description (e.g. 'caffè' typed twice) both succeed with no PG 23505 unique violation on expense_userId_descriptionHash_unique, and both transactions link to the SAME expense row."
    - "After the second manual transaction with a repeated description, that expense's transactionCount is 2, totalAmount is the exact Decimal.js algebraic sum of both amounts, and firstTransactionAt/lastTransactionAt span the earliest and latest occurredAt of the two, regardless of insertion order."
    - "An expense that already has a subCategoryId (already categorized) keeps that subCategoryId unchanged even when a later manual transaction with the same description supplies a different subCategoryId — the manual lock is never silently overridden."
    - "An expense with NO subCategoryId yet receives the caller-supplied subCategoryId (and status becomes '3') when a later manual transaction with the same description provides one."
    - "insertManualTransactionTx keeps returning { transactionId, expenseId } and stays tx-composable — createTransaction's db.transaction composition with activatePlanTx (lib/actions/transactions.ts:73-90) needs zero changes."
    - "tests/amortization-manual-entry.test.ts stays green — the create+amortize path, the outflow-only/min-months validation errors, and the plain manual-entry regression case are all unaffected."
  artifacts:
    - "lib/dal/transactions.ts — insertManualTransactionTx rewritten to get-or-create the Expense by (userId, descriptionHash) and accumulate aggregates, mirroring lib/services/import.ts's canonical behavior (SEED-005 D14)"
    - "tests/manual-transaction-expense-aggregation.test.ts — new real-Postgres regression test proving dedup-accumulate, manual-lock preservation, and apply-when-none"
  key_links:
    - "insertManualTransactionTx's new SELECT-by-(userId,descriptionHash) -> expense_userId_descriptionHash_unique (lib/db/schema.ts:420) -> no more PG 23505 on a repeated manual description"
    - "insertManualTransactionTx's unchanged { transactionId, expenseId } return shape -> createTransaction's db.transaction composition with activatePlanTx -> tests/amortization-manual-entry.test.ts's real-Postgres regression proof stays valid with zero test-file changes"
---

<objective>
Fix the PG 23505 unique-violation bug on manual transaction creation by aligning
`insertManualTransactionTx` (`lib/dal/transactions.ts`) to the import path's canonical
get-or-create + accumulate Expense semantics (`lib/services/import.ts:666-728`), per the locked
decision D14 in `.planning/seeds/SEED-005-telegram-capture-bot.md`.

Purpose: today, a second manual transaction with a description that already has an Expense (e.g.
typing "caffè" twice) always tries to INSERT a brand-new Expense row with the same
`(userId, descriptionHash)`, violating `expense_userId_descriptionHash_unique`
(`lib/db/schema.ts:420`). The generic `catch` in `createTransaction`
(`lib/actions/transactions.ts:48-107`) swallows the error and returns a message implying a
transient failure, when the failure is actually permanent and repeatable on every subsequent
identical description.

Output: `insertManualTransactionTx` looks up an existing Expense by `(userId, descriptionHash)`
first. If found, it reuses that Expense — accumulating `totalAmount`/`transactionCount` via
Decimal.js and widening `firstTransactionAt`/`lastTransactionAt` — and never overwrites an
already-set `subCategoryId` (the manual lock), applying a caller-supplied `subCategoryId` only
when the existing Expense has none. If not found, it creates the Expense exactly as before. The
function's signature and `{ transactionId, expenseId }` return shape are unchanged, so the
amortization composition in `createTransaction` (`lib/actions/transactions.ts:73-90`) needs no
changes at all.

Out of scope (explicitly, per the locked task boundaries): no `lib/services/manual-entry.ts`
extraction (that refactor is SEED-005 D18, gated on a second write channel existing), no schema
migration (the unique constraint is correct — the write path was wrong), no change to
`createTransaction`'s generic error-catch copy (the fix removes the code path that produced the
misleading message for this case, rather than rewording it).
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/seeds/SEED-005-telegram-capture-bot.md
@lib/dal/transactions.ts
@lib/services/import.ts
@lib/db/schema.ts
@lib/actions/transactions.ts
@lib/utils/decimal.ts
@lib/utils/import.ts
@tests/amortization-manual-entry.test.ts
@tests/fixtures/reimbursement-seed.ts
@tests/helpers/reimbursement-test-db.ts

**Not touched by this plan** (verified by reading): `lib/actions/transactions.ts` (signature
compatibility already holds — `insertManualTransactionTx`'s return shape is unchanged, so
`createTransaction`'s `db.transaction` composition with `activatePlanTx` needs no edits);
`lib/db/schema.ts` (no migration — `expense_userId_descriptionHash_unique` is correct as-is);
`lib/dal/classification-history.ts` (manual creation does not run the categorization pipeline, so
no classification-history write is added by this fix — only `lib/services/import.ts`'s
auto-categorization path writes history, which manual entry never invokes).
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Get-or-create + accumulate Expense in insertManualTransactionTx (D14)</name>
  <files>lib/dal/transactions.ts, tests/manual-transaction-expense-aggregation.test.ts</files>
  <behavior>
    - Two calls to insertManualTransactionTx with the SAME userId and description (different
      amounts/dates so their transactionHash values differ) both resolve successfully — no thrown
      PG 23505 — and return the SAME expenseId.
    - After both calls, the expense row for that (userId, descriptionHash) has
      transactionCount = 2, totalAmount equal to the Decimal.js sum of both amounts, and
      firstTransactionAt/lastTransactionAt equal to the min/max of the two occurredAt values —
      verified with the SECOND call's occurredAt deliberately EARLIER than the first call's, to
      prove firstTransactionAt moves backward correctly (not just forward).
    - When the first call supplies a subCategoryId and the second call (same description) supplies
      a DIFFERENT subCategoryId, the expense's subCategoryId after the second call is still the
      FIRST value — never overwritten.
    - When the first call supplies NO subCategoryId and the second call (same description)
      supplies one, the expense's subCategoryId after the second call equals the second call's
      value and its status becomes '3'.
    - A single call with a brand-new description still creates exactly one new expense with
      transactionCount = 1, matching today's existing behavior (no regression).
  </behavior>
  <action>
    In `lib/dal/transactions.ts`:

    1. Add `toDbDecimal` to the existing `import { toDecimal } from '@/lib/utils/decimal'` line
       (becomes `import { toDecimal, toDbDecimal } from '@/lib/utils/decimal'`).

    2. Update the JSDoc block directly above `insertManualTransactionTx` to add a paragraph citing
       SEED-005 decision D14: the function now performs a get-or-create of the Expense by
       `(userId, descriptionHash)` instead of unconditionally inserting a new one, mirroring
       `lib/services/import.ts`'s canonical get-or-create + accumulate behavior (its
       "Upsert expense by (userId, descriptionHash)" block, roughly lines 666-728). This closes the
       PG 23505 unique-violation on `expense_userId_descriptionHash_unique`
       (`lib/db/schema.ts:420`) that a second manual entry with a repeated description used to hit.

    3. Inside the function body, keep the existing `descriptionHash`, `transactionId`, and
       `transactionHash` computation unchanged (still via the dynamic
       `await import('@/lib/utils/import')` for `computeDescriptionHash`/`computeTransactionHash`).
       Remove the unconditional `const expenseId = crypto.randomUUID()` line and the unconditional
       `await tx.insert(expense).values({...})` call that follows it. Replace both with:

       a. A SELECT against `expense` scoped to
          `and(eq(expense.userId, data.userId), eq(expense.descriptionHash, descriptionHash))`,
          `.limit(1)`, selecting `id`, `totalAmount`, `transactionCount`, `subCategoryId`,
          `firstTransactionAt`, `lastTransactionAt`, resolved to the first row or `null`
          (same `.then((rows) => rows[0] ?? null)` idiom `lib/services/import.ts` already uses for
          its own existing-expense lookup).

       b. Declare `let expenseId: string`, then branch:
          - **If a row was found:** set `expenseId` to its `id`. Compute
            `shouldApplySubCategory = existing.subCategoryId == null && data.subCategoryId != null`
            — this IS the manual lock: an already-categorized expense's `subCategoryId` is never
            touched by a later manual insert, even when the caller passes a different one; a
            caller-supplied `subCategoryId` is applied only when the existing expense has none yet.
            Compute the new `totalAmount` via
            `toDbDecimal(toDecimal(existing.totalAmount).plus(toDecimal(data.amount)))`, the new
            `transactionCount` via `(existing.transactionCount ?? 0) + 1`, and the new
            `firstTransactionAt`/`lastTransactionAt` as the earlier/later of `data.occurredAt` and
            the existing value (falling back to `data.occurredAt` if the existing value happens to
            be `null`) via plain `Date` comparison (`<`/`>`) — never assume the new transaction is
            always the most recent one, since manual entries can be backdated. Build an update
            payload typed like `lib/services/import.ts`'s own `updatePayload` object
            (`totalAmount: string`, `transactionCount: number`, `firstTransactionAt: Date`,
            `lastTransactionAt: Date`, `updatedAt: Date`, plus optional
            `subCategoryId?: number | null` and `status?: '1' | '2' | '3' | '4'`), including
            `subCategoryId: data.subCategoryId ?? null` and `status: '3'` in that payload ONLY when
            `shouldApplySubCategory` is true. Run
            `tx.update(expense).set(updatePayload).where(and(eq(expense.id, expenseId), eq(expense.userId, data.userId)))`.
          - **If no row was found:** set `expenseId = crypto.randomUUID()` and insert the expense
            exactly as the current code does today — same `title`/`descriptionHash`/`subCategoryId`
            (`data.subCategoryId ?? null`)/`totalAmount`/`transactionCount: 1`/
            `firstTransactionAt`/`lastTransactionAt` (both `data.occurredAt`)/`status`
            (`data.subCategoryId ? '3' : '1'`) — zero behavior change on this branch.

       c. Leave the final `tx.insert(transaction).values({...})` call and the
          `return { transactionId, expenseId }` exactly as they are today, referencing the now
          conditionally-resolved `expenseId`.

    4. Do not touch `insertManualTransaction` (the thin `db.transaction` wrapper) — it already
       delegates to `insertManualTransactionTx` unchanged, so no edit is needed there.

    Create `tests/manual-transaction-expense-aggregation.test.ts` following the exact real-Postgres
    harness pattern `tests/amortization-manual-entry.test.ts` already uses
    (`connectReimbursementTestDb`/`resetReimbursementFixtures`/`seedUser` from
    `tests/helpers/reimbursement-test-db.ts` and `tests/fixtures/reimbursement-seed.ts`,
    `describeIfReachable`/`assertHarnessReachableInCi` gating, `afterAll` pool teardown). Since
    `insertManualTransactionTx(tx, data)` is tx-composable and takes the db handle as its first
    argument, call it DIRECTLY against the harness (via `harness.db.transaction((tx) =>
    insertManualTransactionTx(tx, data))` per call) — no need to mock `@/lib/db` or go through the
    `createTransaction` Server Action for this file. Also call `assertHarnessReachableInCi(harness,
    'manual-transaction-expense-aggregation')` right after connecting, since this suite's entire
    value is its real-Postgres assertions. Cover the five `<behavior>` bullets above as separate
    `it` blocks, seeding a user via `seedUser` and a subcategory pair via `seedMinimalTaxonomy`
    (from `tests/fixtures/reimbursement-seed.ts`) only for the subCategoryId-related tests. Assert
    directly against the `expense`/`transaction` tables (import them from `@/lib/db/schema`) using
    `toDecimal(...).equals(...)` for amount comparisons — never native `===`/`+` on amount strings.
  </action>
  <verify>
    <automated>node_modules/.bin/vitest run tests/manual-transaction-expense-aggregation.test.ts tests/amortization-manual-entry.test.ts</automated>
  </verify>
  <done>Two manual transactions with the same description accumulate into ONE expense with correct transactionCount/totalAmount/firstTransactionAt/lastTransactionAt regardless of insertion order; an already-categorized expense's subCategoryId is never overwritten by a later manual insert; a caller-supplied subCategoryId is applied only when the expense has none yet; both test files pass; insertManualTransactionTx's signature/return shape is unchanged.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| `insertManualTransactionTx`'s new Expense lookup/update | Reads and writes an existing row scoped by `userId`; `userId` is supplied by the caller (`createTransaction`, which binds it from `verifySession()`), never taken from client-controlled input directly. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-lod-01 | Tampering | New SELECT/UPDATE against `expense` inside `insertManualTransactionTx` (IDOR) | high | mitigate | Both the SELECT and the UPDATE include `eq(expense.userId, data.userId)`; `data.userId` is bound from the authenticated session by the only caller (`createTransaction` -> `verifySession()`), never client-supplied directly — no code path can target another user's expense. |
| T-lod-02 | Tampering | Manual lock bypass (silent re-categorization of an already-categorized expense) | medium | mitigate | `shouldApplySubCategory` is only true when `existing.subCategoryId == null`; an already-set `subCategoryId` is never included in the update payload, so it is structurally impossible for this code path to overwrite it. |
| T-lod-03 | Repudiation/Integrity | Monetary aggregate accumulation (`totalAmount`) | medium | mitigate | Accumulation uses `toDecimal`/`toDbDecimal` (Decimal.js) exclusively, never native `+`/string concatenation, per CLAUDE.md's hard monetary-arithmetic rule — avoids floating-point drift across repeated accumulations. |

</threat_model>

<verification>
- `node_modules/.bin/vitest run tests/manual-transaction-expense-aggregation.test.ts tests/amortization-manual-entry.test.ts` — new regression coverage plus the pre-existing composition regression, both green.
- `node_modules/.bin/tsc --noEmit` — confirm the updated `insertManualTransactionTx` typechecks against the `expense`/`transaction` Drizzle schemas.
- `yarn check:language` — confirm the new JSDoc/comment/test-name additions stay in English (developer-facing code).
</verification>

<success_criteria>
- A second manual transaction with a description that already has an expense never throws PG 23505 — it accumulates into the same expense instead.
- Aggregates (`totalAmount`, `transactionCount`, `firstTransactionAt`, `lastTransactionAt`) are correct after repeated manual entries with the same description, in any chronological order.
- The manual lock holds: an already-categorized expense's `subCategoryId` is never silently overwritten by a later manual entry; an uncategorized one can still be categorized by a later entry that supplies a `subCategoryId`.
- `insertManualTransactionTx`'s signature and `{ transactionId, expenseId }` return shape are byte-identical to before this plan; `tests/amortization-manual-entry.test.ts` passes unmodified.
- No schema migration, no new service file, no change to `createTransaction`'s error-message copy.
</success_criteria>

<!-- source-audit
SOURCE     | ID          | Item                                                                                    | Plan | Status     | Notes
---------- | ----------- | ---------------------------------------------------------------------------------------| ---- | ---------- | -----
GOAL       | MANUALTX-01 | Get-or-create + accumulate Expense by (userId, descriptionHash) in insertManualTransactionTx, mirroring import.ts, eliminating PG 23505 on repeated manual description | 01   | COVERED    | Task 1
GOAL       | MANUALTX-02 | Preserve an existing subCategoryId (manual lock); apply caller-supplied subCategoryId only when none exists yet | 01   | COVERED    | Task 1
GOAL       | MANUALTX-03 | Regression test coverage for two same-description manual insertions landing in one expense with correct aggregates | 01   | COVERED    | Task 1 (new test file)
CONSTRAINT | C-01        | insertManualTransactionTx signature/return shape stays tx-composable with activatePlanTx | 01   | COVERED    | Unchanged signature; verified via existing tests/amortization-manual-entry.test.ts staying green
CONSTRAINT | C-02        | tests/amortization-manual-entry.test.ts must stay green                                | 01   | COVERED    | Re-run in Task 1's <verify> and the plan-level <verification>
CONSTRAINT | C-03        | No lib/services/manual-entry.ts extraction (SEED-005 D18 scope, gated on a 2nd write channel) | 01   | RESPECTED  | Fix stays inside lib/dal/transactions.ts; no new service file
CONSTRAINT | C-04        | No schema migration                                                                     | 01   | RESPECTED  | Zero lib/db/schema.ts changes
-->

<output>
Create `.planning/quick/260806-lod-fix-manual-transaction-expense-aggregati/260806-lod-SUMMARY.md` when done
</output>
