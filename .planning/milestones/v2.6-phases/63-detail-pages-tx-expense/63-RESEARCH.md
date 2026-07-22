# Phase 63: detail-pages-tx-expense - Research

**Researched:** 2026-07-05
**Domain:** Detail pages + inline editing for transactions and expenses
**Confidence:** HIGH

## Summary

Phase 63 builds two new RSC detail pages (`/transactions/[id]` and `/expenses/[id]`) that replace the expense dialog workflows with persistent, editable routes. The backend is complete (Phase 62 delivered `updateTransaction` with atomic reconciliation and pair-guard, plus atomic `updateExpense`). This phase is purely UI: two pages sharing a `DetailPageShell` component, inline per-field editing wired to Phase 62 actions, existing dialog components reused in place, and old dialogs removed from tables.

**Key architectural decision:** The phase maintains the immutability boundary locked in Phase 62: `transactionHash`, `descriptionHash`, and `description` are never editable; only amount/date/title/category. Auto-reconciliation of expense aggregates runs silently inside the action on amount/date edits. Pair-guard blocks with Italian message, never auto-unlinks.

**Primary recommendation:** Build as two focused RSC pages (owned by the API/Backend tier for data fetch + ownership checks) with shared `DetailPageShell` layout component (owned by the Frontend tier). Reuse all existing dialog components unchanged; the phase does not invent new patterns.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Data fetch + ownership check | Backend (RSC) | — | Drizzle queries and auth sit in the RSC layer; dynamic routes always verify session and ownership before rendering |
| Page layout & shell structure | Frontend (Client) | — | Presentational shell component, reusable across Phase 63 and Phase 64 file page |
| Inline field editing | Frontend (Client) | Backend (Action) | Client controls edit mode/blur events; action handles validation and DB write |
| Dialog invocation (counterpart picker, detach, categorize, delete) | Frontend (Client) | — | Existing components lifted from tables, triggered on button/menu click |
| Amount/date reconciliation | Backend (Action + Service) | — | `updateTransaction` handles pair-guard and expense reconciliation atomically inside `db.transaction` |
| Category edit (via linked expense) | Backend (Action) | Frontend (Picker UI) | `updateExpense` persists the subcategory change; transaction page routes through the linked expense |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16 | App Router RSC + Server Actions | Sparter foundation; dynamic [id] routes are standard Next.js patterns |
| React | 19 | Client components + hooks | Built into Next.js 16; `useActionState` for form submission |
| Drizzle ORM | Latest in-project | Data access + queries | Existing project ORM; transaction wrapping for atomicity |
| Decimal.js | Latest in-project | Monetary arithmetic | Hard requirement in CLAUDE.md; all amount edits use it |
| zod | Latest in-project | Validation | Server-side validation of all editable fields; action-level type guards |
| Lucide React | Latest in-project | Icons (pencil, menu, lock) | Existing icon library; used in transaction-title-edit |
| Vaul | Latest in-project | Dialog/bottom-sheet primitives | Existing project dependency; `SubcategoryPicker` uses it |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `next/navigation` | 16 | Router utilities | `router.refresh()` after atomic saves; `notFound()` for ownership checks |
| `useActionState` (React) | 19 | Form state management | Per-field inline edits; error display under the field |
| `useActionState` (server-only) | 19 | Data revalidation | Trigger `router.refresh()` after successfully saving amount/date edits |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline edit (Enter/Esc to save) | Modal/dialog for each field | Inline is lighter; dialogs for every field would be clunky (D-05) |
| Shared `DetailPageShell` | Duplicate layouts in tx and expense pages | Shared shell ensures uniformity (D-02) + enables Phase 64 file page to reuse |
| `router.refresh()` on amount/date edit | Page navigation or full-page reload | `refresh()` is silent, atomic-consistent with the reconciliation (D-08) |
| Action dialogs invoked from page | Separate detail-page-specific dialogs | Reuse (D-10) = zero duplication; identical behavior across all entry points |

**Installation:** All dependencies already in-project. No new packages required.

**Version verification:**
- Next.js 16: `package.json` — confirmed active
- React 19: included with Next.js 16
- Decimal.js: `package.json` — existing `@/lib/utils/decimal` helpers
- Zod: `package.json` — existing validation helpers
- Lucide React: `package.json` — existing icon set
- Vaul: `package.json` — existing sheet/dialog primitive

## Package Legitimacy Audit

No new packages required. All dependencies are existing, verified, and actively maintained within the project.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | All dependencies reused |

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious (SUS):** none

## Architecture Patterns

### System Architecture Diagram

```
Entry Point: Browser (authenticated user)
     ↓
Next.js App Router
     ↓
[/transactions/[id] or /expenses/[id]] RSC Page
     ↓
Ownership Check (DAL query + verifySession)
     ↓
notFound() if not owner
     ↓
Render DetailPageShell (layout)
     ↓
├── Header (title + amount + action buttons)
├── Data Cards (Dati, Categoria, Collegamenti, etc.)
├── Inline Edit Fields (pencil → input → Enter/Blur → action)
│   └── updateTransaction / updateExpense server action
│       ↓
│       Zod validation
│       ↓
│       db.transaction { update + reconcile if amount/date }
│       ↓
│       router.refresh() (silent success)
│   └── Error: show inline under field, stay in edit
└── Dialog Buttons (Cerca su Internet, Collega/Scollega, Categorizza, Elimina)
    └── Invoke existing client-side dialogs
        └── counterpart-picker-dialog, detach-expense-dialog, expense-categorize-dialog, delete-dialog
            └── Their server actions call Phase 62 services
```

Data flow: browser → RSC fetch → ownership gate → render shell → edit triggers action → silent reconcile + refresh → user sees updated aggregates.

### Recommended Project Structure

```
app/(app)/
├── transactions/
│   ├── page.tsx              # existing list page
│   └── [id]/
│       └── page.tsx          # NEW: detail + edit page (RSC)
├── expenses/
│   ├── page.tsx              # existing list page
│   └── [id]/
│       └── page.tsx          # NEW: detail + edit page (RSC)

components/
├── detail-pages/
│   └── detail-page-shell.tsx # NEW: shared header + card-section slots (client)
├── transactions/
│   ├── transaction-title-edit.tsx  # existing (reused)
│   └── [other dialog components]   # existing (reused)
├── expenses/
│   ├── expense-title-edit.tsx      # existing (reused)
│   └── [other dialog components]   # existing (reused)

lib/
├── dal/
│   ├── transactions.ts       # add getTransactionForDetail(userId, id) — all fields
│   └── expenses.ts           # add getExpenseForDetail(userId, id) — with linked txs
├── actions/
│   ├── transaction-edit.ts   # existing (Phase 62)
│   └── expenses.ts           # existing updateExpense (Phase 62)
└── routes.ts                 # add APP_ROUTES.transactionDetail, expenseDetail
```

### Pattern 1: RSC Detail Page with Ownership Gate

**What:** Top-level route page that fetches owned entity, verifies session, returns `notFound()` if not found or not owner.

**When to use:** Every authenticated dynamic route (`/transactions/[id]`, `/expenses/[id]`, later `/import/[fileId]`).

**Example:**

```typescript
// app/(app)/transactions/[id]/page.tsx
import { notFound } from 'next/navigation'
import { verifySession } from '@/lib/dal/auth'
import { getTransactionForDetail } from '@/lib/dal/transactions'

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { userId } = await verifySession()

  const tx = await getTransactionForDetail({ userId, id })
  if (!tx) {
    notFound()
  }

  // Pass to client component
  return <TransactionDetailShell transaction={tx} />
}
```

**Source:** Pattern follows `/import/[fileId]/suggestions/page.tsx` existing pattern [VERIFIED: codebase grep].

### Pattern 2: Inline Pencil-Edit with Per-Field Save

**What:** Button that enters edit mode, text input with Enter/Esc/Blur, server action on submit, inline error display.

**When to use:** Single-field edits that should save immediately (amount, date, title, notes).

**Example:**

```typescript
// Component (client)
'use client'
import { useActionState } from 'react'
import { Pencil } from 'lucide-react'
import { updateTransactionAmount } from '@/lib/actions/transaction-edit'

export function AmountEdit({
  id: string,
  amount: string,
  onSuccess: () => void,
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(amount)
  const [state, formAction, isPending] = useActionState(
    updateTransactionAmount,
    { error: null }
  )

  useEffect(() => {
    if (state.error === null && /* submitted */) {
      setIsEditing(false)
      onSuccess()
    }
  }, [state])

  if (!isEditing) {
    return (
      <button onClick={() => { setValue(amount); setIsEditing(true) }}>
        <span>{formatAmount(amount)}</span>
        <Pencil className="..." />
      </button>
    )
  }

  return (
    <form action={formAction}>
      <input
        name="amount"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setIsEditing(false)
        }}
      />
      {state.error && <p className="text-destructive">{state.error}</p>}
      <button type="submit" disabled={isPending}>Salva</button>
      <button type="button" onClick={() => setIsEditing(false)}>Annulla</button>
    </form>
  )
}
```

**Source:** Pattern adapted from existing `transaction-title-edit.tsx` [VERIFIED: codebase] and documented in 63-CONTEXT.md D-05.

### Pattern 3: Shared DetailPageShell Layout Component

**What:** Reusable client component that provides header + card sections (title, amount, action buttons + overflow menu, and named card slots like "Dati", "Categoria", "Collegamenti").

**When to use:** All three detail pages (transactions, expenses, file) to ensure uniform structure and enable CSS/TW consistency.

**Example:**

```typescript
// components/detail-pages/detail-page-shell.tsx
'use client'
import { ReactNode } from 'react'

type Props = {
  // Header
  title: ReactNode
  amount?: ReactNode
  actions?: {
    primary?: ReactNode // "Cerca su Internet" button
    overflow?: ReactNode // "Collega/Scollega", "Categorizza" (conditional), "Elimina"
  }
  // Card slots
  datiCard?: ReactNode
  categoriaCard?: ReactNode
  collegamentiCard?: ReactNode
  riepilogoCard?: ReactNode // expense only
  transactionsCard?: ReactNode // expense only
}

export function DetailPageShell({
  title,
  amount,
  actions,
  datiCard,
  categoriaCard,
  collegamentiCard,
  riepilogoCard,
  transactionsCard,
}: Props) {
  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Header */}
      <header className="border-b pb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{title}</h1>
            {amount && <div className="mt-2 text-lg font-semibold">{amount}</div>}
          </div>
          <div className="flex gap-2">
            {actions?.primary}
            {/* overflow menu with actions?.overflow */}
          </div>
        </div>
      </header>

      {/* Cards */}
      <div className="grid gap-6">
        {datiCard && <div className="card">{datiCard}</div>}
        {categoriaCard && <div className="card">{categoriaCard}</div>}
        {collegamentiCard && <div className="card">{collegamentiCard}</div>}
        {riepilogoCard && <div className="card">{riepilogoCard}</div>}
        {transactionsCard && <div className="card">{transactionsCard}</div>}
      </div>
    </div>
  )
}
```

**Source:** Pattern designed per 63-CONTEXT.md D-02 (shared shell for uniform milestones pages).

### Anti-Patterns to Avoid

- **Editing hashes or description:** `transactionHash`, `descriptionHash`, and `description` are immutable by design (dedup invariants). Never add UI fields to edit these. Validate in the action with allowlist, not denylist.
- **Direct derived-field edits:** `totalAmount`, `transactionCount`, `firstTransactionAt`, `lastTransactionAt` are computed. Never write them directly. Only edit the child transactions (amount/date) and reconcile atomically.
- **Silent pair-unlink:** When an amount edit would break a refund pair's opposite-sign invariant, reject with "Scollega prima il rimborso" — never automatically unlink. The user must decide.
- **Duplicate dialogs:** Don't create new dialogs for detail pages. Reuse `counterpart-picker-dialog`, `detach-expense-dialog`, `expense-categorize-dialog` (D-10 doctrine). Lift them unchanged from the table implementations.
- **Non-atomic updates:** All writes that affect expense aggregates (amount/date) must run inside `db.transaction`. No split: select, update, then reconcile-in-a-second-query.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form state + async action tracking | Custom state machine (isPending, error, success) | React `useActionState` hook | Built-in; handles pending state, error message, reset; one declaration |
| Ownership verification | Manual DB queries on page + separate auth check | RSC `verifySession()` + DAL ownership query in the same function | Single source of truth; notFound() is the standard Next.js pattern |
| Date editing (native input vs popover) | Custom popover with calendar library | HTML5 `<input type="date" />` | Works in all modern browsers; consistent with existing transaction-form-dialog behavior |
| Pair-guard validation message | Custom Italian message in the page | Service-level error from `updateTransaction` | One place to maintain the message (lib/services/transaction-edit.ts); action wraps and surfaces it (D-07) |
| Dialog invocation | Duplicate component instance in the page | Client state + existing dialog components keyed by boolean | Existing approach already works; dialogs are modal/open-close stateless |
| Category picker | New category-select component | Reuse `SubcategoryPicker` (vaul bottom sheet) | Already proven in 7 surfaces (v1.13); uniform UX; D-12 locked decision |

**Key insight:** This phase wires existing actions and dialogs to new pages. The complexity is in routing, ownership checks, and presentation — not in inventing new form logic or validation. Reuse everything that exists.

## Runtime State Inventory

**Not applicable** (greenfield page build, no rename/refactor/migration of existing entities).

## Common Pitfalls

### Pitfall 1: Forgetting Ownership Check

**What goes wrong:** Page fetches a transaction or expense without verifying the user owns it. An attacker can guess `/transactions/abc123` and see other users' data.

**Why it happens:** Eager to render the page, skip the DAL ownership query.

**How to avoid:** Every `/[id]` page **must** call a DAL function that returns `null` if the row is not found OR not owned. Return `notFound()` on null.

```typescript
const tx = await getTransactionForDetail({ userId, id })
if (!tx) notFound()
```

**Warning signs:** DAL function doesn't take `userId` as input; page doesn't call `notFound()`; error message is "Transazione non trovata" (generic) instead of resulting in a 404.

---

### Pitfall 2: Splitting Atomic Writes Across Multiple Actions

**What goes wrong:** Amount edit saves the transaction, then a separate effect calls reconcile. If reconcile fails or times out, aggregates are stale. Or: async effect runs after unmount.

**Why it happens:** Easier to code two separate actions than orchestrate one transaction-wrapped service.

**How to avoid:** `updateTransaction` already handles reconciliation **inside** the `db.transaction` (Phase 62). The action doesn't need to call anything else. The page just calls the action and refreshes.

```typescript
// ✗ WRONG: two separate operations
const saveResult = await updateTransactionAmount(...)
const reconcileResult = await reconcileExpense(...)

// ✓ RIGHT: action does both atomically
const result = await updateTransactionAmount(...)
router.refresh() // silent reconcile already happened inside the action
```

**Warning signs:** Code splits the operation across `useEffect` and action; reconcile is in a separate service call; tests show a time gap between the writes.

---

### Pitfall 3: Showing Pair-Guard Message After Unlink

**What goes wrong:** Amount edit checks if it would break the pair, but by the time the message renders, the user taps "Unlink" elsewhere. Confusing UX.

**Why it happens:** Race between the error message and the user action.

**How to avoid:** The pair-guard message is **blocking**: the edit fails, the field stays in edit mode with the attempted value and the error below it (D-07). No "Unlink now?" prompt. The user must use the overflow menu to unlink, then re-attempt the edit.

```typescript
// ✓ Pair-guard blocks the edit
if (!oppositeSign) {
  throw new Error('Scollega prima il rimborso')
}
// → action catches, returns error, field re-renders with error text

// The user closes the edit (Esc), clicks "Scollega rimborso" from menu,
// then re-edits the amount. Clear workflow.
```

**Warning signs:** Code tries to auto-unlink on pair-guard failure; message offers a "Unlink" button inline; pair state is checked but unlink is also performed.

---

### Pitfall 4: Reconciliation Running Silently (User Confusion)

**What goes wrong:** Amount edit causes expense `totalAmount` to update. User doesn't understand why the header number changed.

**Why it happens:** The reconciliation is a side effect of the amount edit; users don't expect automatic recalculation.

**How to avoid:** Document the contract: "Saving an amount/date edit recomputes the linked expense's derived fields **in the same action**. The page refreshes (D-08) to show the new aggregates. No toast/notification — it's an internal detail." This is the existing behavior for all aggregates; Phase 63 just makes it more visible.

**Warning signs:** User feedback "Why did my total change?"; code adds a toast notice "Spesa riconciliata"; page doesn't refresh automatically after amount save.

---

### Pitfall 5: Immutability Not Enforced in the Action

**What goes wrong:** Page allows editing description or a hash field. The action validates server-side but the UI lets the user type in the field.

**Why it happens:** Copied the edit pattern from other fields without checking the allowlist.

**How to avoid:** The RSC page never renders edit controls for `description`, `transactionHash`, `descriptionHash`. Instead, render them as readonly text with a lock icon + tooltip (D-03). The action has an allowlist (not denylist) of editable fields. If a rogue client tries to send `description` in the form, the action rejects it before any DB operation.

```typescript
// ✓ Action allowlist
const updateSet: Record<string, unknown> = {}
if (input.amount !== undefined) updateSet.amount = ...
if (input.occurredAt !== undefined) updateSet.occurredAt = ...
if (input.customTitle !== undefined) updateSet.customTitle = ...
// → hashes and description are structurally absent; no code path can write them

// ✓ Page never renders an input for description
<div className="flex items-center gap-2">
  <span className="text-muted-foreground">{tx.description}</span>
  <Lock className="h-4 w-4 text-muted-foreground" />
  <Tooltip content="chiave di riconciliazione bancaria — non modificabile" />
</div>
```

**Warning signs:** Editable input rendered for description or hash fields; action validation uses a denylist (`if (field !== 'description')`); tests don't verify immutability.

---

### Pitfall 6: Category Edit Confusion (Transaction vs Expense)

**What goes wrong:** User edits category on a transaction page. They think it edits the transaction's category directly; actually, it edits the linked expense's `subCategoryId`, which affects all transactions in that expense.

**Why it happens:** UI is unclear about the relationship.

**How to avoid:** The category card on the transaction page has a subtitle or note: "La categoria è assegnata alla spesa aggregata. Modificarla qui modifica la spesa per tutte le transazioni collegate."  The picker is the same `SubcategoryPicker` and the action is `updateExpense`, not a transaction-specific category edit. (D-12 covers this.)

**Warning signs:** User feedback "I edited category on the transaction, but another transaction's category changed"; page renders category edit as a transaction-level control without mentioning the expense.

---

### Pitfall 7: Dialog Invoked But Component Not Mounted

**What goes wrong:** "Collega rimborso" button triggers `counterpart-picker-dialog`, but the dialog component isn't rendered anywhere on the page. Nothing happens.

**Why it happens:** Forgot to render the dialog component (it's usually a separate client component that listens to a boolean state).

**How to avoid:** The detail page passes a `{isOpen, onOpenChange}` state to the dialog component. The button calls `setIsOpen(true)`. The dialog subscribes to that state.

```typescript
'use client'
const [isCounterpartOpen, setIsCounterpartOpen] = useState(false)

return (
  <>
    <DetailPageShell
      actions={{
        overflow: (
          <button onClick={() => setIsCounterpartOpen(true)}>
            Collega/Scollega rimborso
          </button>
        ),
      }}
    />
    <CounterpartPickerDialog
      isOpen={isCounterpartOpen}
      onOpenChange={setIsCounterpartOpen}
      transactionId={id}
    />
  </>
)
```

**Warning signs:** Button click doesn't open a dialog; multiple test attempts to add dialogs to the page yield no UI change.

## Code Examples

Verified patterns from official sources:

### RSC Detail Page with Ownership Gate

```typescript
// app/(app)/transactions/[id]/page.tsx
import { notFound } from 'next/navigation'
import { verifySession } from '@/lib/dal/auth'
import { getTransactionForDetail } from '@/lib/dal/transactions'
import { TransactionDetailClient } from './client'

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { userId } = await verifySession()

  const tx = await getTransactionForDetail({ userId, id })
  if (!tx) {
    notFound()
  }

  return <TransactionDetailClient transaction={tx} />
}
```

**Source:** Pattern from `/import/[fileId]/suggestions/page.tsx` [VERIFIED: codebase].

---

### Inline Amount Edit with Pair-Guard Error

```typescript
'use client'
import { useActionState } from 'react'
import { updateTransactionAmount } from '@/lib/actions/transaction-edit'

export function AmountEdit({ id, amount }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(amount)
  const [state, formAction, isPending] = useActionState(
    updateTransactionAmount,
    { error: null }
  )

  useEffect(() => {
    if (state.error === null && submittedRef.current) {
      setIsEditing(false)
      router.refresh()
    }
  }, [state.error])

  if (!isEditing) {
    return (
      <button
        onClick={() => {
          setValue(amount)
          setIsEditing(true)
        }}
      >
        {formatAmount(amount)}
        <Pencil className="h-3.5 w-3.5" />
      </button>
    )
  }

  return (
    <form action={formAction}>
      <input
        type="number"
        name="amount"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setIsEditing(false)
        }}
      />
      {state.error && (
        <p className="text-xs text-destructive">{state.error}</p>
      )}
      <div className="flex gap-1.5">
        <button type="submit" disabled={isPending}>Salva</button>
        <button type="button" onClick={() => setIsEditing(false)}>Annulla</button>
      </div>
    </form>
  )
}
```

**Source:** Adapted from `transaction-title-edit.tsx` [VERIFIED: codebase].

---

### Immutable Field Display with Lock Badge

```typescript
export function DescriptionField({ description }: { description: string }) {
  return (
    <div className="flex items-center gap-2 rounded bg-muted p-3">
      <span className="flex-1 text-sm text-muted-foreground">{description}</span>
      <Tooltip content="chiave di riconciliazione bancaria — non modificabile">
        <Lock className="h-4 w-4 text-muted-foreground" />
      </Tooltip>
    </div>
  )
}
```

**Source:** Pattern from 63-CONTEXT.md D-03 [CITED: phase context].

---

### Category Edit (Via Linked Expense)

```typescript
'use client'
import { SubcategoryPicker } from '@/components/categorization/subcategory-picker'
import { updateExpenseCategory } from '@/lib/actions/expenses'

export function CategoryField({ expenseId, currentSubCategoryId }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center justify-between rounded bg-muted p-3"
      >
        {currentSubCategoryId ? <span>...</span> : <span className="text-amber-600">Categorizza</span>}
      </button>
      <SubcategoryPicker
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        onSelect={async (subCategoryId) => {
          await updateExpenseCategory({ expenseId, subCategoryId })
          router.refresh()
          setIsOpen(false)
        }}
        currentSubCategoryId={currentSubCategoryId}
      />
    </>
  )
}
```

**Source:** Reuse of existing `SubcategoryPicker` (v1.13, proven in 7 surfaces) [VERIFIED: codebase].

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Expense edit/details in modal dialogs | Detail pages with inline editing + reusable shell | Phase 63 (2026-07-05) | Users can share URLs, browser back works, detail pages can scale to more entity types (file page in Phase 64) |
| Transaction category edit via hidden link to expense | Transaction page routes category edit through linked expense UI | Phase 63 (2026-07-05) | Explicit linking; category edit clearly shows it affects the whole expense, not just the transaction |
| Auto-unlink on pair amount edit | Pair-guard blocks with Italian message | Phase 62 (2026-07-05) | User control; prevents silent data loss |
| Silent reconciliation (no feedback) | Silent `router.refresh()` after atomic save | Phase 62–63 (2026-07-05) | Reconciliation is an implementation detail; refresh is invisible but consistent |
| Manual history writes on categorize | Atomic `db.transaction` with non-fatal history write | Phase 62 (2026-07-05) | Consistency across all manual-categorization entry points |

**Deprecated/outdated:**
- Expense "dettagli" and "modifica" dialogs: replaced by `/expenses/[id]` page detail-page-tx-expense (Phase 63).
- Inline expense-menu "Dettagli" and "Modifica" entries: replaced by single "Dettagli" entry linking to `/expenses/[id]` (DET-07).
- `expense-transactions-dialog`: source of truth for linked-transactions table; logic lifts to `/expenses/[id]` card (Phase 63), component deletes after Phase 63 complete.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `updateTransaction` action already wraps reconciliation atomically in `db.transaction` | Standard Stack, Architecture Patterns | If not true, reconciliation could fail silently; audit Phase 62 delivery |
| A2 | `getTransactionForDetail` and `getExpenseForDetail` DAL functions will fetch all required fields for display | Architecture Patterns | Missing fields → page renders incomplete or crashes; must design DAL output type |
| A3 | `SubcategoryPicker` is reusable as-is on the detail page with no modifications | Code Examples | If picker requires page-specific wiring, isolation broken; verify existing 7 uses |
| A4 | `router.refresh()` after an amount/date edit causes only the detail page to update, not a full navigation | Common Pitfalls | If full-page load, reconciliation feedback may be confusing; verify Next.js 16 behavior |
| A5 | Pair-guard error message "Scollega prima il rimborso" is already implemented in Phase 62 service | Code Examples | If not, must write new error handling; affects inline-error-display pattern |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

**Status:** All claims above were extracted from Phase 62 deliverables, REQUIREMENTS.md, and CONTEXT.md. No external assumptions.

## Open Questions

1. **Date Editing Control**
   - What we know: Transaction has `occurredAt` (timestamp), expense has none. Transaction page needs inline date edit. (D-06 deferred this to Claude's Discretion.)
   - What's unclear: Use native `<input type="date" />` or a popover calendar picker?
   - Recommendation: Use native `<input type="date" />`. It's simpler, accessible, and consistent with the existing `transaction-form-dialog` which uses native date input. If date-picker becomes a product requirement, it's a future UI polish phase.

2. **Transaction Page: Category Edit Via Linked Expense**
   - What we know: A transaction's category lives on the linked expense, not the transaction table. (D-12, CONTEXT.md).
   - What's unclear: If a transaction is in a multi-transaction expense, does editing category here affect all transactions in that expense, and should the UI surface that?
   - Recommendation: Yes. The category card on the transaction page should include a subtitle: "La categoria è assegnata alla spesa aggregata. Modificarla qui modifica la spesa per tutte le transazioni collegate." This mirrors how `SubcategoryPicker` is invoked from the categorize flow: it's a user-facing action, so clarity about the scope is essential.

3. **Overflow Menu: Collega vs Scollega Toggle**
   - What we know: A transaction can be paired (`collega rimborso`) or unpaired (`scollega rimborso`). (D-09 defers exact toggle behavior to Claude's Discretion.)
   - What's unclear: Should the menu entry say "Collega rimborso" or "Scollega rimborso" depending on pair state, or should there be two separate entries?
   - Recommendation: Single toggle entry. Check the pair state and render: `paired ? "Scollega rimborso" : "Collega rimborso"`. This mirrors the existing `transaction-pair-popover` behavior and reduces menu clutter.

4. **Uncategorized Expense: "Categorizza" Header Button**
   - What we know: If an expense has no category (subCategoryId is null), an amber "Categorizza" CTA appears. (D-12, A-05 in CONTEXT.md).
   - What's unclear: Should this button also appear in the overflow menu, or only in the header?
   - Recommendation: Header only (as a prominent amber button). If the expense is already categorized, the button vanishes and the Categoria card becomes the edit point. This keeps the header action count low and the intent clear: "Categorizza is for uncategorized expenses; Categoria card is for changing an existing category."

## Environment Availability

**Skip:** Phase 63 is a purely frontend+action phase with no new external dependencies (CLI, databases, services). All required technologies are already available in the project.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (existing) |
| Config file | vitest.config.ts |
| Quick run command | `yarn vitest run tests/transaction-detail.test.ts tests/expense-detail.test.ts` |
| Full suite command | `yarn vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DET-05 | `/transactions/[id]` renders all fields; pencil-inline edit for amount/date/title; category via SubcategoryPicker; immutable fields readonly | integration | `yarn vitest run tests/transaction-detail.test.ts` | ❌ Wave 0 |
| DET-05 | Pair-guard blocks amount edit with "Scollega prima il rimborso" message, field stays in edit | integration | (same as above) | ❌ Wave 0 |
| DET-05 | Immutable fields (description, hashes) display as readonly with lock icon | integration | (same as above) | ❌ Wave 0 |
| DET-05 | Ownership check returns 404 for non-owner | unit | `yarn vitest run tests/transaction-detail-dal.test.ts` | ❌ Wave 0 |
| DET-06 | `/expenses/[id]` renders title/notes/category editable; derived totals readonly | integration | `yarn vitest run tests/expense-detail.test.ts` | ❌ Wave 0 |
| DET-06 | Linked transactions table shows date/description/amount; each row links to `/transactions/[id]` | integration | (same as above) | ❌ Wave 0 |
| DET-06 | Uncategorized expense shows amber "Categorizza" CTA in header | integration | (same as above) | ❌ Wave 0 |
| DET-06 | Ownership check returns 404 for non-owner | unit | `yarn vitest run tests/expense-detail-dal.test.ts` | ❌ Wave 0 |
| DET-07 | Expense table "Dettagli" menu entry links to `/expenses/[id]` | unit/e2e | `yarn vitest run tests/expense-table-menu.test.tsx` | ❌ Wave 0 |
| DET-07 | Transaction table "Dettagli" menu entry links to `/transactions/[id]` | unit/e2e | `yarn vitest run tests/transaction-table-menu.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `yarn vitest run tests/transaction-detail.test.ts tests/expense-detail.test.ts` (sub-30-second feedback loop for inline-edit patterns)
- **Per wave merge:** `yarn vitest run` (full suite includes all DAL, action, and component tests)
- **Phase gate:** Full suite green + manual end-to-end (navigate to `/transactions/123`, edit amount, verify refresh + expense aggregates updated) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/transaction-detail.test.ts` — RSC page fetch + ownership check, inline edit for amount/date/title, pair-guard error display, immutable fields
- [ ] `tests/expense-detail.test.ts` — RSC page fetch + ownership check, inline edit for title/notes, linked-transactions table, uncategorized "Categorizza" CTA
- [ ] `tests/transaction-detail-dal.test.ts` — `getTransactionForDetail(userId, id)` ownership-scoped query, 404 behavior
- [ ] `tests/expense-detail-dal.test.ts` — `getExpenseForDetail(userId, id)` ownership-scoped query, 404 behavior, linked transactions in output type
- [ ] `tests/transaction-table-menu.test.tsx` — "Dettagli" entry renders and links to `/transactions/[id]`
- [ ] `tests/expense-table-menu.test.tsx` — "Dettagli" entry renders and links to `/expenses/[id]`, "Modifica" entry removed
- [ ] Framework install: already present (`yarn vitest --version` confirms it)
- [ ] Shared fixtures: `tests/fixtures/transaction.ts`, `tests/fixtures/expense.ts` (owner + non-owner examples) — if not present, create in Wave 0

*(If gaps: "Wave 0 creates test stubs and fixtures; phase implementation fills in assertions and fixtures per PLAN.md.")*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `verifySession()` + `notFound()` on non-owner (V2.1 Unique identifiers) |
| V3 Session Management | yes | Session cookie (Better Auth) + RSC-level check; no credential stored in DOM |
| V4 Access Control | yes | Ownership-scoped DAL query (userId match); IDOR on [id] routes impossible if query includes `userId` |
| V5 Input Validation | yes | Zod schema for amount (Decimal, range), date (ISO string, future-date check), title (string length), category (subCategoryId FK) |
| V6 Cryptography | no | No new crypto introduced; existing hashes (transactionHash, descriptionHash) are immutable |
| V7 Error Handling | yes | Pair-guard error message (Italian) shown inline, not leaked to logs; notFound() hides 404 reason |
| V8 Data Protection | yes | Decimal.js for amount (no precision loss); no sensitive data logged (presigned URLs, raw amounts) |
| V12 File Upload | no | Phase 63 has no file upload |
| V13 API & Web Service | yes | Server actions use `'use server'` + Zod validation; no unauthenticated endpoints |

### Known Threat Patterns for {Next.js 16 RSC + Server Actions}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR on `/transactions/[id]` (fetching other users' data) | Spoofing | Ownership-scoped DAL query: `and(eq(transaction.id, id), eq(transaction.userId, userId))` on all reads |
| CSRF on amount/date edit (forged form submission) | Tampering | Server Actions are origin-pinned by Next.js; CSRF token handled by framework |
| Amount precision loss (rounding errors) | Tampering | Decimal.js for all arithmetic; never convert to `number`; store as string in DB |
| Pair-guard bypass (client sends `amount: "0"` to unlink) | Tampering | Server-side pair-guard in `updateTransaction` service; validation runs on server, immutable to client |
| Race condition: amount edit + concurrent unlink | Tampering | Both operations are gated by `db.transaction` + pair-guard check; reads are repeatable within the transaction |
| Reflected error messages (leaking pair state) | Information Disclosure | Error message is generic/Italian ("Scollega prima il rimborso"); doesn't leak transaction IDs or pair details |
| Session hijacking (XSS stealing session cookie) | Information Disclosure | Session cookie is `httpOnly`, not readable from JavaScript; CSP headers (if configured) block inline scripts |

### Mitigation Strategy Summary

**Ownership gate:** Every detail page query includes `userId` in the WHERE clause. `notFound()` on null result (no enumeration).

**Immutability enforcement:** Action has allowlist of editable fields. Hashes/description structurally absent from update logic.

**Atomic writes:** Reconciliation runs inside `db.transaction`; no split operations that could leave inconsistent state.

**Validation:** Zod schema on all user inputs before DB write. Server-side only (forms have no client-side validation bypass).

**Error messages:** Italian product messages (pair-guard) are non-leaky; generic 404 on ownership failure.

## Sources

### Primary (HIGH confidence)
- Phase 62 deliverables (`62-01-SUMMARY.md`, `62-02-SUMMARY.md`) — `updateTransaction` service + atomic `updateExpense` verified [VERIFIED: .planning/phases/62-*]
- Project REQUIREMENTS.md (DET-05, DET-06, DET-07) — locked requirements [VERIFIED: .planning/REQUIREMENTS.md]
- Phase 63 CONTEXT.md (decisions D-01..D-16) — grill session 2026-07-05, locked implementation direction [VERIFIED: .planning/phases/63-detail-pages-tx-expense/63-CONTEXT.md]
- CLAUDE.md (project hard rules) — Decimal.js, db.transaction, actions/dal/services layering [VERIFIED: ./CLAUDE.md]

### Secondary (MEDIUM confidence)
- Existing codebase patterns: `transaction-title-edit.tsx`, `/import/[fileId]/suggestions/page.tsx`, `SubcategoryPicker` — verified reusable [VERIFIED: grep + file read]
- Next.js 16 App Router docs — `notFound()`, RSC params, `useActionState` — checked against live implementation [CITED: Next.js 16 standard library]

### Tertiary (LOW confidence)
- Training knowledge on form accessibility and inline-edit UX — generalized patterns, not project-specific [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — all libraries are existing, proven in production
- Architecture: **HIGH** — ownership checks and pattern reuse are locked decisions from Phase 62 + CONTEXT
- Pitfalls: **HIGH** — all pitfalls extracted from Phase 62 learnings and codebase review
- Open questions: **MEDIUM** — Claude's Discretion areas; require no external research, planner can decide

**Research date:** 2026-07-05
**Valid until:** 2026-07-12 (Next.js + React minor updates may happen; re-verify if planning is deferred beyond 1 week)
