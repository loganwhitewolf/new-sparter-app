# Phase 54: reusable-trigger - Pattern Map

**Mapped:** 2026-06-20
**Files analyzed:** 6 files to create or modify
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `lib/actions/import.ts` (modify: add `recheckRegexAction`) | action | request-response | `lib/actions/patterns.ts` → `promoteSuggestionAction` | exact |
| `lib/services/import.ts` (modify: TRIG-01 post-commit discovery) | service | CRUD | same file, pattern established by `categorizePipeline` post-tx call | exact |
| `app/(app)/import/[fileId]/suggestions/page.tsx` (modify: migrate detector) | page (Server Component) | request-response | current file — structural shell stays; only data source changes | exact |
| `components/import/import-row-actions.tsx` (modify: add "ricontrolla regex" item) | component | request-response | same file — existing `DropdownMenuItem` for "Rivedi suggerimenti" | exact |
| `components/import/import-table.tsx` (audit: how `ImportRowActions` is wired to trigger client action) | component | event-driven | `components/patterns/pattern-actions.tsx` | role-match |

---

## Pattern Assignments

---

### `lib/actions/import.ts` — add `recheckRegexAction`

**Analog:** `lib/actions/patterns.ts`, `promoteSuggestionAction` (lines 225–325)

**Auth / session pattern** (lines 228–230 of `patterns.ts`):
```typescript
export async function promoteSuggestionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { userId } = await verifySession();
```
Note: `verifySession()` returns `{ userId }` directly — no try/catch needed; it throws on unauthenticated session (middleware handles that).

**FileId → platformId ownership-guard pattern** (lines 235–244 of `patterns.ts`):
```typescript
const fileId = formData.get("fileId");
if (!fileId || typeof fileId !== "string" || fileId.trim() === "") {
  return { error: "File di import non valido." };
}

const platformId = await getPlatformIdForUserFile({ userId, fileId });
if (platformId == null) {
  return { error: "Impossibile determinare la piattaforma per questo file." };
}
```
`getPlatformIdForUserFile` is already imported in `patterns.ts` from `@/lib/dal/files` — import it the same way in `import.ts`.

**Return type:** Use the existing `ImportActionState<T>` already declared in `import.ts` (line 47–50):
```typescript
export type ImportActionState<T = null> = {
  error: string | null;
  data?: T;
};
```
The new action should return `ImportActionState<{ candidatesCount: number; singleCount: number; platformId: number }>` so the client can branch on empty vs non-empty.

**Calling the service post-auth:**
```typescript
// After getting userId and platformId:
try {
  const result = await discoverRegexCandidates({ userId, scope: { platformId } });
  return {
    error: null,
    data: {
      candidatesCount: result.candidates.length,
      singleCount: result.singleCategorizationSuggestions.length,
      platformId: result.platformId,
    },
  };
} catch {
  return { error: "Impossibile eseguire il riconoscimento pattern. Riprova tra qualche secondo." };
}
```

**No `revalidatePath` needed** — action is read-only (discovery does not mutate state).

---

### `lib/services/import.ts` — TRIG-01: post-commit discovery call

**Analog:** same file — `importFile`, lines 484–667

**Transaction boundary** (lines 484–665): `db.transaction(async (tx) => { ... })` returns a typed result object. The `return result` at line 667 is **outside** the transaction. This is the correct injection point for the post-commit discovery call.

**Post-commit call structure** (insert after line 667, before the final `return result`):
```typescript
    return result   // <-- this is the existing return from db.transaction

  } catch (error) {
    // existing error handling
  }

  // TRIG-01: run discovery post-commit (outside db.transaction — service contract)
  // Non-fatal: import is already committed; discovery failure must not throw.
  let discoveryCount = 0
  try {
    const platformId = await getPlatformIdForUserFile({ userId: input.userId, fileId: input.fileId })
    if (platformId != null) {
      const discovery = await discoverRegexCandidates({ userId: input.userId, scope: { platformId } })
      discoveryCount = discovery.candidates.length + discovery.singleCategorizationSuggestions.length
    }
  } catch (err) {
    logger.warn({
      event: 'post_import_discovery_failed',
      message: err instanceof Error ? err.message : String(err),
      userId: input.userId,
      fileId: input.fileId,
    })
  }

  return { ...result, discoveryCount }
```

**`ImportFileResult` type extension** (line 59–66): Add `discoveryCount: number` field:
```typescript
export type ImportFileResult = {
  fileId: string
  rowCount: number
  duplicateCount: number
  importedCount: number
  warnings: string[]
  errors: string[]
  discoveryCount: number   // <-- add: 0 when discovery fails or finds nothing
}
```

**Legacy block to replace** (lines 298–323, annotated `// TODO Phase 55: remove`):
The block in `analyzeFile` (not `importFile`) calls `detectPatternSuggestions` and populates `patternSuggestions`. This is inside `analyzeFile`, not `importFile`. The TRIG-01 replacement goes in `importFile` (post-commit); the `analyzeFile` block can remain or be removed per planner's discretion. The two functions are separate.

---

### `app/(app)/import/[fileId]/suggestions/page.tsx` — migrate from legacy detector

**Current structure** (full file, 73 lines):

```typescript
// Current imports to REMOVE:
import { getUncategorizedTransactionsByFileId } from '@/lib/dal/transactions'
import { loadActivePatterns } from '@/lib/services/categorization'
import { detectPatternSuggestions, type PatternDetectorRow } from '@/lib/utils/pattern-suggestions'
import { normalizeDescription } from '@/lib/utils/import'

// Current data fetch to REMOVE (lines 33–46):
const [uncategorizedTxs, activePatterns, categories] = await Promise.all([...])
const detectorRows: PatternDetectorRow[] = uncategorizedTxs.map(...)
const raw = detectPatternSuggestions(detectorRows, activePatterns)
const patternSuggestions = raw.sort(...).slice(0, 5)
```

**Replacement imports to ADD:**
```typescript
import { discoverRegexCandidates } from '@/lib/services/regex-discovery'
import { getCategories } from '@/lib/dal/categories'
```

**Replacement data fetch** (D-04: platform-scoped, not file-scoped):
```typescript
// Keep these guards (lines 22–30 of current file — do not change):
const fileRow = await getFileForUser({ userId, fileId })
if (!fileRow || fileRow.status !== 'imported') { notFound() }

const platformId = await getPlatformIdForUserFile({ userId, fileId })
if (platformId == null) { notFound() }

// Replace the uncategorized fetch + pattern detection with:
const [discovery, categories] = await Promise.all([
  discoverRegexCandidates({ userId, scope: { platformId } }),
  getCategories(),
])
// discovery.candidates — regex suggestions (PatternSuggestionWithMeta[])
// discovery.singleCategorizationSuggestions — identical groups (SingleCategorizationSuggestion[])
```

**Render branch:** Pass `discovery.candidates` and `discovery.singleCategorizationSuggestions` to `SuggestionSection`. Minimal rendering for Phase 54 — full visual separation is Phase 55. Empty-state check becomes `discovery.candidates.length === 0 && discovery.singleCategorizationSuggestions.length === 0`.

---

### `components/import/import-row-actions.tsx` — add "ricontrolla regex" row action

**Analog:** same file, lines 101–117 — existing `DropdownMenuItem` for "Rivedi suggerimenti":
```typescript
{row.status === 'imported' && (
  <DropdownMenuItem asChild>
    <Link href={`/import/${encodeURIComponent(row.id)}/suggestions`}>
      <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
      Rivedi suggerimenti
    </Link>
  </DropdownMenuItem>
)}
```

**New "ricontrolla regex" item:** NOT a `<Link>` — it triggers the `recheckRegexAction` then navigates conditionally. Replace with a clickable `DropdownMenuItem` calling a callback prop (same pattern as `onRename`/`onDelete`):

```typescript
// Props extension (line 18–22):
type Props = {
  row: ImportListRow
  displayName: string
  onRename: (row: ImportListRow) => void
  onDelete: (row: ImportListRow) => void
  onDeleteStale: (row: ImportListRow) => void
  onRecheckRegex: (row: ImportListRow) => void   // <-- add
  isRecheckPending?: boolean                      // <-- add for loading state
}
```

**New menu item** (add after existing "Rivedi suggerimenti" item):
```typescript
{row.status === 'imported' && (
  <DropdownMenuItem
    onClick={() => onRecheckRegex(row)}
    disabled={isRecheckPending}
  >
    <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
    {isRecheckPending ? 'Ricerca in corso…' : 'Ricontrolla regex'}
  </DropdownMenuItem>
)}
```

**Loading state:** The `disabled={isRecheckPending}` pattern mirrors existing disabled usage in `pattern-actions.tsx` (line 196: `disabled={isEditPending || !subCategoryId}`).

---

### `components/import/import-table.tsx` — wire `onRecheckRegex` callback

**Analog:** `components/patterns/pattern-actions.tsx` — `useActionState` + `useEffect` + `toast` + navigation.

**Toast library:** `sonner` — import as:
```typescript
import { toast } from 'sonner'
```
This is how it is used in `pattern-actions.tsx` (line 4). Same import path everywhere.

**Toast call patterns from `pattern-actions.tsx`** (lines 81–84):
```typescript
// success:
toast.success('Pattern aggiornato.')

// For empty-result (TRIG-02, D-06) — use toast.info or toast (neutral):
toast('Nessun pattern trovato per questa piattaforma')
```

**Router navigation pattern** — from `components/import/import-format-wizard.tsx` (lines 135, 173, 186–191):
```typescript
import { useRouter } from 'next/navigation'
// ...
const router = useRouter()
// After successful action:
router.push(`/import/${encodeURIComponent(fileId)}/suggestions`)
```

**Full client-side flow for the re-check** (implement in `import-table.tsx` or a dedicated hook):
```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { recheckRegexAction } from '@/lib/actions/import'

// Inside the component that renders ImportRowActions:
const router = useRouter()
const [recheckPending, setRecheckPending] = useState(false)

async function handleRecheckRegex(row: ImportListRow) {
  setRecheckPending(true)
  const formData = new FormData()
  formData.set('fileId', row.id)
  const result = await recheckRegexAction(formData)
  setRecheckPending(false)

  if (result.error) {
    toast.error(result.error)
    return
  }

  const total = (result.data?.candidatesCount ?? 0) + (result.data?.singleCount ?? 0)
  if (total === 0) {
    toast('Nessun pattern trovato per questa piattaforma')
    return
  }

  router.push(`/import/${encodeURIComponent(row.id)}/suggestions`)
}
```

Note: `recheckRegexAction` is a plain async function (no `useActionState`) because navigation logic must happen after await. This matches how `completeOnboardingAction` is called directly in `import-format-wizard.tsx` (line 165: `void completeOnboardingAction(formData).then(...)`).

---

## Shared Patterns

### Auth / session resolution
**Source:** `lib/actions/import.ts` (line 325–326) and `lib/actions/patterns.ts` (line 75)
**Apply to:** `recheckRegexAction`
```typescript
const { userId } = await verifySession();
// OR with subscriptionPlan:
const { userId, subscriptionPlan } = await verifySession();
```
`verifySession` is imported from `@/lib/dal/auth`. Discovery does not need `subscriptionPlan` — `userId` only.

### fileId → platformId ownership guard
**Source:** `lib/actions/patterns.ts` (lines 235–244)
**Apply to:** `recheckRegexAction` in `lib/actions/import.ts`
```typescript
import { getPlatformIdForUserFile } from '@/lib/dal/files'

const platformId = await getPlatformIdForUserFile({ userId, fileId });
if (platformId == null) {
  return { error: "Impossibile determinare la piattaforma per questo file." };
}
```

### Action error shape
**Source:** `lib/actions/import.ts` (line 47–50)
**Apply to:** `recheckRegexAction`
```typescript
export type ImportActionState<T = null> = {
  error: string | null;
  data?: T;
};
```

### Toast (sonner)
**Source:** `components/patterns/pattern-actions.tsx` (line 4)
**Apply to:** any client component that calls `recheckRegexAction`
```typescript
import { toast } from 'sonner'
// Usage:
toast.success('...')    // green — on success
toast.error('...')      // red — on action error
toast('...')            // neutral — on empty result (D-06)
```

### Post-transaction, non-fatal service call
**Source:** `lib/services/import.ts` — the `categorizePipeline` try/catch inside the tx loop (lines 558–562) and the `applyNewPatternToPlatformExpenses` try/catch in `patterns.ts` (lines 315–321).
**Apply to:** TRIG-01 post-commit discovery in `importFile`
```typescript
// Non-fatal: wrap in try/catch, log warning, never throw
try {
  const discovery = await discoverRegexCandidates(...)
} catch (err) {
  logger.warn({ event: 'post_import_discovery_failed', ... })
}
```

---

## Service Contract Reference

**Source:** `lib/services/regex-discovery.ts` (lines 1–139)

```typescript
// Types (lines 16–30):
export type DiscoveryScope = { platformId: number }

export type SingleCategorizationSuggestion = {
  normalizedDescription: string
  sampleDescriptions: string[]
  matchCount: number
  descriptionHashes: string[]
}

export type DiscoveryResult = {
  candidates: PatternSuggestionWithMeta[]          // regex families (RDISC-01)
  singleCategorizationSuggestions: SingleCategorizationSuggestion[]  // identical groups (RDISC-02)
  totalUncategorized: number
  platformId: number
}

// Function signature (line 72):
export async function discoverRegexCandidates(input: {
  userId: string
  scope: DiscoveryScope
}): Promise<DiscoveryResult>
```

**Key constraints:**
- Post-transaction only (no `tx` handle accepted)
- Auth is caller's responsibility (`userId` must be verified before call)
- Platform-scoped Set B (all uncategorized expenses for user + platform, not just one file)
- `candidates.length === 0 && singleCategorizationSuggestions.length === 0` → zero result, show toast, do not navigate

---

## No Analog Found

None — all files have close analogs in the codebase.

---

## Metadata

**Analog search scope:** `lib/actions/`, `lib/services/`, `components/import/`, `components/patterns/`, `app/(app)/import/`
**Files scanned:** 10
**Pattern extraction date:** 2026-06-20
