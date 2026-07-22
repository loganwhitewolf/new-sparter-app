# Phase 66: expense-group-lifecycle - Pattern Map

**Mapped:** 2026-07-19
**Files analyzed:** 8 (1 new test, 7 existing files to extend)
**Analogs found:** 7 / 7 (100% coverage)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/services/expense-group.ts` | service | CRUD | self (existing) | exact |
| `lib/actions/expenses.ts` (new actions) | action | request-response | self (bulkCategorize + mergeExpenses) | exact |
| `lib/validations/expense.ts` (new schemas) | validation | request-response | self (BulkCategorizeSchema) | exact |
| `components/expenses/group-detail-client.tsx` (extend) | component | request-response | self (existing) | exact |
| `components/expenses/expense-table.tsx` (extend) | component | request-response | self (mergeEligible logic) | exact |
| `components/expenses/bulk-action-bar.tsx` (no change) | component | request-response | self (onBulkMerge callback) | exact |
| `components/expenses/merge-expenses-dialog.tsx` (extend) | component | request-response | self (pure export functions) | exact |
| `tests/expense-group-invariance.test.ts` | test | integration | expense-group-dal.test.ts + dashboard-dal.test.ts | role-match |

---

## Pattern Assignments

### `lib/services/expense-group.ts` (service, CRUD)

**Analog:** `lib/services/expense-group.ts` (existing, lines 1-130)

**DbOrTx convention pattern** (lines 1-6, 26-31, 50):
```typescript
import type { DbOrTx } from '@/lib/db'
import { expense, expenseGroup, expenseGroupMembership } from '@/lib/db/schema'

export type CreateExpenseGroupInput = {
  userId: string
  selectedExpenseIds: string[]
  groupTitle: string
  subCategoryId: number
}

export async function createExpenseGroup(
  dbOrTx: DbOrTx,
  input: CreateExpenseGroupInput,
): Promise<CreateExpenseGroupResult> {
```

**IDOR guard pattern — before any mutation** (lines 56-65):
```typescript
const ownedRows = await dbOrTx
  .select({ id: expense.id })
  .from(expense)
  .where(and(eq(expense.userId, userId), inArray(expense.id, selectedExpenseIds)))

if (ownedRows.length < selectedExpenseIds.length) {
  throw new Error('Spesa non trovata o non tua.')
}
```

**Error handling for 23505 unique violation** (lines 89-98):
```typescript
try {
  await dbOrTx
    .insert(expenseGroupMembership)
    .values(selectedExpenseIds.map((expenseId) => ({ groupId, expenseId })))
} catch (e) {
  if (errorCauseCode(e) === '23505') {
    throw new Error('Una spesa selezionata fa già parte di un gruppo.')
  }
  throw e
}
```

**Template for new functions to add:**
- `removeExpenseFromGroupMember(dbOrTx, input)` — delete single membership row, check count for auto-dissolve
- `dissolveExpenseGroup(dbOrTx, input)` — delete all membership + group row
- `recategorizeExpenseGroup(dbOrTx, input)` — update member subcategories + group row (see action pattern below for full transaction context)

---

### `lib/actions/expenses.ts` — New Group Actions

**Analog 1: bulkCategorize pattern** (lines 212-301)

**JSON guard + parse + IDOR chain** (lines 220-240):
```typescript
export async function bulkCategorize(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  // WR-04: JSON.parse guard
  let ids: unknown
  try {
    ids = JSON.parse((formData.get('ids') as string) ?? '[]')
  } catch {
    return { error: 'Selezione non valida.' }
  }

  const parsed = BulkCategorizeSchema.safeParse({
    ids,
    subCategoryId: Number(formData.get('subCategoryId')),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { userId } = await verifySession()
  const subCategoryVisible = await isSubCategoryVisibleToUser(
    parsed.data.subCategoryId,
    userId
  )
  if (!subCategoryVisible) {
    return { error: 'Sottocategoria non valida.' }
  }
```

**Per-id history with non-fatal catch** (lines 277-293):
```typescript
// Write classification history rows for manual categorization (ADV-02).
// Non-fatal per row: history loss is acceptable vs a failed bulk-categorize action.
await Promise.all(
  updated.map(async (row) => {
    const before = beforeById.get(row.id)
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
```

**Analog 2: categorizeExpense guard pattern** (lines 327-340)

**Pre-transaction grouped-member check** (lines 320-340):
```typescript
// D-03 defense-in-depth (WR-02): a grouped expense's category is set at the group
// level (Phase 66) — recategorizing a member directly here would silently diverge
// it from its group. Reject before starting the transaction; nothing is written.
const groupMembership = await db
  .select({ id: expenseGroupMembership.id })
  .from(expenseGroupMembership)
  .innerJoin(expense, eq(expense.id, expenseGroupMembership.expenseId))
  .where(
    and(
      eq(expenseGroupMembership.expenseId, parsed.data.id),
      eq(expense.userId, userId),
    ),
  )
  .limit(1)
if (groupMembership.length > 0) {
  return { error: 'Questa spesa fa parte di un gruppo: categorizza dal gruppo.' }
}
```

**Analog 3: mergeExpenses pattern** (lines 438-506)

**Shared subcategory gate + ignored member check** (lines 471-488):
```typescript
if (rows.some((row) => row.subCategoryId === null)) {
  throw new Error('Categorizza prima di unire.')
}

// WR-05: reject ignored (status '4') members
if (rows.some((row) => row.status === '4')) {
  throw new Error('Una o più spese selezionate sono ignorate: riattivale prima di unire.')
}

const subCategoryIds = new Set(rows.map((row) => row.subCategoryId))
if (subCategoryIds.size > 1) {
  throw new Error('Le spese devono avere la stessa categoria.')
}

const commonSubCategoryId = rows[0].subCategoryId as number
```

**Template for `categorizeExpenseGroup` action (D-02):**
- Model on bulkCategorize (L212-301) for per-id updates + per-member history
- Add verifySession + isSubCategoryVisibleToUser (same as bulkCategorize)
- Parse schema: `{ groupId: number, subCategoryId: number }`
- IDOR guard: `eq(expenseGroup.userId, userId)` in owner-check query
- Inside transaction:
  1. Load all member expenses (joined from expenseGroupMembership)
  2. Update all member `expense.subCategoryId`, `status='3'`, `updatedAt`
  3. **Update `expense_group.subCategoryId`** (D-09 dual source)
  4. Write per-member history non-fatally (copy pattern from L277-293)
- Call `revalidateCategorizationSurfaces()`

**Template for `removeExpenseFromGroup` and `dissolveExpenseGroup` actions (D-08):**
- Input schema: `{ groupId: number, expenseId?: string }` (expenseId = null for dissolve all)
- IDOR guards: verify group owned by userId AND expense (if single) owned by userId
- Inside transaction:
  1. Count remaining members BEFORE deletion
  2. Delete membership row(s)
  3. If count was 2 (auto-dissolve): also delete group row
- Call `revalidateCategorizationSurfaces()`

---

### `lib/validations/expense.ts` (validation, request-response)

**Analog:** `lib/validations/expense.ts` (existing, lines 26-88)

**BulkCategorizeSchema pattern** (lines 26-29):
```typescript
export const BulkCategorizeSchema = z.object({
  ids: z.array(z.string()).min(1, { error: 'Seleziona almeno una spesa per continuare.' }),
  subCategoryId: z.number().int().positive({ error: 'Seleziona una categoria prima di confermare.' }),
})
```

**Template for `CategorizeExpenseGroupSchema`:**
```typescript
export const CategorizeExpenseGroupSchema = z.object({
  groupId: z.coerce.number().int().positive({ error: 'Gruppo non valido.' }),
  subCategoryId: z.number().int().positive({ error: 'Seleziona una categoria prima di confermare.' }),
})
```

**Template for `RemoveExpenseFromGroupSchema`:**
```typescript
export const RemoveExpenseFromGroupSchema = z.object({
  groupId: z.coerce.number().int().positive({ error: 'Gruppo non valido.' }),
  expenseId: z.string().uuid({ error: 'Spesa non valida.' }),
})

export const DissolveExpenseGroupSchema = z.object({
  groupId: z.coerce.number().int().positive({ error: 'Gruppo non valido.' }),
})
```

---

### `components/expenses/group-detail-client.tsx` (component, request-response)

**Analog:** `components/expenses/group-detail-client.tsx` (existing, lines 58-99)

**Current read-only subcategory section** (lines 68-89):
```typescript
const categoriaSection = (
  <div className="mt-2 flex flex-col gap-1 rounded-md border bg-muted/30 p-4">
    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      Categoria
    </span>
    {group.subCategoryName ? (
      <div className="flex flex-col gap-1">
        <span className="text-base font-semibold">{group.subCategoryName}</span>
        {group.categoryName ? (
          <span className="text-sm text-muted-foreground">{group.categoryName}</span>
        ) : null}
      </div>
    ) : (
      <Badge
        variant="outline"
        className="w-fit border-0 bg-amber-100 text-amber-700 transition-colors"
      >
        Non assegnata
      </Badge>
    )}
  </div>
)
```

**Template to replace with editable SubcategoryPicker (D-01):**
- Wrap `SubcategoryPicker` inside a dialog/sheet (reuse vaul sheet pattern from merge dialog)
- Pass `subCategoryId={group.subCategoryId}` as initial value
- On change: call server action `categorizeExpenseGroup` with `{ groupId, subCategoryId }`
- Toast error/success; `router.refresh()` on success to reload group data

**Template for member row controls (D-07):**
- Add a "Rimuovi dal gruppo" button per member row (inside the members table loop)
- Confirmation dialog: "Rimuovi questa spesa dal gruppo?"
- Call server action: `removeExpenseFromGroup({ groupId, expenseId })`
- Toast result; `router.refresh()` on success

**Template for dissolve control (D-07):**
- Add "Scomponi gruppo" button near the title/header
- Confirmation dialog: "Sciogliere il gruppo? Le spese diventeranno indipendenti."
- Call server action: `dissolveExpenseGroup({ groupId })`
- Navigate to `/expenses` on success (group is gone)

---

### `components/expenses/expense-table.tsx` (component, request-response)

**Analog:** `components/expenses/expense-table.tsx` (lines 99-103, mergeEligible logic)

**Current selection + merge eligibility** (lines 99-103):
```typescript
const selectedRows = loadedExpenses.filter((e) => selectedIds.includes(e.id))
const categorizedSubCatIds = new Set(
  selectedRows.filter((e) => e.subCategoryId !== null).map((e) => e.subCategoryId),
)
const mergeEligible = selectedIds.length >= 2 && categorizedSubCatIds.size <= 1
```

**Template to extend selection logic (D-04, D-06):**
1. Identify group rows in `selectedIds` (prefix `group:${groupId}`)
2. Count group rows and ungrouped rows
3. **Reject group-to-group merge:** if `selectedGroupCount > 1`, set `mergeEligible = false` (D-06)
4. **Allow add-to-group:** if `selectedGroupCount === 1 && selectedUngroupedCount > 0`, enable "Unisci" but route to `addToGroup` action (not create new group)
5. **For group row recategorization (D-01):** detect group row selection and expose categorize action in the row's dropdown menu

**Template for dropdown/actions on group row:**
- Add `SubcategoryPicker` button in group row's dropdown → calls `categorizeExpenseGroup`
- Copy design from existing single-expense categorize in row dropdown

---

### `components/expenses/bulk-action-bar.tsx` (component, request-response)

**Analog:** `components/expenses/bulk-action-bar.tsx` (existing, lines 1-47, already complete)

**Current "Unisci" button** (lines 36-40):
```typescript
{onBulkMerge ? (
  <Button type="button" size="sm" onClick={onBulkMerge}>
    Unisci ({count})
  </Button>
) : null}
```

**No changes needed for Phase 66.** The `onBulkMerge` callback is already wired. The parent component (`ExpenseTable`) will route both create-group and add-to-group flows through this callback (decision point moves to the dialog).

---

### `components/expenses/merge-expenses-dialog.tsx` (component, request-response)

**Analog:** `components/expenses/merge-expenses-dialog.tsx` (existing, lines 1-102)

**Exported pure functions** (lines 33-102):
```typescript
export function isGroupTitleValid(title: string): boolean {
  return title.trim().length >= 2
}

export function getUncategorizedIds(selectedExpenses: MergeSelectedExpense[]): string[] {
  return selectedExpenses
    .filter((expense) => expense.subCategoryId === null)
    .map((expense) => expense.id)
}

export function nextStepAfterTitle(selectedExpenses: MergeSelectedExpense[]): Step {
  return selectedExpenses.some((expense) => expense.subCategoryId === null)
    ? 'categorize'
    : 'confirm'
}

export function getSharedSubCategoryId(selectedExpenses: MergeSelectedExpense[]): number | null {
  const ids = new Set(
    selectedExpenses
      .map((expense) => expense.subCategoryId)
      .filter((id): id is number => id !== null),
  )
  return ids.size === 1 ? [...ids][0] : null
}

export async function runCategorizeStep({ ... }): Promise<{ error: string | null }>
export async function runMergeStep({ ... }): Promise<{ error: string | null }>
```

**Template to extend for add-to-group (D-04, D-05):**
1. Detect selection type: `selectedGroupCount === 1 && selectedUngroupedCount > 0`
2. **If add-to-group mode:** skip title step, go straight to categorize (if uncategorized present) or confirm
3. **Soft categorization (D-05):** If uncategorized additions, offer to categorize them to the group's subcategory before adding
4. Create new `runAddToGroupStep` action:
   - Similar to `runMergeStep`, but calls new server action `addExpensesToGroup`
   - Validates additions share the target group's subcategory
   - Handles 23505 (race condition) like mergeExpenses (L93-96)
5. All existing pure functions remain unchanged; reuse them for add-to-group flow

---

### `tests/expense-group-invariance.test.ts` (test, integration)

**Analog 1: DAL test mock pattern** (`tests/expense-group-dal.test.ts`, lines 1-80)

**Vitest hoisted mocks setup** (lines 1-25):
```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  dbSelectChain: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    cache: (fn: (...args: unknown[]) => unknown) => fn,
  }
})

vi.mock('@/lib/dal/auth', () => ({
  verifySession: vi.fn(),
}))

vi.mock('@/lib/dal/classification-history', () => ({
  writeClassificationHistory: vi.fn(),
}))
```

**Analog 2: Dashboard aggregation test** (`tests/dashboard-dal.test.ts`, lines 1-100)

**Import real utilities, mock dependencies** (lines 1-85):
```typescript
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('react', () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }))
vi.mock('@/lib/dal/auth', () => ({ verifySession: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: {} }))
vi.mock('@/lib/db/schema', () => ({
  // schema mocks...
}))

vi.mock('@/lib/utils/date', async () => {
  const actual = await vi.importActual<typeof import('../lib/utils/date')>('../lib/utils/date')
  return actual
})
vi.mock('@/lib/utils/decimal', async () => {
  const actual = await vi.importActual<typeof import('../lib/utils/decimal')>('../lib/utils/decimal')
  return actual
})

const {
  getOverviewData,
  buildBreakdownData,
  // ... other imports
} = await import('../lib/dal/dashboard')
```

**Template for GRP-09 invariance test structure:**

```typescript
import { describe, expect, it, beforeEach } from 'vitest'
import Decimal from 'decimal.js'

describe('GRP-09: Expense Group Invariance', () => {
  let userId: string
  let expenses: Array<{ id: string; subCategoryId: number | null }>
  let groupId: number

  beforeEach(async () => {
    // 1. Setup: Create user, seed expenses, snapshot dashboard T0
    userId = 'test-user-id'
    // Insert transactions → expenses → group → members in test DB
    
    const snapshotT0 = await takeAggregateSnapshot(userId)
    
    // 2. Phase 1: Group creation + initial categorization
    // Create group, verify aggregate snapshot at T0
    expect(snapshotT0).toMatchSnapshot('before-group')
  })

  it('merge does not move dashboard totals', async () => {
    const snapshotAfterMerge = await takeAggregateSnapshot(userId)
    expect(snapshotAfterMerge).toEqual(snapshotT0)
  })

  it('recategorize moves only the affected category totals', async () => {
    // Apply recategorizeExpenseGroup
    const snapshotT1 = await takeAggregateSnapshot(userId)
    
    // Assertion A: recategorization SHOULD move category total
    expect(snapshotT1).not.toEqual(snapshotT0)
    
    // Assertion B: delta matches individual recategorization
    const snapshotIndividualRecat = await simulateIndividualRecategorization(
      userId,
      expenseIds,
      oldCat,
      newCat,
    )
    expect(snapshotT1).toEqual(snapshotIndividualRecat)
  })

  it('dissolve restores pre-dissolve aggregates', async () => {
    // Apply recategorization, snapshot T1
    const snapshotT1 = await takeAggregateSnapshot(userId)
    
    // Dissolve the group
    await dissolveExpenseGroup(userId, groupId)
    const snapshotT2 = await takeAggregateSnapshot(userId)
    
    // Assertion C: dissolution is structural (no row mutations)
    expect(snapshotT2).toEqual(snapshotT1)
  })
})

async function takeAggregateSnapshot(userId: string) {
  // Call getOverviewData + buildBreakdownData
  // Return object: { totalIn, totalOut, totalAllocation, categories: [...] }
  // Use JSON.stringify for byte-for-byte comparison
}

async function simulateIndividualRecategorization(
  userId: string,
  expenseIds: string[],
  fromSubCat: number,
  toSubCat: number,
): Promise<object> {
  // Fetch expenses, apply individual recategorization, snapshot
}
```

---

## Shared Patterns

### Authentication & Authorization

**Source:** `lib/actions/expenses.ts` (lines 234-239, categorizeExpense)

**IDOR pattern applied to all new actions:**
```typescript
const { userId } = await verifySession()
const subCategoryVisible = await isSubCategoryVisibleToUser(parsed.data.subCategoryId, userId)
if (!subCategoryVisible) {
  return { error: 'Sottocategoria non valida.' }
}
// Then inside transaction: eq(expenseGroup.userId, userId) in WHERE clauses
```

### Error Handling & JSON Guard

**Source:** `lib/actions/expenses.ts` (lines 216-225, bulkCategorize, WR-04)

**Applied to all new actions accepting JSON FormData:**
```typescript
let ids: unknown
try {
  ids = JSON.parse((formData.get('ids') as string) ?? '[]')
} catch {
  return { error: 'Selezione non valida.' }
}

const parsed = SomeSchema.safeParse({ ids, ... })
if (!parsed.success) {
  return { error: parsed.error.issues[0].message }
}
```

### Validation & Server-Side Gates

**Source:** `lib/actions/expenses.ts` (lines 471-488, mergeExpenses)

**Applied to all group operations requiring shared-subcategory or ignored-member checks:**
```typescript
if (rows.some((row) => row.subCategoryId === null)) {
  throw new Error('Categorizza prima di unire.')
}
if (rows.some((row) => row.status === '4')) {
  throw new Error('Una o più spese selezionate sono ignorate.')
}
```

### Revalidation

**Source:** `lib/actions/expenses.ts` (line 299, bulkCategorize)

**Applied to all mutating actions:**
```typescript
revalidateCategorizationSurfaces()
return { error: null }
```

---

## No Analog Found

All files have close analogs in the codebase. Test pattern is inferred from existing DAL + dashboard test patterns.

---

## Metadata

**Analog search scope:** 
- `lib/services/` (expense-group.ts)
- `lib/actions/` (expenses.ts)
- `lib/validations/` (expense.ts)
- `components/expenses/` (group-detail-client.tsx, expense-table.tsx, merge-expenses-dialog.tsx, bulk-action-bar.tsx)
- `tests/` (expense-group-dal.test.ts, dashboard-dal.test.ts)

**Files scanned:** 8 primary analogs

**Pattern extraction date:** 2026-07-19

**High-confidence patterns extracted:**
- DbOrTx + IDOR scoping (100% match from expense-group.ts)
- bulkCategorize template for group recategorization (100% match)
- mergeExpenses template for add-to-group (100% match)
- categorizeExpense guard pattern (100% match)
- Vitest mock structure (95% match — minor schema adjustments needed)
- Dashboard aggregation snapshot pattern (95% match — reuse getOverviewData + buildBreakdownData)

---

*Phase: 66-expense-group-lifecycle*  
*Pattern map generated: 2026-07-19*
