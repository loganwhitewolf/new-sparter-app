# Phase 3: Expense Management - Pattern Map

**Mapped:** 2026-04-27
**Files analyzed:** 14 new/modified files
**Analogs found:** 12 / 14

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/db/schema.ts` (modify) | model | CRUD | `lib/db/schema.ts` itself | exact — extend in-place |
| `lib/dal/expenses.ts` | service | CRUD | `lib/dal/auth.ts` | role-match (same `import 'server-only'` + `cache()` shape) |
| `lib/dal/categories.ts` | service | CRUD | `lib/dal/auth.ts` | role-match |
| `lib/actions/expenses.ts` | controller | request-response | `lib/actions/auth.ts` | exact — same `'use server'` + Zod safeParse + `{ error: string \| null }` shape |
| `lib/validations/expense.ts` | utility | transform | `lib/validations/auth.ts` | exact — same Zod v4 object schema |
| `lib/utils/decimal.ts` | utility | transform | `lib/utils.ts` (partial) | partial — no match, use RESEARCH.md pattern |
| `app/(app)/spese/page.tsx` | component | request-response | `app/(app)/dashboard/page.tsx` | role-match (async Server Component inside `(app)/` layout) |
| `app/layout.tsx` (modify) | config | — | `app/layout.tsx` itself | exact — add `<Toaster />` |
| `components/expenses/expense-table.tsx` | component | event-driven | `components/layout/topbar.tsx` | partial — same `'use client'` + shadcn imports + DropdownMenu pattern |
| `components/expenses/expense-filters.tsx` | component | event-driven | `components/layout/sidebar.tsx` | partial — same `usePathname`/router pattern; `useSearchParams` is new |
| `components/expenses/expense-form-dialog.tsx` | component | request-response | `app/(auth)/login/page.tsx` | exact — same `useActionState` + form + error banner pattern |
| `components/expenses/bulk-action-bar.tsx` | component | event-driven | `components/layout/bottom-nav.tsx` | partial — fixed-position bar UI analog |
| `components/expenses/bulk-categorize-dialog.tsx` | component | request-response | `app/(auth)/login/page.tsx` | role-match — same `useActionState` + Dialog + form |
| `drizzle/seed.ts` | utility | batch | — | no analog — first seed script in project |
| `tests/expenses.spec.ts` | test | — | `tests/auth.spec.ts` | exact — same `test.fixme()` stub pattern |

---

## Pattern Assignments

### `lib/db/schema.ts` (modify — model, CRUD)

**Analog:** `lib/db/schema.ts` lines 1-124 (the file itself is the template)

**Existing imports pattern** (lines 1-10):
```typescript
import { relations } from "drizzle-orm";
import {
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
```

**New imports to add** (extend the existing import block):
```typescript
import {
  pgTable, pgEnum, text, varchar, integer, serial,
  timestamp, boolean, index, unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
```
Add `integer`, `serial`, `unique` to the existing `drizzle-orm/pg-core` destructure.

**Existing enum pattern** (lines 12-18 — copy this shape):
```typescript
export const subscriptionPlanEnum = pgEnum("subscription_plan", [
  "free",
  "basic",
  "pro",
]);
```
New enums follow same shape:
```typescript
export const categoryTypeEnum = pgEnum('category_type', ['in', 'out', 'system'])
export const expenseStatusEnum = pgEnum('expense_status', ['1', '2', '3', '4'])
```

**Existing table pattern with text PK + FK reference + index** (lines 37-56 — `session` table):
```typescript
export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);
```
`expense` table copies this shape exactly — text PK, userId FK with cascade, timestamps with `$onUpdate`, index array.

**Existing relations pattern** (lines 106-123):
```typescript
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));
```
New relations (`categoryRelations`, `subCategoryRelations`, `expenseRelations`) follow this exact shape — extend `userRelations` to add `many(expense)`.

---

### `lib/dal/expenses.ts` (service, CRUD)

**Analog:** `lib/dal/auth.ts` lines 1-27

**Imports pattern** (lines 1-6 of analog):
```typescript
import 'server-only'
import { cache } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
```
New file uses the same `import 'server-only'` guard and `cache` wrapper:
```typescript
import 'server-only'
import { cache } from 'react'
import { db } from '@/lib/db'
import { expense, subCategory, category } from '@/lib/db/schema'
import { eq, and, gte, lte, or, desc, inArray } from 'drizzle-orm'
import { verifySession } from '@/lib/dal/auth'
```

**Auth/session pattern** (lines 12-16 of analog):
```typescript
export const verifySession = cache(async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  if (!session?.user) {
    redirect('/login')
  }
```
`getExpenses` wraps itself in `cache()` and opens with `const { userId } = await verifySession()` — every DAL function must scope to the verified userId before querying.

**Core query pattern** — `db.select().from().leftJoin().where(and(...conditions)).orderBy().limit()`. Always use `leftJoin` not `join` (see Pitfall 1 in RESEARCH.md). Conditions array built dynamically, then spread into `and(...conditions)`.

**No try/catch in DAL** — errors propagate to the Server Action layer. The DAL does not catch DB errors; Server Actions catch and return `{ error: '...' }`.

---

### `lib/dal/categories.ts` (service, CRUD)

**Analog:** `lib/dal/auth.ts` lines 1-6 (same header shape)

**Imports + core pattern:**
```typescript
import 'server-only'
import { cache } from 'react'
import { db } from '@/lib/db'
import { category, subCategory } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
```
`getCategories` is wrapped in `cache()` — no `verifySession()` needed (categories are public seeded data, not user-scoped). Returns nested structure `{ id, name, slug, subCategories: [...] }` for use in Select components.

---

### `lib/actions/expenses.ts` (controller, request-response)

**Analog:** `lib/actions/auth.ts` lines 1-64 — this is the canonical template

**Directive + imports pattern** (lines 1-6):
```typescript
'use server'
import { auth } from '@/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { LoginSchema, RegisterSchema } from '@/lib/validations/auth'
```
New file:
```typescript
'use server'
import { revalidatePath } from 'next/cache'
import { verifySession } from '@/lib/dal/auth'
import { CreateExpenseSchema, UpdateExpenseSchema, BulkCategorizeSchema } from '@/lib/validations/expense'
import { insertExpense, updateExpense, deleteExpense } from '@/lib/dal/expenses'
import { db } from '@/lib/db'
import { expense } from '@/lib/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
```

**Action signature pattern** (lines 9-13):
```typescript
export async function signInAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
```
All expense actions use the same signature: `(_prev: ActionState, formData: FormData): Promise<ActionState>`. Define `type ActionState = { error: string | null }` once at top of file.

**Zod safeParse + early return pattern** (lines 14-20):
```typescript
  const parsed = LoginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: 'Credenziali non valide. Riprova o contatta il supporto.' }
  }
```
For expense actions: return the first Zod issue message: `return { error: parsed.error.issues[0].message }`.

**Try/catch pattern** (lines 21-30):
```typescript
  try {
    await auth.api.signInEmail({ ... })
  } catch {
    return { error: 'Credenziali non valide. Riprova o contatta il supporto.' }
  }
  redirect('/dashboard')
```
Expense actions use `try/catch` with Italian error message + `revalidatePath('/spese')` on success, `return { error: null }` (no redirect).

**`bulkCategorize` pattern** — must include `eq(expense.userId, userId)` in the WHERE clause alongside `inArray(expense.id, ids)`. Security requirement from RESEARCH.md Pitfall 4.

---

### `lib/validations/expense.ts` (utility, transform)

**Analog:** `lib/validations/auth.ts` lines 1-16 — exact template

**Full file pattern** (lines 1-16):
```typescript
import { z } from 'zod'

export const LoginSchema = z.object({
  email: z.email({ error: 'Email non valida.' }).trim(),
  password: z.string().min(8, { error: 'Password troppo corta.' }),
})

export const RegisterSchema = z.object({
  email: z.email({ error: 'Email non valida.' }).trim(),
  password: z.string().min(8, { error: 'La password deve essere di almeno 8 caratteri.' }),
})

export type LoginInput = z.infer<typeof LoginSchema>
export type RegisterInput = z.infer<typeof RegisterSchema>

export type AuthActionState = { error: string | null }
```
Key conventions to copy:
- `{ error: '...' }` (not `{ message: '...' }`) — Zod v4 syntax confirmed in this codebase
- Error messages in Italian
- Export inferred types with `z.infer<typeof Schema>`
- Export shared `ActionState` type from this file

---

### `lib/utils/decimal.ts` (utility, transform)

**No analog** — first utility of this type in the codebase. Use RESEARCH.md pattern verbatim:
```typescript
import Decimal from 'decimal.js'

export function toDecimal(value: string | number): Decimal {
  return new Decimal(value)
}

export function toDbDecimal(value: Decimal): string {
  return value.toFixed(2)
}
```
Not used in Phase 3 expense operations (no amounts), but required to clear the STATE.md blocker.

---

### `app/(app)/spese/page.tsx` (component, request-response)

**Analog:** `app/(app)/dashboard/page.tsx` lines 1-19

**Page pattern** (lines 1-19):
```typescript
export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Panoramica delle tue finanze
        </p>
      </div>
      ...
    </div>
  )
}
```
The `/spese` page must be an **async** Server Component (add `async` keyword) to call DAL functions. The outer `<div className="flex flex-col gap-6">` and heading pattern copy exactly. It accepts `searchParams` as a prop (Next.js App Router convention):
```typescript
export default async function SpesePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; status?: string; period?: string }>
}) {
```
Note: In Next.js 16, `searchParams` is a Promise — must be `await`-ed.

Wrap `<ExpenseFilters />` in `<Suspense>` per RESEARCH.md Pitfall 3. Do NOT call `db` or import Drizzle tables directly — use DAL functions only.

---

### `app/layout.tsx` (modify — config)

**Analog:** `app/layout.tsx` lines 1-20 (the file itself)

**Current body** (lines 17-19):
```typescript
      <body className={`${geistSans.className} antialiased`}>{children}</body>
```
Modify to add Toaster:
```typescript
      <body className={`${geistSans.className} antialiased`}>
        {children}
        <Toaster />
      </body>
```
Add import at top: `import { Toaster } from 'sonner'`. No other changes.

---

### `components/expenses/expense-form-dialog.tsx` (component, request-response)

**Analog:** `app/(auth)/login/page.tsx` lines 1-56 — exact template for `useActionState` + form pattern

**Directive + imports pattern** (lines 1-9):
```typescript
'use client'
import { useActionState } from 'react'
import Link from 'next/link'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { signInAction } from '@/lib/actions/auth'
```
New file uses same set: `useActionState`, `Loader2`, `Button`, `Input`, `Alert`, `AlertDescription` — plus `Dialog` family, `Select` family, and Textarea from shadcn.

**useActionState hook** (line 11):
```typescript
const [state, action, isPending] = useActionState(signInAction, { error: null })
```
Same for expense form: `useActionState(createExpense, { error: null })` / `useActionState(updateExpense, { error: null })`.

**Error display pattern** (lines 21-25):
```typescript
      {state.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
```
Copy verbatim inside `<DialogContent>` body.

**Submit button with pending state** (lines 40-43):
```typescript
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Accedi
        </Button>
```
Same pattern for expense form submit button.

**Form wrapping** (line 27):
```typescript
      <form action={action} className="flex flex-col gap-3">
```
Expense form: `<form action={formAction} className="flex flex-col gap-4">` inside `<DialogContent>`.

The dialog must manage `open` state with `useState<boolean>` and close on successful action (when `state.error === null` after submission). Use a `useEffect` watching `state` to close the dialog.

---

### `components/expenses/expense-table.tsx` (component, event-driven)

**Analog:** `components/layout/topbar.tsx` lines 1-59 — best match for `'use client'` + shadcn DropdownMenu pattern

**Client directive + imports pattern** (lines 1-14):
```typescript
'use client'

import { LogOut, User } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { authClient } from '@/lib/auth-client'
import { signOutAction } from '@/lib/actions/auth'
```
Expense table imports: same `DropdownMenu` family + shadcn `Table` family + `Badge` + `Dialog` for delete confirm + `Checkbox` (from shadcn or `<input type="checkbox">`).

**DropdownMenuItem with destructive styling** (lines 44-52):
```typescript
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => signOutAction()}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </DropdownMenuItem>
```
Delete menu item copies `text-destructive focus:text-destructive` className exactly.

**Checkbox state** — managed with `useState<string[]>` (array of selected expense IDs). Lifted up to a parent that also renders `<BulkActionBar>` so both components share the selection state. Pass `selectedIds` + `onSelectionChange` as props.

---

### `components/expenses/expense-filters.tsx` (component, event-driven)

**Analog:** `components/layout/sidebar.tsx` lines 1-83 — same `'use client'` + `usePathname` navigation pattern

**Client + router pattern** (lines 1-9):
```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Receipt, Settings, Tag, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
```
Filter component: same `'use client'` + `import { useSearchParams, useRouter } from 'next/navigation'` + `useTransition` for pending state.

The `router.replace` (not `router.push`) pattern for filter changes is new in this codebase — no existing analog. Use the RESEARCH.md Pattern 4 code verbatim:
```typescript
function updateFilter(key: string, value: string | null) {
  const params = new URLSearchParams(searchParams.toString())
  if (value) params.set(key, value)
  else params.delete(key)
  startTransition(() => {
    router.replace('/spese?' + params.toString(), { scroll: false })
  })
}
```

**`isPending` usage** — apply `opacity-50 pointer-events-none` class to the table container while `isPending` is true (passed as prop from the filter component or lifted to the page).

---

### `components/expenses/bulk-action-bar.tsx` (component, event-driven)

**Analog:** `components/layout/bottom-nav.tsx` — partial match for fixed-position bar UI concept

**Fixed positioning pattern** — `components/layout/bottom-nav.tsx` uses `fixed` positioning at the bottom of the screen for mobile. The FAB copies this position concept:
```typescript
// Fixed at bottom, centered, appears only when selectedIds.length > 0
<div className={cn(
  "fixed bottom-6 left-1/2 -translate-x-1/2 z-40",
  "flex items-center gap-3 rounded-full border bg-background px-4 py-2 shadow-lg",
  "transition-all duration-200",
  selectedIds.length === 0 && "pointer-events-none opacity-0"
)}>
```
Animate visibility with opacity/pointer-events (not unmounting) to keep transitions smooth.

Props: `selectedIds: string[]`, `onClearSelection: () => void`, `onBulkCategorize: () => void`.

---

### `components/expenses/bulk-categorize-dialog.tsx` (component, request-response)

**Analog:** `app/(auth)/login/page.tsx` — same `useActionState` + form pattern as `expense-form-dialog.tsx`

Same imports and hook pattern as `expense-form-dialog.tsx`. Key difference: IDs are passed as hidden `<input type="hidden" name="ids" value={JSON.stringify(selectedIds)} />` inside the form. The `bulkCategorize` Server Action reads them with `JSON.parse(formData.get('ids') as string)`.

Uses the two-level `<Select>` with `<SelectGroup>` + `<SelectLabel>` pattern from RESEARCH.md Pattern 6:
```tsx
<Select value={subCategoryId ?? ''} onValueChange={(v) => setSubCategoryId(v)}>
  <SelectTrigger><SelectValue placeholder="Seleziona una categoria" /></SelectTrigger>
  <SelectContent>
    {categories.map((cat) => (
      <SelectGroup key={cat.id}>
        <SelectLabel>{cat.name}</SelectLabel>
        {cat.subCategories.map((sub) => (
          <SelectItem key={sub.id} value={String(sub.id)}>
            {sub.name}
          </SelectItem>
        ))}
      </SelectGroup>
    ))}
  </SelectContent>
</Select>
```

---

### `drizzle/seed.ts` (utility, batch)

**No analog** — first seed script in this codebase. Follow the `scripts/migrate.ts` pattern for file structure (relative imports, no `@/` aliases). Use `onConflictDoNothing()` for idempotent re-runs. Insert categories first, then subCategories (FK constraint order per RESEARCH.md Pitfall 5).

---

### `tests/expenses.spec.ts` (test)

**Analog:** `tests/auth.spec.ts` lines 1-68 — exact template

**Test structure pattern** (lines 1-7):
```typescript
import { expect, test } from '@playwright/test'

test.describe('Auth - AUTH-01: Registration', () => {
  test('register happy path: valid email+password redirects to /dashboard', async () => {
    test.fixme()
    // ...comment explaining what to implement and when
  })
```
All 8 expense tests use `test.fixme()` stubs. Group under `test.describe` blocks matching the requirement ID (EXP-01, EXP-02, EXP-03). Include comments explaining the behavior and "Implement when Plan X is complete."

The one non-fixme test in `auth.spec.ts` (line 56) demonstrates the real Playwright assertion style for when stubs are eventually implemented:
```typescript
  test('unauthenticated /dashboard redirects to /login', async ({ page }) => {
    const response = await page.goto('/dashboard')
    expect(response?.url()).toContain('/login')
  })
```

---

## Shared Patterns

### Session Guard (apply to all Server Actions and DAL functions)

**Source:** `lib/dal/auth.ts` lines 12-27
```typescript
import 'server-only'
import { cache } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'

export const verifySession = cache(async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  if (!session?.user) {
    redirect('/login')
  }
  return {
    userId: user.id,
    subscriptionPlan: user.subscriptionPlan ?? 'free',
    role: user.role ?? 'user',
  }
})
```
Call `const { userId } = await verifySession()` as the first line of every Server Action and every user-scoped DAL function. Never skip this.

### Error State Shape (apply to all Server Actions)

**Source:** `lib/validations/auth.ts` line 16 + `lib/actions/auth.ts` line 10
```typescript
// In lib/validations/expense.ts:
export type ActionState = { error: string | null }

// In every Server Action:
export async function createExpense(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  // ...
  return { error: null }  // success
  // or
  return { error: 'Messaggio di errore in italiano.' }  // failure
}
```

### useActionState Hook (apply to all form Client Components)

**Source:** `app/(auth)/login/page.tsx` line 11
```typescript
const [state, action, isPending] = useActionState(serverAction, { error: null })
```
- `state.error` drives the `<Alert variant="destructive">` banner
- `isPending` drives `disabled={isPending}` on submit button + `<Loader2 animate-spin>` icon

### Drizzle userId Scoping (apply to all expense DAL queries and mutations)

**Source:** `lib/db/schema.ts` lines 51-53 (session.userId FK pattern) + RESEARCH.md Security section
```typescript
// Every expense query MUST include:
eq(expense.userId, userId)

// Every expense mutation MUST include:
.where(and(
  eq(expense.userId, userId),
  // ... other conditions
))

// bulkCategorize MUST include userId even with inArray:
.where(and(inArray(expense.id, ids), eq(expense.userId, userId)))
```

### Tailwind cn() Utility (apply to all components)

**Source:** `lib/utils.ts` — already available
**Usage in components** (`components/layout/sidebar.tsx` lines 38-42):
```typescript
import { cn } from '@/lib/utils'

className={cn(
  'base-classes',
  condition && 'conditional-classes'
)}
```

### Italian Copy Conventions

**Source:** `app/(auth)/login/page.tsx` + `app/(auth)/register/page.tsx`
- Page headings: `text-xl font-semibold`
- Subheadings / descriptions: `text-sm text-muted-foreground`
- Validation errors: Italian, sentence-case, ends with period
- Action buttons: Italian imperative ("Crea spesa", "Salva", "Elimina", "Annulla", "Categorizza (N)")

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `lib/utils/decimal.ts` | utility | transform | No monetary utility exists yet — first in codebase |
| `drizzle/seed.ts` | utility | batch | No seed script exists yet — first in codebase |

For both, use the RESEARCH.md Code Examples verbatim.

---

## Metadata

**Analog search scope:** `lib/`, `app/`, `components/`, `tests/`
**Files scanned:** 20 source files read directly
**Pattern extraction date:** 2026-04-27

**Key conventions confirmed from codebase:**
- `text` primary keys (not `serial`) — consistent with Better Auth `user.id`
- `'use server'` actions return `{ error: string | null }`, never throw
- All DAL files open with `import 'server-only'`
- Zod v4 error syntax: `{ error: '...' }` not `{ message: '...' }`
- Tailwind classes use `cn()` from `@/lib/utils`
- shadcn components import from `@/components/ui/...`
- `$onUpdate(() => new Date())` pattern on `updatedAt` timestamps
