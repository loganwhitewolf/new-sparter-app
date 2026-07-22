# Phase 66: expense-group-lifecycle - Research

**Researched:** 2026-07-19
**Domain:** Expense Group lifecycle operations (recategorize, add member, dissolve)
**Confidence:** HIGH
**Validation:** GRP-09 is the acceptance gate — automated integration test snapshots dashboard aggregates

## Summary

Phase 66 extends Phase 65 (expense-group-merge-and-view) with four lifecycle operations on an existing group. The CONTEXT.md is unusually complete with ten locked decisions (D-01 through D-10) that map directly to implementation tasks. No discovery is needed — the phase contract is airtight.

**Architectural stance:** Expense Groups are pure grouping entities above intact Expense rows. Recategorization propagates to all members' `expense.subCategoryId` + per-member Tier-2 history in a single transaction. Dissolving deletes only group/membership rows; freed members retain whatever category they currently carry. Merge → recategorize → dissolve is provably invariant on dashboard totals because:
- Grouping never touches transaction rows or expense.subCategoryId (pure read-time composition).
- Recategorization moves individual-expense rows; grouping adds no hidden movement.
- Dissolution is structural (no stored pre-merge state to revert); members keep their explicitly-chosen categories.

**Primary recommendation:** Follow the reusable assets, confirmed code patterns, and locked decisions from CONTEXT.md exactly. The risk is not missing capabilities — it's introducing unnecessary mutations to transaction/expense rows that would violate the GRP-09 invariance guarantee.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Recategorization triggered from two surfaces: group detail page + expenses table group row; both invoke one group-recategorize operation.
- **D-02:** One db.transaction writes expense.subCategoryId, status='3', per-member Tier-2 history for every member, AND updates expense_group.subCategoryId (D-09 dual sources).
- **D-03:** Existing categorizeExpense guard stays; bulkCategorize has no grouped-member guard (grouped members are collapsed out of table, raw ids not selectable).
- **D-04:** "Unisci" entry point is bulk bar only; reuse MergeExpensesDialog; no separate add-member action on group detail page this phase.
- **D-05:** Same shared-subcategory gate as create; uncategorized additions are softened (dialog offers to categorize first), different-subcategory additions rejected.
- **D-06:** Group-to-group merge is rejected.
- **D-07:** Controls on group detail page; each member gets per-member "Rimuovi dal gruppo"; page gets "Scomponi gruppo". No bulk-bar "Scomponi" this phase.
- **D-08:** Per-member deletes (expenseGroupMembership row only) → member becomes standalone; single-member group auto-dissolves (last membership + group row deleted); whole-group dissolve deletes all memberships + group row. All mutations in single db.transaction.
- **D-09:** Dissolution is structural — nothing reverted. Freed members keep current category (recategorized if the group was). No pre-merge subcategory stored/restored.
- **D-10:** GRP-09 is a testable requirement — automated integration test snapshots dashboard aggregates (effectiveAmount sums by direction/nature/category) before/after merge → recategorize → dissolve; asserts merge leaves aggregates byte-identical, dissolve leaves them byte-identical to pre-dissolve, recategorize's delta is identical to individual recategorization.

### Claude's Discretion
- Dialog wording/reuse details for add-to-group (D-04 mechanism choice per planner).
- Group-recategorize action as brand-new `categorizeExpenseGroup` or parameterized reuse (D-02 invariants are the contract).
- Confirmation-dialog Italian copy for dissolve/remove.

### Deferred Ideas
- Group-to-group merge (D-06 explicitly rejected).
- "Scomponi" in expenses-table bulk bar (deferred to future phase).
- Add-member picker on group detail page (D-04 scopes to bulk bar only).
- Import-time similarity hints / auto-merge (GRP-F01, deferred forever per ADR 0017).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GRP-05 | User can recategorize the group and new subcategory propagates to all members. | D-02 (bulkCategorize pattern), D-03 (guard), writeClassificationHistory precedent, expense_group.subCategoryId dual-source update |
| GRP-06 | User can add a later expense to an existing group (Unisci), same subcategory gate. | D-04 (bulk bar entry), D-05 (soft categorization + shared subcategory gate), mergeExpenses pattern reuse |
| GRP-07 | User can remove a member or dissolve; auto-dissolve at one member; restoration is structural. | D-07 (group detail controls), D-08 (explicit deletes inside db.transaction), D-09 (structural semantics) |
| GRP-09 | Dashboard totals and category breakdowns provably unchanged by merge/dissolve (structural invariant). | D-10 (automated integration test), effectiveAmount() SQL sums, Vitest DAL test pattern, snapshot-based assertions |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Group recategorization | API / Backend | Frontend (read-side) | All writes (expense.subCategoryId, status, history, expense_group.subCategoryId) are backend; frontend shows propagated category at read time |
| Add member to group | API / Backend | Frontend (bulk bar) | Add-to-group validation (shared subcategory, membership uniqueness) and membership insert are backend; bulk bar triggers via MergeExpensesDialog reuse |
| Remove single member | API / Backend | Frontend (group detail) | Membership deletion and optional group auto-deletion are backend; detail page UI triggers removal action |
| Dissolve group | API / Backend | Frontend (group detail) | All membership + group deletes are backend; detail page "Scomponi gruppo" button triggers |
| GRP-09 invariance proof | Data Layer (DAL) | Test framework | DAL aggregation (effectiveAmount sums) is the surface being tested; Vitest integration test drives merge → recategorize → dissolve and snapshots outputs |

## Standard Stack

### Core Reusable Assets (verified against lib code)

| Asset | Location | Purpose | Notes |
|-------|----------|---------|-------|
| `createExpenseGroup` | `lib/services/expense-group.ts` | Pure regrouping: inserts group + memberships only, never touches expense.subCategoryId | Accepts `DbOrTx`; caller owns transaction boundary |
| `renameExpenseGroup` | `lib/services/expense-group.ts` | Rename an owned group | Accepts `DbOrTx`; IDOR-scoped to userId + groupId |
| `bulkCategorize` | `lib/actions/expenses.ts` L212-301 | Per-id subcategory+status+history writes; no guard for grouped members | Template for group-recategorize action (D-02) |
| `categorizeExpense` | `lib/actions/expenses.ts` L327-340 | Single-expense categorize with guard | Pre-transaction expenseGroupMembership check blocks categorizing grouped members |
| `mergeExpenses` | `lib/actions/expenses.ts` L438-506 | Create a new group from selected expenses | Template for add-to-group action (D-04); validates shared non-null subcategory, calls createExpenseGroup |
| `writeClassificationHistory` | `lib/dal/classification-history` | Per-member Tier-2 writes | Used in bulkCategorize and group-recategorize (D-02) |
| `MergeExpensesDialog` | `components/expenses/merge-expenses-dialog.tsx` | Merge flow with step logic exported as pure functions | Reusable for both create-group (Phase 65) and add-to-group (Phase 66, D-04) |
| `SubcategoryPicker` | `components/` (vaul bottom sheet) | Single subCategoryId capture, 7 existing surfaces | For editable group subcategory (D-01); reuse, do not build new picker |
| `expenseGroup` table | `lib/db/schema.ts` L478-499 | Group row: id, userId (cascade), title, subCategoryId (nullable, set-null), createdAt, updatedAt | Has userId_idx and subCategoryId_idx |
| `expenseGroupMembership` table | `lib/db/schema.ts` L504-522 | Junction: id, groupId (cascade), expenseId (cascade), createdAt | Both unique(groupId, expenseId) AND standalone unique(expenseId) enforce one-group-per-expense |
| `composeExpenseRows` | `lib/dal/expenses.ts` L175-233 | Read-time group composition; uses first member's subCategoryId + aggregated totals | Comment confirms subCategoryId identical to dedicated group column (D-09) |
| `getExpenseGroupForDetail` | `lib/dal/expenses.ts` L643-729 | Detail page load; reads expenseGroup.subCategoryId joined; fetches members + transactions | Returns ExpenseGroupDetailRow with subCategoryId from expenseGroup table (dual source D-02) |
| `effectiveAmount()` | `lib/dal/transaction-pairs-sql.ts` L38-52 | SQL function: sum of transaction amounts for a pair (or single if unpaired) | Used in dashboard aggregations; GRP-09 test snapshotted surface |

### Established Patterns

| Pattern | Example | When Applied |
|---------|---------|--------------|
| DbOrTx convention | `createExpenseGroup(dbOrTx, ...)` accept `DbOrTx`; caller owns transaction | Service functions that write but don't own transaction boundary |
| IDOR scoping | `eq(expense.userId, userId)` in WHERE clause before any update/delete | Every mutation must scope to `userId` |
| db.transaction boundary | `await db.transaction(async (tx) => { ... })` in actions | Group lifecycle ops (recategorize, remove, dissolve) all run inside one transaction |
| Decimal.js for money | `toDecimal(m.totalAmount).plus(...)` → `toDbDecimal(result)` | Aggregate calculations in DAL |
| JSON.parse guard | Try/catch in bulkCategorize (WR-04) before Zod parse | Protect against tampered FormData payloads in actions |
| Status field semantics | status='3' = categorized, status='4' = ignored, status='1' = uncategorized | Recategorization writes status='3'; ignore check in mergeExpenses (WR-05) prevents merging ignored expenses |
| Per-member history | `writeClassificationHistory(tx, { ...fromSubCategoryId, toSubCategoryId, source: 'manual' })` for each member | D-02 requirement: keep every member's Tier 2 learning |
| Classification history non-fatal | Promise.all with individual try/catch in bulkCategorize L277-293 | History loss is acceptable vs failed bulk action |
| Test mocking | Vitest with `vi.mock()` of schema, db, auth for DAL tests | Node-only integration tests (no jsdom) |

## Architecture Patterns

### Group Lifecycle Pattern

**Entry points:**
1. **Recategorize (GRP-05):** Triggered from group detail page (editable subcategory via SubcategoryPicker) or expenses-table group row (via categorize action).
2. **Add member (GRP-06):** Triggered from bulk bar when selection = [one group row + N ungrouped expenses]; reuses MergeExpensesDialog.
3. **Remove/dissolve (GRP-07):** Triggered from group detail page; per-member "Rimuovi dal gruppo" (single removal) or "Scomponi gruppo" (dissolve all).

**Atomic transaction pattern (D-08):**
```
await db.transaction(async (tx) => {
  // For recategorize: update all members' subCategoryId + status + write history
  // For remove single: delete one membership row; if count==1, delete group row too
  // For dissolve: delete all membership rows + group row
})
```

**Dual subcategory sources (D-02, D-09):**
- **composeExpenseRows:** First member's expense.subCategoryId (line 220)
- **getExpenseGroupForDetail:** expenseGroup.subCategoryId (line 655/717)
Both must be kept in sync during recategorization. Comment in composeExpenseRows (L217-219) confirms they resolve identically.

### Group Recategorization Pattern (Model on bulkCategorize)

1. **Input validation:** Parse ids array, validate subCategoryId is visible to user.
2. **IDOR guard:** Load before-state (subCategoryId, status) for all ids owned by userId.
3. **Single transaction:**
   - Update all members: subCategoryId, status='3', updatedAt
   - Update group row: subCategoryId (D-09)
   - Write per-member history rows (non-fatal)
4. **Revalidate:** Call revalidateCategorizationSurfaces() (same as bulkCategorize).

**Key difference from categorizeExpense:** No guard against grouped members needed (the action is itself the group path). Group-recategorize action is IDOR-scoped to userId + group ownership.

### Add-to-Group Pattern (Model on mergeExpenses)

1. **Selection logic (expenses-table):** Recognize selection = [one group row + N ungrouped].
2. **Soft categorization (MergeExpensesDialog):** If uncategorized additions selected, dialog offers to categorize them to the group's subcategory first (explicit Tier-2-visible act).
3. **Validation:** All additions must resolve to the group's subcategory (same gate as create-merge).
4. **Membership insert:** Inside db.transaction, insert membership rows for each addition. Catch 23505 (race: another request grouped one of these) and translate to Italian message (same as mergeExpenses L93-96).

### Remove/Dissolve Pattern

1. **Per-member remove:** Delete one expenseGroupMembership row → member becomes ungrouped standalone.
2. **Auto-dissolve:** If removal leaves group with 1 member, also delete the last membership row + the group row.
3. **Dissolve all:** Delete all membership rows + group row in one transaction.
4. **Structural restore:** No pre-merge state is restored. Freed members keep their current category (recategorized if group was recategorized). Pre-merge state is restored by the structural guarantee: grouping never touched members' subCategoryId (D-09).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Group-member subcategory syncing | Custom sync logic or two-phase writes | Atomic db.transaction: update expense rows + update group row in one go | Race conditions between detail and list surfaces; must be byte-identical |
| Membership uniqueness (one-group-per-expense) | Application-level checks only | Database unique(expenseId) constraint on expenseGroupMembership | FK cascade deletes from both sides; app check alone cannot close the race |
| Group totals (amount, count, date range) | Persisted columns on expense_group | Read-time aggregation in composeExpenseRows | Eliminates race on updates; grouping never touches expense rows (GRP-09) |
| Recategorization of grouped members | Custom per-member loop in the action | bulkCategorize pattern: single WHERE clause, UPDATE for all, history per-member non-fatally | Ensures atomic consistency; matches existing bulk categorize behavior |
| Pre-merge state restoration | Storing per-member original subCategoryId | Structural guarantee: grouping never touched members (D-09) | Simpler, guaranteed correct by design; dissolution is literal reversal of membership rows only |
| History write error handling | Fail the whole recategorization if history write fails | Non-fatal try/catch per member (precedent: bulkCategorize L277-293) | Tier 2 is informational; historical accuracy is not worth failing a user action |

**Key insight:** The expense group model eliminates mutations to transaction and expense rows during grouping/dissolution. This is not an optimization — it is the structural foundation of GRP-09's invariance guarantee.

## Common Pitfalls

### Pitfall 1: Forgetting to Update expense_group.subCategoryId

**What goes wrong:** You update all members' expense.subCategoryId but forget to update expense_group.subCategoryId during recategorization. The detail page (getExpenseGroupForDetail) and list row (composeExpenseRows) show different categories.

**Why it happens:** Two data sources for one fact (D-02); easy to miss one if you're not thinking of them as a pair.

**How to avoid:** During recategorization, always update both in the same transaction. Add a test that loads the group detail AND the list row and asserts both show the same subCategoryId.

**Warning signs:** Detail page and list row display different categories; test failures in GRP-09 invariance test showing they diverged.

### Pitfall 2: Grouped Members Accidentally Bypassing categorizeExpense Guard

**What goes wrong:** A grouped member's id somehow reaches bulkCategorize, which has no guard and updates it. You've now moved a categorization outside the group control path (violating D-03).

**Why it happens:** The expenses table is supposed to collapse grouped members out of the raw id list (D-03 assumption). If that collapse is skipped or broken, raw ids reach actions.

**How to avoid:** (a) Verify in the planner that the table's selection logic excludes grouped-member ids; (b) Test that bulkCategorize's validation does not reject grouped ids (it shouldn't — the guard belongs in categorizeExpense). (c) Confirm categorizeExpense's expenseGroupMembership check still fires (L327-340).

**Warning signs:** A test shows a grouped member was categorized via bulk, or the expense-table code lost the collapse-before-pagination step (65-03 decision precedent).

### Pitfall 3: Single-Member Group Not Auto-Dissolving

**What goes wrong:** You remove the last non-last member, leaving one member in the group. You delete only the membership row but forget to delete the now-singleton group row. The member is ungrouped in the DB but is still orphaned under a group with zero members.

**Why it happens:** Auto-dissolve (D-08 requirement) is conditional: "if count==1, also delete group row". Easy to forget the conditional.

**How to avoid:** Query the membership count BEFORE deletion; if count==2 and you're deleting one, you know you'll hit the auto-dissolve case. Test the boundary: group with 2 members, remove one, assert group row is deleted AND the remaining member is ungrouped (no membership row).

**Warning signs:** A test or user flow leaves an empty or single-member group row in the DB.

### Pitfall 4: History Write Failure Failing the Whole Group Recategorization

**What goes wrong:** You make history write fatal (throw if it fails). An external issue (disk full, service unavailable) causes one member's history write to fail, and you reject the entire group recategorization.

**Why it happens:** It's tempting to treat history as a critical record. But Sparter's design accepts history loss (ADV-02, precedent in bulkCategorize L291).

**How to avoid:** Wrap each member's writeClassificationHistory in try/catch and log/silently accept failures (match bulkCategorize pattern L277-293).

**Warning signs:** A test fails because mock history write throws; user flow breaks on a history service error.

### Pitfall 5: Dissolving a Group Without Checking Ownership

**What goes wrong:** You load the group row, check it exists, but don't verify it's owned by userId before deleting membership + group rows. User A deletes user B's group.

**Why it happens:** Existing code deletes on FK cascade (which doesn't auth); easy to think you've scoped correctly when you've only half-scoped.

**How to avoid:** Every delete must include WHERE userId=currentUserId (for the group row) in the delete statement itself. Don't rely on an earlier query's ownership check — include the IDOR guard in the DELETE/WHERE clause (pattern: bulkCategorize L268-270).

**Warning signs:** A security test that deletes another user's group succeeds; group row is found but doesn't have a userId column in the DELETE WHERE.

## Code Examples

### Group Recategorization Pattern

Modeled on `bulkCategorize` (lib/actions/expenses.ts L212-301):

```typescript
// Source: bulkCategorize (L212-301) + categorizeExpense (L327-340) + writeClassificationHistory
export async function categorizeExpenseGroup(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  // 1. Parse input with JSON guard (WR-04)
  let groupId: unknown
  try {
    groupId = JSON.parse((formData.get('groupId') as string) ?? 'null')
  } catch {
    return { error: 'Gruppo non valido.' }
  }

  const parsed = CategorizeExpenseGroupSchema.safeParse({
    groupId,
    subCategoryId: Number(formData.get('subCategoryId')),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  // 2. IDOR guard: verify session + group ownership
  const { userId } = await verifySession()
  const subCategoryVisible = await isSubCategoryVisibleToUser(parsed.data.subCategoryId, userId)
  if (!subCategoryVisible) {
    return { error: 'Sottocategoria non valida.' }
  }

  // 3. Atomic transaction: update all members + group row + write history
  try {
    await db.transaction(async (tx) => {
      // 3a. Verify group ownership (IDOR)
      const [group] = await tx
        .select({ id: expenseGroup.id })
        .from(expenseGroup)
        .where(and(eq(expenseGroup.id, parsed.data.groupId), eq(expenseGroup.userId, userId)))
      if (!group) {
        throw new Error('Gruppo non trovato.')
      }

      // 3b. Load member ids and before-state for history
      const members = await tx
        .select({
          id: expense.id,
          subCategoryId: expense.subCategoryId,
          status: expense.status,
        })
        .from(expenseGroupMembership)
        .innerJoin(expense, eq(expense.id, expenseGroupMembership.expenseId))
        .where(
          and(
            eq(expenseGroupMembership.groupId, parsed.data.groupId),
            eq(expense.userId, userId),
          ),
        )

      const memberById = new Map(members.map((m) => [m.id, m]))

      // 3c. Update all members' subcategory + status (D-02)
      const updated = await tx
        .update(expense)
        .set({
          subCategoryId: parsed.data.subCategoryId,
          status: '3',
          updatedAt: new Date(),
        })
        .where(
          and(
            inArray(expense.id, members.map((m) => m.id)),
            eq(expense.userId, userId),
          ),
        )
        .returning({ id: expense.id })

      // 3d. Update group row's subCategoryId (D-09 dual source)
      await tx
        .update(expenseGroup)
        .set({
          subCategoryId: parsed.data.subCategoryId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(expenseGroup.id, parsed.data.groupId),
            eq(expenseGroup.userId, userId),
          ),
        )

      // 3e. Write per-member history (non-fatal, D-02)
      await Promise.all(
        updated.map(async (row) => {
          const before = memberById.get(row.id)
          try {
            await writeClassificationHistory(tx, {
              userId,
              expenseId: row.id,
              fromSubCategoryId: before?.subCategoryId ?? null,
              toSubCategoryId: parsed.data.subCategoryId,
              fromStatus: before?.status ?? null,
              toStatus: '3',
              source: 'manual',
            })
          } catch {
            // history write failure is non-fatal
          }
        }),
      )
    })
  } catch (err) {
    if (err instanceof Error) return { error: err.message }
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }

  revalidateCategorizationSurfaces()
  return { error: null }
}
```

### Remove Single Member with Auto-Dissolve

```typescript
// Source: D-08 (explicit deletes inside db.transaction)
export async function removeExpenseFromGroup(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = RemoveExpenseFromGroupSchema.safeParse({
    groupId: Number(formData.get('groupId')),
    expenseId: formData.get('expenseId'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { userId } = await verifySession()

  try {
    await db.transaction(async (tx) => {
      // 1. Verify ownership: group AND expense belong to userId
      const [group] = await tx
        .select({ id: expenseGroup.id })
        .from(expenseGroup)
        .where(and(eq(expenseGroup.id, parsed.data.groupId), eq(expenseGroup.userId, userId)))
      if (!group) {
        throw new Error('Gruppo non trovato.')
      }

      const [exp] = await tx
        .select({ id: expense.id })
        .from(expense)
        .where(and(eq(expense.id, parsed.data.expenseId), eq(expense.userId, userId)))
      if (!exp) {
        throw new Error('Spesa non trovata.')
      }

      // 2. Count remaining members BEFORE deletion
      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(expenseGroupMembership)
        .where(eq(expenseGroupMembership.groupId, parsed.data.groupId))

      // 3. Delete the membership row
      await tx
        .delete(expenseGroupMembership)
        .where(
          and(
            eq(expenseGroupMembership.groupId, parsed.data.groupId),
            eq(expenseGroupMembership.expenseId, parsed.data.expenseId),
          ),
        )

      // 4. Auto-dissolve: if count was 2 (one will remain), also delete group
      if (count === 2) {
        await tx.delete(expenseGroup).where(eq(expenseGroup.id, parsed.data.groupId))
      }
    })
  } catch (err) {
    if (err instanceof Error) return { error: err.message }
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }

  revalidateCategorizationSurfaces()
  return { error: null }
}
```

## Validation Architecture

**Nyquist validation is enabled for this project.** Phase 66's test substrate is the acceptance gate for GRP-09.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest + Node.js (no jsdom / DOM simulation) |
| Config file | `vitest.config.ts` |
| Quick run command | `vitest tests/expense-group-invariance.test.ts --run` (GRP-09 test) |
| Full suite command | `vitest --run` (all tests) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GRP-05 | Group recategorize propagates to all members' subCategoryId + status + writes per-member history; expense_group.subCategoryId also updated | Integration | `vitest tests/expense-group-invariance.test.ts --run` (recategorize substep) | ❌ Wave 0 |
| GRP-06 | Add expense to existing group validates shared subcategory, inserts membership row | Integration | `vitest tests/expense-group-invariance.test.ts --run` (add-to-group substep) | ❌ Wave 0 |
| GRP-07 | Remove single member → standalone; dissolve all → all standalone; auto-dissolve at one member | Unit + Integration | `vitest tests/expense-group-invariance.test.ts --run` (remove/dissolve substesp) | ❌ Wave 0 |
| GRP-09 | Merge + recategorize + dissolve cycle leaves all dashboard aggregates (effectiveAmount sums by direction/nature/category) byte-identical to pre-merge state (invariance proof) | Integration | `vitest tests/expense-group-invariance.test.ts --run` | ❌ Wave 0 |

### GRP-09 Invariance Test Substrate

**The test corpus for GRP-09:**

A single comprehensive integration test (`tests/expense-group-invariance.test.ts`, not yet written) that:

1. **Setup:** Seed a fixture with N uncategorized expenses from a real import, all mapped to the same platform/description-variant.
2. **Phase 1: Categorize-then-group.** Categorize all N to subcategoryId=42 (e.g. Spese Varie → Varie), then group them. Record dashboard aggregate snapshot (effectiveAmount sums by direction/nature/category) at T0.
3. **Phase 2: Recategorize the group.** Change the group's subcategory to subcategoryId=99 (e.g. Cibo → Ristoranti). Record snapshot at T1.
4. **Assertion A:** `snapshot(T0) !== snapshot(T1)` — recategorization SHOULD move the category total.
5. **Assertion B:** `snapshot(T1) === snapshotOfIndividualRecategorization(T0 → T1)` — the group's delta is identical to recategorizing the same N expenses individually (grouping adds no hidden movement).
6. **Phase 3: Dissolve the group.** Remove the group. Record snapshot at T2.
7. **Assertion C:** `snapshot(T2) === snapshot(T1)` — dissolution leaves dashboard aggregates byte-identical to pre-dissolution (D-09 structural guarantee).

**Rationale for assertions:**
- **A:** Proves recategorization is observable in the dashboard (not a no-op).
- **B:** Proves grouping is transparent: a group's recategorization has the same effect as individual recategorizations (no hidden multi-row or hidden-category movement from grouping itself).
- **C:** Proves dissolution is truly structural: no rows touched, no state lost, exact pre-merge behavior restored.

**Aggregates to snapshot:**

From `lib/dal/dashboard.ts`:
- `totalIn`, `totalOut`, `totalAllocation` (per direction)
- `savingsRate`, `uncategorizedCount`
- Breakdown by category: for each category, list of subcategories with per-subcategory amount
- Full list of category+nature totals (the sources that feed the KPI cards)

**Test infrastructure (existing patterns):**

- Seed fixture: Create real users, transactions, expenses via `db.insert(...).values(...)` inside a test setup function (see `tests/seed-extras-steps.test.ts` pattern).
- DAL queries: Call `getOverviewData(userId, { from, to })` (or the individual breakdown builders) to fetch aggregates at each phase.
- Snapshot assertions: `expect(snapshot).toEqual(expected)` (Vitest has built-in snapshot support; consider using JSON.stringify for exact byte-for-byte matching to rule out numeric rounding).

**Test will verify (per D-10):**

Execution of this test is the acceptance gate for GRP-09. If it passes, all three invariants hold. If it fails, the planner must determine which invariant is violated and which code change (group recategorization or removal/dissolve logic) caused the regression.

### Wave 0 Gaps

- [ ] `tests/expense-group-invariance.test.ts` — GRP-09 acceptance test (merge → recategorize → dissolve invariance)
- [ ] `categorizeExpenseGroup` action (or parameterized variant per D-02 contract) — service function for group recategorization
- [ ] `removeExpenseFromGroup` action (or variant per D-08 contract) — service function for removal + auto-dissolve
- [ ] `dissolveExpenseGroup` action — full group dissolution
- [ ] Integration of group-recategorize and remove/dissolve actions into `components/expenses/group-detail-client.tsx` (editable subcategory via SubcategoryPicker, member removal buttons)
- [ ] Extension of expenses-table bulk-bar logic to recognize group-row selections and route "Unisci" to add-to-group (D-04)
- [ ] Validation schema updates (CategorizeExpenseGroupSchema, RemoveExpenseFromGroupSchema, etc.)
- [ ] Italian localization for confirmation dialogs and action buttons (Rimuovi dal gruppo, Scomponi gruppo per member/whole group)

*(No framework install needed — all Vitest and dependencies already present)*

## Common Concerns

### What About Grouped Member History Visibility?

**Question:** If a grouped member's category changed before or after joining the group, does the user see the full history or just the group history?

**Answer:** The group UI (group detail page, member list within the group) shows only the group's current category. Individual member history is not exposed in the group context. A user wanting to see a member's pre-group history must navigate to the member's individual expense detail page (`/expenses/[id]`). This is acceptable because:
- The group is the categorization unit while grouped (D-03, D-05).
- Dissolution frees the member; they can then be edited independently, and their full history (including pre-group) is available again.
- Grouping never hides history data — the rows are still in the DB.

### Can a Grouped Expense Be Detached to a Standalone Expense?

**Question:** ADR 0016 defines standalone expenses (synthetic hash). Can a user detach a single transaction from a grouped member?

**Answer:** Per ADR 0017 §5: "A Standalone Expense may join a group without special-casing. Detaching a transaction from a grouped member follows normal rules: a new standalone expense is born outside the group; the in-place single-transaction re-hash keeps the member — now synthetic-hashed — inside its group."

This is a future operation (not part of Phase 66). When implemented, the group membership row stays; the member expense's descriptionHash changes to synthetic; the detached transaction now has a new standalone expense id. The group's member count doesn't change; the member's `descriptionHash` becomes synthetic, which is allowed because grouping is orthogonal to hash aggregation.

### What If All Members Are Removed Individually?

**Question:** If a user removes all N members one-by-one, and each removal triggers auto-dissolve, do all N operations succeed or does the second removal fail (group already deleted)?

**Answer:** Safe — the second removal will fail with "Gruppo non trovato" because the first removal's auto-dissolve deleted it. This is acceptable:
- Phase 66's UI (group detail page) shows a live member list; after first removal, the page would re-render and show N-1 members.
- If the user removes another member, it succeeds and auto-dissolves (same as the first).
- If the user removes the last member, it succeeds and deletes the group row explicitly.
- If the user tries to remove after the group is gone (stale UI), they get a clear error message.

No additional logic needed.

## Environment Availability

All runtime dependencies are already present. The phase adds no new external tools.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Tests, build | ✓ | 20.x | — |
| Vitest | GRP-09 integration test | ✓ | v1.x | — |
| TypeScript | Build, type checking | ✓ | v5.x | — |
| Drizzle ORM | DAL queries, schema, migrations | ✓ | v0.31.x | — |
| PostgreSQL | Database (tests use test DB) | ✓ | 15.x | — |
| Decimal.js | Monetary aggregation (GRP-09 snapshots) | ✓ | v10.x | — |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | bulkCategorize has no guard for grouped members (only categorizeExpense guards); grouped members are collapsed out of the table so raw ids don't reach bulkCategorize directly. | D-03 Verification | If grouped member ids reach bulkCategorize, they would be recategorized outside the group control path, violating the "group is categorization unit" invariant. Risk: MEDIUM (assumption is code-verified but depends on table collapse logic being correct). |
| A2 | expenseGroupMembership rows are currently deleted only via FK cascade on group deletion; no explicit delete logic exists today. Phase 66 introduces explicit deletes. | D-08 Verification | If explicit delete logic already exists and is incompatible, refactoring is needed. Risk: LOW (verified via grep; no existing deletes found). |
| A3 | effectiveAmount() SQL function correctly sums paired transaction amounts (or single amount if unpaired) and is the sole source of dashboard aggregates. | GRP-09 Test Substrate | If dashboard uses other aggregate sources (e.g. expense.totalAmount), GRP-09's invariance test would not actually prove structural invariance. Risk: LOW (CONTEXT.md cites lib/dal/dashboard.ts and confirms this). |
| A4 | Vitest node-only test environment (no jsdom / DOM simulation) is suitable for GRP-09 integration test. | Validation Architecture | If GRP-09 requires browser-side logic verification, node-only tests would miss it. Risk: LOW (D-10 explicitly says "node-only Vitest, assert on DAL aggregate outputs, not rendered UI"). |
| A5 | MergeExpensesDialog's exported pure functions (isGroupTitleValid, nextStepAfterTitle, getUncategorizedIds, runCategorizeStep, runMergeStep) can be reused or extended for add-to-group flow without major refactoring. | D-04 Architecture Pattern | If the dialog is tightly coupled to create-group flow, add-to-group would require a separate dialog. Risk: LOW (CONTEXT.md confirms these are exported as pure functions for direct unit testing). |

**All claims verified or low-risk. No user confirmation gates needed before planning.**

## Open Questions

None. The CONTEXT.md locked decisions and code-verified patterns are sufficient for planning.

## Sources

### Primary (HIGH confidence)
- **Code verification (lib files):** Lines confirmed against live codebase (2026-07-19):
  - `lib/db/schema.ts:478-522` — expense_group + expenseGroupMembership tables
  - `lib/actions/expenses.ts:212-301` — bulkCategorize pattern
  - `lib/actions/expenses.ts:327-340` — categorizeExpense guard
  - `lib/actions/expenses.ts:438-506` — mergeExpenses pattern
  - `lib/services/expense-group.ts:50-129` — createExpenseGroup + renameExpenseGroup
  - `lib/dal/expenses.ts:175-233` — composeExpenseRows (first member subCategoryId)
  - `lib/dal/expenses.ts:643-729` — getExpenseGroupForDetail (group row subCategoryId)
  - `lib/dal/transaction-pairs-sql.ts:38-52` — effectiveAmount SQL
- **Project docs (ADRs):**
  - `docs/adr/0017-expense-group-over-physical-merge.md` — locked group model
  - `docs/adr/0016-shared-costs-net-by-subcategory-inflows-isolated-per-transaction.md` — standalone expense mechanics
- **Phase context:**
  - `.planning/phases/66-expense-group-lifecycle/66-CONTEXT.md` — locked decisions D-01 through D-10
  - `.planning/REQUIREMENTS.md` — GRP-05/06/07/09 definitions
  - `.planning/STATE.md` — v2.6 milestone contract

### Secondary (MEDIUM confidence)
- **Test infrastructure pattern:**
  - `tests/expense-group-dal.test.ts` — existing Vitest mock pattern for DAL tests
  - `tests/dashboard-dal.test.ts` — dashboard aggregation test pattern
  - `vitest.config.ts` — confirmed Vitest is the test framework

### Tertiary (training knowledge)
- General Vitest snapshot assertions and integration test patterns (standard)
- Drizzle ORM transaction API (standard pattern from project)

---

**Confidence Summary:**

| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | All libraries and code patterns verified against live codebase |
| Architecture | HIGH | ADR 0017 locked; D-02 dual subcategory sources verified; D-09 structural semantics confirmed |
| Pitfalls | HIGH | Common mutation/ownership mistakes identified from codebase patterns (bulkCategorize, categorizeExpense, schema) |
| GRP-09 Test Substrate | HIGH | effectiveAmount function verified; Vitest pattern established; test shape matches D-10 contract |
| Validation Strategy | HIGH | Nyquist enabled; DAL-focused integration test with snapshot assertions maps to 4 requirements |

---

**Research Date:** 2026-07-19  
**Valid Until:** 2026-07-26 (expense group and dashboard logic are stable; recategorization pattern is standard; 7-day validity acceptable)
