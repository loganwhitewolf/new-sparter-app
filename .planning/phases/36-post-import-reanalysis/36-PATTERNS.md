# Phase 36: post-import-reanalysis - Pattern Map

**Mapped:** 2026-05-23
**Files analyzed:** 4 (1 modified component, 1 new page, 1 new DAL function, 0 net-new service logic)
**Analogs found:** 4 / 4

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `components/import/import-row-actions.tsx` | component | request-response | self (modify existing) | exact |
| `app/(app)/import/[fileId]/suggestions/page.tsx` | component (server) | request-response | `app/(app)/import/[fileId]/analyze/page.tsx` | exact |
| `lib/dal/transactions.ts` (new function) | dal | CRUD read | `lib/dal/transactions.ts#getTransactions` | exact |
| `lib/services/import.ts#analyzeFile` | service | transform | self (pattern to replicate, not modify) | exact |

---

## Pattern Assignments

### `components/import/import-row-actions.tsx` — add DropdownMenuItem for `status='imported'`

**Analog:** self — insert alongside existing `status === 'imported'` block (lines 101–108)

**Existing `status='imported'` DropdownMenuItem pattern** (lines 101–108):
```tsx
{row.status === 'imported' && (
  <DropdownMenuItem asChild>
    <Link href={`/transactions?importId=${encodeURIComponent(row.id)}`}>
      <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
      Vedi transazioni
    </Link>
  </DropdownMenuItem>
)}
```

**What to add:** A second `DropdownMenuItem` immediately after the "Vedi transazioni" item, sharing the same `row.status === 'imported'` guard:
```tsx
{row.status === 'imported' && (
  <DropdownMenuItem asChild>
    <Link href={`/import/${encodeURIComponent(row.id)}/suggestions`}>
      <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
      Rivedi suggerimenti
    </Link>
  </DropdownMenuItem>
)}
```

Note: icon choice (`Sparkles`, `Search`, or similar from lucide-react) is at Claude's discretion per CONTEXT.md. The `ExternalLink` icon on line 4 of the Vedi-transazioni block shows the exact import/usage pattern for lucide icons (`import { ..., Sparkles } from 'lucide-react'` at line 4 of the file).

**Imports already present** (lines 1–14):
```tsx
'use client'

import Link from 'next/link'
import { Clock, ExternalLink, MoreHorizontal, Pencil, Settings, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ImportListRow } from '@/lib/dal/imports'
import { isInProgress, isUnknownFormatFailed } from '@/lib/utils/import-status'
```

Only the lucide import line needs to be extended with the chosen icon.

---

### `app/(app)/import/[fileId]/suggestions/page.tsx` — new server component page

**Analog:** `app/(app)/import/[fileId]/analyze/page.tsx` (exact role + data flow match)

**Imports pattern** (analog lines 1–11):
```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCategories } from '@/lib/dal/categories'
import { SuggestionSection } from '@/components/import/suggestion-section'
// new for phase 36:
import { getFileForUser } from '@/lib/dal/files'
import { getUncategorizedTransactionsByFileId } from '@/lib/dal/transactions'
import { loadActivePatterns } from '@/lib/services/categorization'
import { detectPatternSuggestions } from '@/lib/utils/pattern-suggestions'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/dal/auth'
import type { PatternDetectorRow } from '@/lib/utils/pattern-suggestions'
```

**Page signature pattern** (analog lines 28–37):
```tsx
export default async function SuggestionsPage({
  params,
}: {
  params: Promise<{ fileId: string }>
}) {
  const { fileId } = await params
  const { userId } = await verifySession()
  // ...
}
```

**Ownership guard pattern** (analog lines 50–54 adapted for this page):
```tsx
const fileRow = await getFileForUser({ userId, fileId })
if (!fileRow || fileRow.status !== 'imported') {
  notFound()
}
```

`getFileForUser` from `lib/dal/files.ts` (lines 56–67) does `eq(file.id, fileId) AND eq(file.userId, userId)` — covers ownership in a single call, no separate query needed.

**Parallel data fetch pattern** (analog lines 45–48):
```tsx
const [uncategorizedTxs, activePatterns, categories] = await Promise.all([
  getUncategorizedTransactionsByFileId(db, fileId, userId),
  loadActivePatterns(db, userId),
  getCategories(),
])
```

**Adapter + detection + sort/cap pattern** (from `lib/services/import.ts` lines 301–310):
```tsx
const detectorRows: PatternDetectorRow[] = uncategorizedTxs.map((t) => ({
  description: t.description,
  normalizedDescription: t.description,  // persisted transactions have no separate normalized field
  amount: t.amount,
  valid: true,   // persisted transactions are already valid (they were imported)
  covered: false,
}))
const raw = detectPatternSuggestions(detectorRows, activePatterns)
const patternSuggestions = raw
  .sort((a, b) => b.matchCount - a.matchCount)
  .slice(0, 5)
```

**Empty state pattern** (D-07 — inline text, no card):
```tsx
{patternSuggestions.length === 0 ? (
  <p className="text-sm text-muted-foreground">
    Nessun suggerimento trovato — tutte le transazioni risultano già categorizzate
    o non sono stati rilevati pattern ricorrenti.
  </p>
) : (
  <SuggestionSection suggestions={patternSuggestions} categories={categories} />
)}
```

**Page heading + subtitle pattern** (analog lines 79–85, adapted for D-08):
```tsx
<div className="flex flex-col gap-6">
  <div>
    <h1 className="text-xl font-semibold">Suggerimenti pattern</h1>
    <p className="mt-1 text-sm text-muted-foreground">
      Crea pattern per categorizzare automaticamente transazioni simili nelle prossime importazioni.
    </p>
  </div>
  {/* empty state or SuggestionSection */}
</div>
```

**Error/not-found: no try/catch needed** — this page does not call fallible network operations (no R2, no external I/O). DAL throws on DB errors; Next.js will surface a 500. `notFound()` is the only explicit guard needed (ownership + status check).

---

### `lib/dal/transactions.ts` — add `getUncategorizedTransactionsByFileId`

**Analog:** `getTransactions` (lines 131–204) — same file, same join pattern

**Imports already present** (lines 1–19) — all needed operators (`and`, `eq`, `isNull`) are already imported. The `importFile` alias for the `file` schema table is already imported at line 9.

**Function signature pattern** (mirrors `getDuplicateHashes` at lines 251–269 — non-cached, takes `DbOrTx`):
```ts
export async function getUncategorizedTransactionsByFileId(
  database: DbOrTx,
  fileId: string,
  userId: string,
): Promise<Array<{ description: string; amount: string }>>
```

Not wrapped in `cache()` — called once per server render, no benefit.

**Query pattern** — minimal select, ownership join, `expenseId IS NULL` filter:
```ts
return database
  .select({
    description: transaction.description,
    amount: transaction.amount,
  })
  .from(transaction)
  .innerJoin(importFile, eq(transaction.fileId, importFile.id))
  .where(
    and(
      eq(transaction.fileId, fileId),
      eq(importFile.userId, userId),
      isNull(transaction.expenseId),
    ),
  )
```

`isNull` is already imported at line 3. `importFile` alias is already imported at line 9. No additional imports required.

**Why `innerJoin` not `leftJoin`:** `transaction.fileId` is non-null for all file imports, and ownership must be enforced — an inner join on `importFile` naturally filters out rows where the file doesn't belong to the user and doubles as the ownership guard (consistent with D-03). Compare with `getTransactions` lines 182–183 which uses `leftJoin` for the nullable `fileId` case — this function's `fileId` is always non-null by contract.

**Why not `verifySession()`:** This function is called from the server component which already called `verifySession()`. Passing `userId` explicitly keeps it composable and avoids a redundant session check — consistent with the pattern of `getDuplicateHashes`, `insertTransactionBatch`, etc. which all accept explicit `userId`.

---

## Shared Patterns

### `notFound()` ownership guard
**Source:** `app/(app)/import/[fileId]/analyze/page.tsx` (line 51–53) and `lib/dal/files.ts#getFileForUser` (lines 56–67)
**Apply to:** `suggestions/page.tsx`
```tsx
const fileRow = await getFileForUser({ userId, fileId })
if (!fileRow || fileRow.status !== 'imported') {
  notFound()
}
```
`getFileForUser` already enforces `userId` ownership via `eq(file.userId, input.userId)` — no separate ownership query needed.

### `verifySession()` in server components
**Source:** All DAL functions (`lib/dal/categories.ts` line 139, `lib/dal/transactions.ts` line 136)
**Apply to:** `suggestions/page.tsx` — call once at the top, pass `userId` to DAL functions that require it:
```tsx
const { userId } = await verifySession()
```

### Pattern detection pipeline (sort + cap 5)
**Source:** `lib/services/import.ts#analyzeFile` (lines 297–321)
**Apply to:** `suggestions/page.tsx`
```ts
const raw = detectPatternSuggestions(detectorRows, activePatterns)
const patternSuggestions = raw
  .sort((a, b) => b.matchCount - a.matchCount)
  .slice(0, 5)
```
Wrap in try/catch with `logger.warn` only if there is a realistic failure path. For the suggestions page, `detectPatternSuggestions` is a pure function with no I/O — no try/catch needed. The try/catch in `analyzeFile` exists because it is inside a larger pipeline where partial failure must be non-fatal. Here the full page is dedicated to this operation; an unexpected throw can surface normally as a 500.

### `loadActivePatterns` call signature
**Source:** `lib/services/categorization.ts` (lines 32–62) and `lib/services/import.ts` line 300
**Apply to:** `suggestions/page.tsx`
```ts
const activePatterns = await loadActivePatterns(db, userId)
```
Pass `db` (not a transaction) since this is a read-only server component context.

### `SuggestionSection` props contract
**Source:** `components/import/suggestion-section.tsx` (lines 6–10)
```tsx
type Props = {
  suggestions: PatternSuggestion[]
  categories: CategoryWithSubCategories[]
}
```
No additional props. Reuse as-is — D-05 explicitly prohibits adding props.

### `promoteSuggestionAction` — no modification
**Source:** `lib/actions/patterns.ts` (lines 149–184)
Reuse as-is. The action is already exported and available to `SuggestionCard`/`SuggestionPromoteForm` through their existing internal wiring. The new page does not wire the action directly — it passes props to `SuggestionSection` which handles action invocation internally.

---

## No Analog Found

None. All files have direct analogs in the codebase.

---

## Metadata

**Analog search scope:** `app/(app)/import/`, `lib/dal/`, `lib/services/`, `lib/actions/`, `components/import/`, `lib/utils/`
**Files read:** 8 source files
**Pattern extraction date:** 2026-05-23
