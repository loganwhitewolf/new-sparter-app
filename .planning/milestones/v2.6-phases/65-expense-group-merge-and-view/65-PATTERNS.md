# Phase 65: expense-group-merge-and-view - Pattern Map

**Mapped:** 2026-07-18  
**Files analyzed:** 10 (5 new, 5 modified)  
**Analogs found:** 10 / 10 (100%)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/db/schema.ts` | config/model | CRUD | `lib/db/schema.ts` (expense table) | exact |
| `lib/dal/expenses.ts` | DAL | CRUD | `lib/dal/expenses.ts` (getExpenses) | exact |
| `lib/dal/transactions.ts` | DAL | CRUD | `lib/dal/transactions.ts` (transactionListSelect) | exact |
| `lib/services/expense-group.ts` | service | CRUD | `lib/services/expense-deletion.ts` | role-match |
| `lib/actions/expenses.ts` | action | request-response | `lib/actions/expenses.ts` (bulkCategorize/bulkDelete) | exact |
| `lib/validations/expense.ts` | config | transform | `lib/validations/expense.ts` (BulkCategorizeSchema) | exact |
| `app/(app)/expenses/groups/[groupId]/page.tsx` | component/page | request-response | `app/(app)/expenses/[id]/page.tsx` | exact |
| `components/expenses/bulk-action-bar.tsx` | component | request-response | `components/expenses/bulk-action-bar.tsx` (existing) | exact |
| `components/expenses/merge-expenses-dialog.tsx` | component | request-response | `components/expenses/bulk-categorize-dialog.tsx` | role-match |
| `drizzle/migrations/0026_expense_group.sql` | migration | CRUD | `drizzle/migrations/0020_transaction_pair.sql` | role-match |

---

## Pattern Assignments

### `lib/db/schema.ts` (config/model, CRUD)

**Analog:** `lib/db/schema.ts` — expense and transaction table definitions

**Table definition pattern** (lines 379-414):

```typescript
export const expense = pgTable(
  "expense",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    status: expenseStatusEnum("status").notNull().default("1"),
    subCategoryId: integer("sub_category_id").references(() => subCategory.id, {
      onDelete: "set null",
    }),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).default("0.00").notNull(),
    transactionCount: integer("transaction_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("expense_userId_idx").on(table.userId),
    unique("expense_userId_descriptionHash_unique").on(table.userId, table.descriptionHash),
  ],
);
```

**Relations pattern** (lines 653-668):

```typescript
export const expenseRelations = relations(expense, ({ one, many }) => ({
  user: one(user, {
    fields: [expense.userId],
    references: [user.id],
  }),
  subCategory: one(subCategory, {
    fields: [expense.subCategoryId],
    references: [subCategory.id],
  }),
  transactions: many(transaction),
}));
```

**For expenseGroup table, follow this pattern:**
- Primary key: `id: serial("id").primaryKey()`
- User scoping: `userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" })`
- Title: `title: text("title").notNull()`
- Categorization unit: `subCategoryId: integer("sub_category_id").references(() => subCategory.id)`
- Timestamps: `createdAt` and `updatedAt` with defaults
- Indexes: `userId` for lookups, unique constraint if needed

**For expenseGroupMembership (junction) table:**
- Primary key: `id: serial("id").primaryKey()`
- Foreign keys: `groupId` and `expenseId` with appropriate cascading
- Unique constraint on `(groupId, expenseId)` to prevent duplicate membership
- Index on both `groupId` and `expenseId` for query performance

---

### `lib/dal/expenses.ts` (DAL, CRUD)

**Analog:** `lib/dal/expenses.ts` — getExpenses function (lines 156-261)

**Query structure with JOINs** (lines 225-261):

```typescript
export const getExpenses = cache(async (
  filters: ExpenseFilters = {},
  pagination: ExpensePagination = {},
): Promise<ExpenseRow[]> => {
  const { userId } = await verifySession()
  const limit = pagination.limit ?? EXPENSE_LIST_LIMIT
  const offset = pagination.offset ?? 0

  const conditions: any[] = [eq(expense.userId, userId)]
  
  // ... build conditions from filters ...

  return db
    .select({
      id: expense.id,
      title: expense.title,
      status: expense.status,
      totalAmount: expense.totalAmount,
      transactionCount: expense.transactionCount,
      // ... other fields ...
    })
    .from(expense)
    .leftJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
    .leftJoin(category, eq(subCategory.categoryId, category.id))
    .leftJoin(nature, eq(subCategory.natureId, nature.id))
    .leftJoin(direction, eq(nature.directionId, direction.id))
    // ... additional joins ...
    .where(and(...conditions))
    .orderBy(...buildExpenseOrderBy(filters))
    .limit(limit)
    .offset(offset)
})
```

**MODIFICATIONS to getExpenses:**

Add LEFT JOIN to compose group rows (before WHERE):

```typescript
.leftJoin(
  expenseGroupMembership,
  eq(expense.id, expenseGroupMembership.expenseId)
)
.leftJoin(
  expenseGroup,
  eq(expenseGroupMembership.groupId, expenseGroup.id)
)
```

Add to SELECT clause:

```typescript
groupId: expenseGroupMembership.groupId,
groupTitle: expenseGroup.title,
```

Add GROUP BY clause before ORDER BY to compose one row per group:

```typescript
.groupBy(expenseGroupMembership.groupId, expenseGroup.id, expense.id, /* all other select cols */)
```

**NEW: getExpenseGroupForDetail** — Mirror of getExpenseForDetail pattern:

```typescript
export const getExpenseGroupForDetail = cache(
  async ({
    userId,
    groupId,
  }: {
    userId: string
    groupId: string
  }): Promise<ExpenseGroupDetailRow | undefined> => {
    const rows = await db
      .select({
        id: expenseGroup.id,
        title: expenseGroup.title,
        subCategoryId: expenseGroup.subCategoryId,
        subCategoryName: sql<string | null>`...`,
        categoryName: category.name,
        totalAmount: sql<string>`SUM(ABS(${expense.totalAmount}))`,
        transactionCount: sql<number>`COUNT(${transaction.id})`,
        // ... other fields ...
      })
      .from(expenseGroup)
      .leftJoin(expenseGroupMembership, eq(expenseGroup.id, expenseGroupMembership.groupId))
      .leftJoin(expense, eq(expenseGroupMembership.expenseId, expense.id))
      .leftJoin(transaction, eq(expense.id, transaction.expenseId))
      // ... other joins ...
      .where(and(eq(expenseGroup.userId, userId), eq(expenseGroup.id, groupId)))
      .groupBy(expenseGroup.id, /* ... */)
    
    return rows[0]
  }
)
```

---

### `lib/dal/transactions.ts` (DAL, CRUD)

**Analog:** `lib/dal/transactions.ts` — transactionListSelect pattern (lines 75-98)

**Add group title to transaction query SELECT clause:**

```typescript
export const transactionListSelect = {
  id: transaction.id,
  description: transaction.description,
  customTitle: transaction.customTitle,
  // ... existing fields ...
  
  // NEW: group title (Phase 65)
  groupTitle: expenseGroup.title,
  
  // ... remaining fields ...
}
```

**Add LEFT JOINs to transaction query** (after expense join):

```typescript
.leftJoin(
  expenseGroupMembership,
  eq(expense.id, expenseGroupMembership.expenseId)
)
.leftJoin(
  expenseGroup,
  eq(expenseGroupMembership.groupId, expenseGroup.id)
)
```

**Client-side precedence for transaction title:**

On transaction detail rows, client renders: `customTitle || groupTitle || expenseTitle || description`

---

### `lib/services/expense-group.ts` (service, CRUD)

**Analog:** `lib/services/expense-deletion.ts` (lines 1-71)

**Imports pattern:**

```typescript
import 'server-only'

import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { expense, expenseGroup, expenseGroupMembership } from '@/lib/db/schema'
import type { DbOrTx } from '@/lib/db'
```

**Function signature and return type** (following deletion pattern):

```typescript
export type CreateExpenseGroupResult = {
  groupId: string
}

export async function createExpenseGroup(
  dbOrTx: DbOrTx,
  {
    userId,
    selectedExpenseIds,
    groupTitle,
    subCategoryId,
  }: {
    userId: string
    selectedExpenseIds: string[]
    groupTitle: string
    subCategoryId: number
  },
): Promise<CreateExpenseGroupResult>
```

**Ownership verification pattern** (from deletion.ts lines 26-35):

```typescript
const ownedExpenses = await dbOrTx
  .select({ id: expense.id })
  .from(expense)
  .where(
    and(
      eq(expense.userId, userId),
      inArray(expense.id, selectedExpenseIds)
    )
  )

if (ownedExpenses.length !== selectedExpenseIds.length) {
  throw new Error('Unauthorized: not all expenses are owned by the user.')
}
```

**Transaction write pattern** (from deletion.ts lines 64-69):

```typescript
return db.transaction(async (tx) => {
  // INSERT group
  const groupResult = await tx
    .insert(expenseGroup)
    .values({
      userId,
      title: groupTitle,
      subCategoryId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: expenseGroup.id })
  
  const groupId = groupResult[0].id
  
  // INSERT memberships
  await tx
    .insert(expenseGroupMembership)
    .values(
      selectedExpenseIds.map((id) => ({
        groupId,
        expenseId: id,
        createdAt: new Date(),
      }))
    )
  
  return { groupId }
})
```

**Also implement:**
- `renameExpenseGroup(dbOrTx, userId, groupId, newTitle): Promise<void>` — UPDATE title + updatedAt
- Phase 66 scope: `removeExpenseFromGroup`, `dissolveGroup`

---

### `lib/actions/expenses.ts` (action, request-response)

**Analog:** `lib/actions/expenses.ts` — bulkCategorize and bulkDelete actions (lines 207-260)

**Imports pattern** (lines 1-34):

```typescript
'use server'
import { verifySession } from '@/lib/dal/auth'
import { MergeExpensesSchema, ActionState } from '@/lib/validations/expense'
import { getExpenses, EXPENSE_LIST_LIMIT, type ExpenseFilters } from '@/lib/dal/expenses'
import { createExpenseGroup } from '@/lib/services/expense-group'
import { db } from '@/lib/db'
import { expense } from '@/lib/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { revalidateCategorizationSurfaces } from '@/lib/actions/revalidation'
```

**Action signature** (following bulkCategorize pattern, lines 207-210):

```typescript
export async function mergeExpenses(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState>
```

**FormData parsing and validation** (lines 211-217):

```typescript
const parsed = MergeExpensesSchema.safeParse({
  selectedExpenseIds: JSON.parse((formData.get('selectedExpenseIds') as string) ?? '[]'),
  groupTitle: (formData.get('groupTitle') as string) || undefined,
  firstSubCategoryId: formData.get('firstSubCategoryId')
    ? Number(formData.get('firstSubCategoryId'))
    : undefined,
})
if (!parsed.success) {
  return { error: parsed.error.issues[0]?.message ?? 'Input non valido.' }
}
```

**Session verification and error handling** (lines 218-224):

```typescript
const { userId } = await verifySession()
try {
  await db.transaction(async (tx) => {
    // ... merge logic ...
  })
} catch {
  return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
}
revalidateCategorizationSurfaces()
return { error: null }
```

**Inside transaction: ownership-scoped selection** (from bulkCategorize lines 225-240):

```typescript
const selected = await tx
  .select({
    id: expense.id,
    subCategoryId: expense.subCategoryId,
    status: expense.status,
  })
  .from(expense)
  .where(
    and(
      eq(expense.userId, userId),
      inArray(expense.id, parsed.data.selectedExpenseIds)
    )
  )
```

**Merge gate: validate same non-null subcategory:**

```typescript
const categorized = selected.filter(e => e.subCategoryId !== null)
const uncategorized = selected.filter(e => e.subCategoryId === null)

let commonSubCategoryId: number | null = null

if (uncategorized.length > 0) {
  // Use firstSubCategoryId from dialog (categorize-first flow)
  if (!parsed.data.firstSubCategoryId) {
    return { error: 'Categorizza prima di unire.' }
  }
  commonSubCategoryId = parsed.data.firstSubCategoryId
  // NOTE: categorizeExpense is NOT called here; the dialog handles it separately (D-02)
}

if (categorized.length > 0) {
  const subCatIds = new Set(categorized.map(e => e.subCategoryId))
  if (subCatIds.size > 1) {
    return { error: 'Le spese devono avere la stessa categoria.' }
  }
  commonSubCategoryId = categorized[0].subCategoryId
}

if (commonSubCategoryId === null) {
  return { error: 'Almeno una categoria è obbligatoria.' }
}
```

**Service call:**

```typescript
await createExpenseGroup(tx, {
  userId,
  selectedExpenseIds: parsed.data.selectedExpenseIds,
  groupTitle: parsed.data.groupTitle,
  subCategoryId: commonSubCategoryId,
})
```

---

### `lib/validations/expense.ts` (config, transform)

**Analog:** `lib/validations/expense.ts` — BulkCategorizeSchema and BulkDeleteExpensesSchema (lines 26-40)

**NEW: MergeExpensesSchema:**

```typescript
export const MergeExpensesSchema = z.object({
  selectedExpenseIds: z
    .array(z.string().uuid())
    .min(2, { error: 'Seleziona almeno due spese per unire.' })
    .max(500, { error: 'Puoi unire al massimo 500 spese alla volta.' }),
  groupTitle: z
    .string()
    .trim()
    .min(2, { error: 'Il titolo del gruppo deve contenere almeno 2 caratteri.' })
    .max(500, { error: 'Il titolo del gruppo non può superare i 500 caratteri.' }),
  firstSubCategoryId: z
    .number()
    .int()
    .positive()
    .optional(),
})

export type MergeExpensesInput = z.infer<typeof MergeExpensesSchema>
```

**Pattern notes:**
- Array minimum: 2 (can't merge a single expense)
- Array maximum: 500 (matches BulkDeleteExpensesSchema)
- Title: 2–500 chars, trimmed
- firstSubCategoryId: optional (used only when merge dialog pre-categorizes uncategorized selections)
- Error messages in Italian (matching existing pattern)

---

### `app/(app)/expenses/groups/[groupId]/page.tsx` (component/page, request-response)

**Analog:** `app/(app)/expenses/[id]/page.tsx` (entire file)

**Page structure:**

```typescript
import { notFound } from 'next/navigation'
import { GroupDetailClient } from '@/components/expenses/group-detail-client'
import { verifySession } from '@/lib/dal/auth'
import { getCategories } from '@/lib/dal/categories'
import { getExpenseGroupForDetail } from '@/lib/dal/expenses'

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string }>
}) {
  const { groupId } = await params
  const { userId } = await verifySession()

  const [group, categories] = await Promise.all([
    getExpenseGroupForDetail({ userId, groupId }),
    getCategories(),
  ])

  if (!group) {
    notFound()
  }

  return <GroupDetailClient group={group} categories={categories} />
}
```

**Pattern notes:**
- Async RSC (Server Component)
- `params: Promise<{ groupId: string }>` (Next.js 15+ pattern; await params before destructure)
- verifySession() for ownership check
- Promise.all() for parallel data fetches
- notFound() for missing/unauthorized access
- Client component wrapper `GroupDetailClient` (mirrors ExpenseDetailClient pattern)

---

### `components/expenses/bulk-action-bar.tsx` (component, request-response)

**Analog:** `components/expenses/bulk-action-bar.tsx` (existing, lines 1-36)

**MODIFICATION: Add onBulkMerge prop and button**

```typescript
'use client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  selectedIds: string[]
  onBulkCategorize: () => void
  onBulkMerge?: () => void  // NEW
  onBulkDelete: () => void
}

export function BulkActionBar({
  selectedIds,
  onBulkCategorize,
  onBulkMerge,  // NEW
  onBulkDelete,
}: Props) {
  const count = selectedIds.length

  return (
    <div className={cn(
      'fixed bottom-6 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-lg border bg-background px-4 py-3 shadow-lg transition-all duration-150 sm:gap-4',
      count === 0
        ? 'pointer-events-none translate-y-2 opacity-0'
        : 'translate-y-0 opacity-100',
    )}>
      <span className="text-sm text-muted-foreground">
        <span className="font-mono font-medium text-foreground">{count}</span> selezionate
      </span>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" size="sm" onClick={onBulkCategorize}>
          Categorizza ({count})
        </Button>
        {onBulkMerge && (  // NEW
          <Button type="button" size="sm" onClick={onBulkMerge}>
            Unisci ({count})
          </Button>
        )}
        <Button type="button" size="sm" variant="destructive" onClick={onBulkDelete}>
          Elimina ({count})
        </Button>
      </div>
    </div>
  )
}
```

**Implementation note:**
- The "Unisci" button is gated on `onBulkMerge` prop (passed from parent only when all selected expenses share the same non-null subCategoryId)
- Parent (expenses list page) implements the gate logic, not the component

---

### `components/expenses/merge-expenses-dialog.tsx` (component, request-response)

**Analog:** `components/expenses/bulk-categorize-dialog.tsx` (lines 1-65)

**Component structure:**

```typescript
'use client'
import { useTransition, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { SubcategoryPicker } from '@/components/categorization/subcategory-picker'
import { mergeExpenses } from '@/lib/actions/expenses'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import type { MostUsedSubcategory } from '@/lib/dal/subcategory-usage'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedIds: string[]
  categories: CategoryWithSubCategories[]
  mostUsed: MostUsedSubcategory[]
  onSuccess: () => void
}

export function MergeExpensesDialog({
  open,
  onOpenChange,
  selectedIds,
  categories,
  mostUsed,
  onSuccess,
}: Props)
```

**Dialog flow (two-step when uncategorized present):**

```typescript
const [step, setStep] = useState<'title' | 'categorize' | 'confirm'>('title')
const [groupTitle, setGroupTitle] = useState('')
const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<number | null>(null)
const [isPending, startTransition] = useTransition()

const hasUncategorized = selectedIds.some(/* check expense.status === '1' */)

function handleNext() {
  if (step === 'title') {
    if (hasUncategorized) {
      setStep('categorize')
    } else {
      setStep('confirm')
    }
  }
}

function handleCategorySelected(subCategoryId: string) {
  setSelectedSubCategoryId(Number(subCategoryId))
  setStep('confirm')
}

function handleConfirm() {
  const fd = new FormData()
  fd.set('selectedExpenseIds', JSON.stringify(selectedIds))
  fd.set('groupTitle', groupTitle)
  if (selectedSubCategoryId) {
    fd.set('firstSubCategoryId', String(selectedSubCategoryId))
  }

  startTransition(async () => {
    const result = await mergeExpenses({ error: null }, fd)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(`${selectedIds.length} spese unite.`)
      onSuccess()
      onOpenChange(false)
    }
  })
}
```

**Render:**

```typescript
return (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-[425px]">
      {step === 'title' && (
        <>
          <DialogHeader>
            <DialogTitle>Unisci {selectedIds.length} spese</DialogTitle>
            <DialogDescription>Dai un nome al nuovo gruppo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              placeholder="es. Cherasco"
              value={groupTitle}
              onChange={(e) => setGroupTitle(e.target.value)}
              disabled={isPending}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Annulla</Button>
            </DialogClose>
            <Button
              onClick={handleNext}
              disabled={!groupTitle.trim() || isPending}
            >
              {hasUncategorized ? 'Avanti' : 'Unisci'}
            </Button>
          </DialogFooter>
        </>
      )}
      
      {step === 'categorize' && (
        <>
          <DialogHeader>
            <DialogTitle>Categorizza prima di unire</DialogTitle>
            <DialogDescription>
              {selectedIds.length} spese non categorizzate. Scegli una categoria.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <SubcategoryPicker
              open={true}
              onOpenChange={() => {}}  // Fixed open in dialog context
              categories={categories}
              mostUsed={mostUsed}
              allowedCategoryTypes={['in', 'out', 'transfer', 'allocation']}
              defaultType={null}
              onChange={handleCategorySelected}
              pending={isPending}
            />
          </div>
        </>
      )}
      
      {step === 'confirm' && (
        <>
          <DialogHeader>
            <DialogTitle>Conferma unione</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 text-sm">
            <p><strong>Titolo:</strong> {groupTitle}</p>
            <p><strong>Spese:</strong> {selectedIds.length}</p>
            <p><strong>Categoria:</strong> {/* display selected category */}</p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Annulla</Button>
            </DialogClose>
            <Button onClick={handleConfirm} disabled={isPending}>
              Unisci
            </Button>
          </DialogFooter>
        </>
      )}
    </DialogContent>
  </Dialog>
)
```

---

### `drizzle/migrations/0026_expense_group.sql` (migration, CRUD)

**Analog:** `drizzle/migrations/0020_transaction_pair.sql` (lines 1-13)

**Migration structure:**

```sql
-- Create expenseGroup table
CREATE TABLE "expense_group" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "title" text NOT NULL,
  "sub_category_id" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Create expenseGroupMembership junction table
CREATE TABLE "expense_group_membership" (
  "id" serial PRIMARY KEY NOT NULL,
  "group_id" integer NOT NULL,
  "expense_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "expense_group_membership_group_expense_unique" UNIQUE("group_id", "expense_id")
);
--> statement-breakpoint

-- Foreign keys
ALTER TABLE "expense_group" ADD CONSTRAINT "expense_group_user_id_fk" 
  FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "expense_group" ADD CONSTRAINT "expense_group_sub_category_id_fk" 
  FOREIGN KEY ("sub_category_id") REFERENCES "public"."sub_category"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "expense_group_membership" ADD CONSTRAINT "expense_group_membership_group_id_fk" 
  FOREIGN KEY ("group_id") REFERENCES "public"."expense_group"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "expense_group_membership" ADD CONSTRAINT "expense_group_membership_expense_id_fk" 
  FOREIGN KEY ("expense_id") REFERENCES "public"."expense"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- Indexes for query performance
CREATE INDEX "expense_group_user_id_idx" ON "expense_group" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "expense_group_membership_group_id_idx" ON "expense_group_membership" USING btree ("group_id");
--> statement-breakpoint
CREATE INDEX "expense_group_membership_expense_id_idx" ON "expense_group_membership" USING btree ("expense_id");
```

**Pattern notes:**
- `ON DELETE cascade` for user_id (group deleted when user deleted)
- `ON DELETE cascade` for group_id in membership (members deleted when group deleted) — this is Phase 66 concern
- `ON DELETE cascade` for expense_id in membership (membership deleted when expense deleted) — consistent with transaction behavior
- `ON DELETE set null` for sub_category_id (group remains, just loses categorization)
- Unique constraint on `(group_id, expense_id)` prevents duplicate membership
- Indexes on all foreign keys for lookup performance

---

## Shared Patterns

### Session Verification & Ownership Scoping
**Source:** All DAL, service, and action files  
**Apply to:** All service functions and server actions

```typescript
const { userId } = await verifySession()

// Always scope queries and mutations to userId:
.where(and(eq(expense.userId, userId), inArray(expense.id, ids)))
```

### Error Handling
**Source:** `lib/actions/expenses.ts` (lines 224, 200-201)  
**Apply to:** All server actions (mergeExpenses, renameGroup, etc.)

```typescript
try {
  await db.transaction(async (tx) => {
    // ... operation ...
  })
} catch {
  return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
}
```

### Revalidation
**Source:** `lib/actions/expenses.ts` (line 203)  
**Apply to:** All write actions in expenses domain

```typescript
import { revalidateCategorizationSurfaces } from '@/lib/actions/revalidation'

// After successful write
revalidateCategorizationSurfaces()
return { error: null }
```

### Decimal.js Money Sums
**Source:** `lib/dal/expenses.ts` (read-time aggregation context)  
**Apply to:** All group total calculations

```typescript
import { toDecimal, toDbDecimal } from '@/lib/utils/decimal'

const totalAmount = members.reduce(
  (sum, member) => sum.plus(toDecimal(member.totalAmount)),
  new Decimal(0),
)
const dbValue = toDbDecimal(totalAmount)
```

### Dialog/Sheet Form Patterns
**Source:** `components/expenses/bulk-categorize-dialog.tsx`  
**Apply to:** All modal dialogs with server actions

```typescript
const [isPending, startTransition] = useTransition()

function handleSubmit() {
  const fd = new FormData()
  fd.set('ids', JSON.stringify(selectedIds))
  fd.set('otherField', value)

  startTransition(async () => {
    const result = await serverAction({ error: null }, fd)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Success message.')
      onSuccess()
      onOpenChange(false)
    }
  })
}
```

---

## No Analog Found

All 10 files have analogs in the codebase. Pattern extraction is 100% coverage.

---

## Risk Summary & Implementation Notes

1. **Read-time aggregation (GROUP BY in getExpenses):** The main risk is OFFSET/LIMIT pagination applied before composition. Mitigation: apply composition in the DAL query via CTE or GROUP BY before LIMIT. Test pagination after merge thoroughly (see RESEARCH.md Pitfall 3).

2. **DetailPageShell reuse for group detail:** Low risk — existing pattern proven on expense/transaction pages. Verify smart-back (back button) correctly restores filter state from /expenses list.

3. **Decimal.js sums:** Proven pattern in project. No new risk — just ensure all group totalAmount calculations use `toDecimal()` + `toDbDecimal()` round-trip.

4. **Membership uniqueness constraint:** Database enforces `(group_id, expense_id)` uniqueness. If a member is already in a group, INSERT will fail — catch and surface appropriate error message in mergeExpenses action.

5. **Cascading deletes:** expenseGroupMembership uses `ON DELETE cascade` for group_id, so dissolving a group automatically removes all memberships. Phase 66 concern, but verify no orphans at phase gate.

---

## Metadata

**Analog search scope:** lib/{db, dal, services, actions, validations}, app/(app)/expenses, components/expenses, drizzle/migrations

**Files scanned:** 25+ (schema, DAL, services, actions, validations, pages, components, migrations)

**Pattern extraction date:** 2026-07-18

**Confidence:** HIGH — All analogs are recent (2025–2026), active codebase patterns. Schema and migration patterns verified. Query composition patterns tested in existing getExpenses (no new syntactic risk).
