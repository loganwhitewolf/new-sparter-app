# Phase 53: retroactive-application - Pattern Map

**Mapped:** 2026-06-16
**Files analyzed:** 13
**Analogs found:** 13 / 13

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/dal/regex-discovery.ts` | model (DAL query) | CRUD (read) | `getUncategorizedExpensesForDiscovery` (same file) | exact |
| `lib/dal/files.ts` | model (DAL query) | CRUD (read) | `getFileForUser` (same file) | exact |
| `lib/services/pattern-application.ts` | service | batch + transform | `applyNewPatternToExpenses` (same file) | exact |
| `lib/actions/patterns.ts` | controller (Server Action) | request-response | `promoteSuggestionAction` + `createPatternAction` (same file) | exact |
| `lib/validations/pattern.ts` | utility (types/schema) | transform | `ImportActionState<T>` in `lib/actions/import.ts` | role-match |
| `app/(app)/import/[fileId]/suggestions/page.tsx` | route (RSC) | request-response | same file (existing suggestions page) | exact |
| `components/import/suggestion-section.tsx` | component | request-response | same file (prop threading) | exact |
| `components/import/suggestion-card.tsx` | component | request-response | same file + `import-format-wizard.tsx` success state | exact |
| `components/import/suggestion-promote-form.tsx` | component + hook | request-response | same file | exact |
| `tests/pattern-application.test.ts` | test | batch | `tests/regex-discovery-service.test.ts` | role-match |
| `tests/pattern-actions.test.ts` | test | request-response | same file `promoteSuggestionAction` block | exact |
| `tests/suggestion-card.test.tsx` | test | request-response | same file | exact |
| `tests/suggestion-promote-form.test.tsx` | test | request-response | same file | exact |

## Pattern Assignments

### `lib/dal/regex-discovery.ts` — add `getUncategorizedExpensesForPlatformApply` (model, CRUD read)

**Analog:** `getUncategorizedExpensesForDiscovery` in the same file (lines 34–56)

**Imports pattern** (lines 1–10):

```typescript
import 'server-only'
import { db } from '@/lib/db'
import {
  expense,
  file,
  importFormatVersion,
  platform,
} from '@/lib/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
```

**Core platform-scoped Set B query** (lines 38–55) — copy join chain and WHERE verbatim; change SELECT to `{ id, title, totalAmount }` for apply:

```typescript
return db
  .select({
    id: expense.id,
    title: expense.title,
    descriptionHash: expense.descriptionHash,
    descriptionStripPattern: platform.descriptionStripPattern,
  })
  .from(expense)
  .leftJoin(file, eq(expense.importedFromFileId, file.id))
  .leftJoin(importFormatVersion, eq(file.importFormatVersionId, importFormatVersion.id))
  .leftJoin(platform, eq(importFormatVersion.platformId, platform.id))
  .where(
    and(
      eq(expense.userId, userId),
      eq(platform.id, platformId),
      isNull(expense.subCategoryId),
    ),
  )
```

**Test pattern** — mirror `tests/regex-discovery-dal.test.ts` (lines 116–171): assert 3 `leftJoin`s, `eq(expense.userId)`, `eq(platform.id)`, `isNull(expense.subCategoryId)`.

**Planner note:** Prefer internal shared WHERE builder or sibling function over duplicating join strings in the service layer.

---

### `lib/dal/files.ts` — add `getPlatformIdForUserFile` (model, CRUD read)

**Analog:** `getFileForUser` (lines 56–67) + platform join from `lib/dal/imports.ts` (lines 168–173)

**Ownership-scoped single-row fetch** (lines 56–67):

```typescript
export async function getFileForUser(
  input: { userId: string; fileId: string },
  database: DbOrTx = db,
): Promise<FileRow | null> {
  const rows = await database
    .select()
    .from(file)
    .where(and(eq(file.id, input.fileId), eq(file.userId, input.userId)))
    .limit(1)

  return rows[0] ?? null
}
```

**File → platform join precedent** (`lib/dal/imports.ts` lines 168–173):

```typescript
.from(file)
.leftJoin(
  importFormatVersion,
  eq(file.importFormatVersionId, importFormatVersion.id),
)
.leftJoin(platform, eq(importFormatVersion.platformId, platform.id))
```

**New helper shape:** `select({ platformId: platform.id })` with same ownership WHERE as `getFileForUser`; return `rows[0]?.platformId ?? null`. Accept `DbOrTx` defaulting to `db` like other helpers in this file.

---

### `lib/services/pattern-application.ts` — add `applyNewPatternToPlatformExpenses` (service, batch + transform)

**Analog:** `applyNewPatternToExpenses` (lines 16–101)

**Imports pattern** (lines 1–6):

```typescript
import 'server-only'
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import type { DbOrTx } from '@/lib/db'
import { expense } from '@/lib/db/schema'
import { writeClassificationHistory } from '@/lib/dal/classification-history'
import { normalizeDescription } from '@/lib/utils/import'
```

**Structured result type** (new — follow RESEARCH naming):

```typescript
export type PatternApplyResult = {
  updatedCount: number
  notUpdatedCount: number
}
```

**Matcher fidelity — copy verbatim** (lines 52–61):

```typescript
const matchingIds = uncategorized
  .filter((e) => {
    const normalized = normalizeDescription(e.title)
    const stripped = normalized.split(/\s+/).filter(t => t.length > 0 && !/^\d+$/.test(t)).join(' ')
    return regex.test(normalized) || regex.test(stripped)
  })
  .map((e) => e.id)
```

**Update + history loop** (lines 66–98) — keep unchanged; only change expense source to platform-scoped DAL and return:

```typescript
return {
  updatedCount: matchingIds.length,
  notUpdatedCount: uncategorized.length - matchingIds.length,
}
```

**Early exit when no matches** — legacy returns `0`; new function returns `{ updatedCount: 0, notUpdatedCount: uncategorized.length }`.

**Leave `applyNewPatternToExpenses` untouched** for `createPatternAction` legacy user-wide path.

---

### `lib/actions/patterns.ts` — modify `promoteSuggestionAction` (controller, request-response)

**Analog:** `promoteSuggestionAction` (lines 222–305) + non-fatal apply from `createPatternAction` (lines 128–144)

**Auth + no plan gate** (lines 226–228):

```typescript
const { userId } = await verifySession();
// Per D-03 (35-CONTEXT.md): suggestion promotion is available to all plans,
// including `free`. Intentionally NOT calling requireCustomPatternsAccess here.
```

**Create-then-apply orchestration** (lines 253–301) — extend promote path only:

```typescript
let created: Awaited<ReturnType<typeof createPattern>>;
try {
  created = await createPattern({ ...parsed.data, confidence: 0.85, userId });
} catch (err) { /* existing error mapping */ }

try {
  await applyNewPatternToExpenses(db, userId, created.id, ...);
} catch (err) {
  console.error(
    '[promoteSuggestionAction] applyNewPatternToExpenses failed (pattern saved, retroactive apply failed):',
    err instanceof Error ? err.message : err,
    errorCause(err),
  )
}

revalidateCategorizationSurfaces();
return { error: null };
```

**Phase 53 changes:**
1. Parse `fileId` from FormData.
2. Call `getPlatformIdForUserFile({ userId, fileId })` — return Italian error if null.
3. Call `applyNewPatternToPlatformExpenses` instead of `applyNewPatternToExpenses`.
4. On apply success: `return { error: null, applyResult: { updatedCount, notUpdatedCount } }`.
5. On apply throw: keep pattern saved, log, return counts reflecting actual updates (0/0 or scanned−0).

**Do not modify** `createPatternAction` apply call (out of scope).

---

### `lib/validations/pattern.ts` — extend `ActionState` (utility, transform)

**Analog:** `ImportActionState<T>` in `lib/actions/import.ts` (lines 47–50)

```typescript
export type ImportActionState<T = null> = {
  error: string | null;
  data?: T;
};
```

**Recommended extension** (co-locate types with pattern validation):

```typescript
export type PatternApplyResult = {
  updatedCount: number
  notUpdatedCount: number
}

export type ActionState = {
  error: string | null
  applyResult?: PatternApplyResult | null
}
```

**Alternative:** Export `PatternApplyResult` from service and import in validations — avoid duplicate type definitions if planner picks single source.

**FormData:** Reuse `CreatePatternSchema` for pattern/subCategoryId; validate `fileId` as non-empty string in action (no new Zod schema required unless planner wants `PromoteSuggestionSchema`).

---

### `app/(app)/import/[fileId]/suggestions/page.tsx` — resolve `platformId` (route, request-response)

**Analog:** same file (lines 15–64) + `tests/import-suggestions-page.test.tsx`

**RSC auth + file guard** (lines 20–26):

```typescript
const { fileId } = await params
const { userId } = await verifySession()

const fileRow = await getFileForUser({ userId, fileId })
if (!fileRow || fileRow.status !== 'imported') {
  notFound()
}
```

**Add after file guard:**

```typescript
const platformId = await getPlatformIdForUserFile({ userId, fileId })
if (platformId == null) {
  notFound()
}
```

**Pass props to section** (line 60):

```typescript
<SuggestionSection
  suggestions={patternSuggestions}
  categories={categories}
  fileId={fileId}
  platformId={platformId}
/>
```

**Extend page test** following `tests/import-suggestions-page.test.tsx`: mock `getPlatformIdForUserFile`, assert `notFound` when null, assert props passed to `SuggestionSection`.

---

### `components/import/suggestion-section.tsx` — thread `fileId` / `platformId` (component, request-response)

**Analog:** same file (lines 7–30)

**Props + map pattern** (lines 7–27):

```typescript
type Props = {
  suggestions: PatternSuggestion[]
  categories: CategoryWithSubCategories[]
}

export function SuggestionSection({ suggestions, categories }: Props) {
  // ...
  {suggestions.map((suggestion, index) => (
    <SuggestionCard
      key={`${suggestion.pattern}-${index}`}
      suggestion={suggestion}
      categories={categories}
    />
  ))}
}
```

**Change:** Add `fileId: string` and `platformId: number` to `Props`; pass through to each `SuggestionCard`.

---

### `components/import/suggestion-card.tsx` — inline apply counts (component, request-response)

**Analog:** same file (lines 15–80)

**Client promoted state** (lines 15–19):

```typescript
const [promoted, setPromoted] = useState(false)
const handlePromoted = useCallback(() => setPromoted(true), [])
```

**Success badge** (lines 35–42):

```typescript
{promoted && (
  <Badge variant="outline" className="border-green-600 text-green-700 dark:text-green-400">
    Pattern creato
  </Badge>
)}
```

**Phase 53 changes:**
1. Extend state: `applyResult: PatternApplyResult | null`.
2. Change `handlePromoted` to accept `applyResult` from form callback.
3. Render Italian count copy below badge when `applyResult` is set (e.g. `{updatedCount} categorizzate · {notUpdatedCount} ancora senza match`).
4. Keep form visible with `opacity-50 pointer-events-none` when promoted (do **not** remove card — rejected in discuss).
5. Pass `fileId` to `SuggestionPromoteForm`.

---

### `components/import/suggestion-promote-form.tsx` — hidden `fileId` + `applyResult` (component + hook, request-response)

**Analog:** same file (lines 20–99)

**useActionState + submittedRef guard** (lines 24–34):

```typescript
const [state, formAction, isPending] = useActionState(promoteSuggestionAction, { error: null })
const submittedRef = useRef(false)

useEffect(() => {
  if (submittedRef.current && state.error === null) {
    submittedRef.current = false
    onPromoted()
  }
}, [state, onPromoted])
```

**Hidden inputs** (lines 60–61):

```typescript
<input type="hidden" name="pattern" value={suggestion.pattern} />
<input type="hidden" name="subCategoryId" value={subCategoryId} />
```

**Phase 53 changes:**
1. Add `fileId` prop; render `<input type="hidden" name="fileId" value={fileId} />`.
2. Extend `onPromoted: (applyResult: PatternApplyResult) => void`.
3. Guard: `submittedRef.current && state.error === null && state.applyResult` before calling `onPromoted(state.applyResult)`.
4. Import `PatternApplyResult` from validations (or shared type).

**Pitfall:** Never call `onPromoted` on initial render — `state.error === null` is initial state (documented Pitfall 4).

---

### `tests/pattern-application.test.ts` — NEW (test, batch)

**Analog:** `tests/regex-discovery-service.test.ts` (service + mocked DAL) + `tests/regex-discovery-dal.test.ts` (join assertions)

**Service test structure** (lines 1–32):

```typescript
const mocks = vi.hoisted(() => ({
  getUncategorizedExpensesForPlatformApply: vi.fn(),
  writeClassificationHistory: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/dal/regex-discovery', () => ({
  getUncategorizedExpensesForPlatformApply: mocks.getUncategorizedExpensesForPlatformApply,
}))
```

**Cover:** platform boundary (two platform fixtures), Set A excluded, numeric-stripped dual-test, `{ updatedCount, notUpdatedCount }` when zero matches, invalid regex → `{0, scanned}`.

---

### `tests/pattern-actions.test.ts` — extend `promoteSuggestionAction` (test, request-response)

**Analog:** same file `promoteSuggestionAction` block (lines 334–416)

**Mock pattern to add:**

```typescript
applyNewPatternToPlatformExpenses: vi.fn(),
getPlatformIdForUserFile: vi.fn(),
```

**Extend `validPromoteForm`:**

```typescript
function validPromoteForm(overrides: Record<string, string | null> = {}) {
  return makeFormData({
    pattern: 'netflix',
    subCategoryId: '42',
    fileId: 'file-abc',
    ...overrides,
  })
}
```

**New cases:** returns `applyResult` on success; resolves platform from `fileId`; errors when platform null; mocks `applyNewPatternToPlatformExpenses` returning `{ updatedCount: 3, notUpdatedCount: 12 }`.

**Note:** Today promote tests do not mock `applyNewPatternToExpenses` — add explicit service mock to avoid DB hits.

---

### `tests/suggestion-card.test.tsx` — extend (test, request-response)

**Analog:** same file (lines 47–85)

**Static render pattern:**

```typescript
const html = renderToStaticMarkup(
  createElement(SuggestionCard, { suggestion, categories }),
)
expect(html).not.toContain('Pattern creato')
```

**New cases:** When card receives promoted state with `applyResult`, assert Italian count copy visible. May require exporting a test helper or testing via `SuggestionPromoteForm` integration if state is internal — planner may use `@testing-library/react` client render for post-promote state if static SSR insufficient.

---

### `tests/suggestion-promote-form.test.tsx` — extend (test, request-response)

**Analog:** same file REV-03 hidden input tests (lines 50–67)

```typescript
expect(html).toMatch(/<input[^>]*type="hidden"[^>]*name="pattern"[^>]*value="netflix"/)
expect(html).toMatch(/<input[^>]*type="hidden"[^>]*name="subCategoryId"/)
```

**New case:**

```typescript
expect(html).toMatch(/<input[^>]*type="hidden"[^>]*name="fileId"[^>]*value="file-abc"/)
```

Pass `fileId="file-abc"` prop once added to component.

---

## Shared Patterns

### Authentication (Server Actions)

**Source:** `lib/actions/patterns.ts` lines 226, 71
**Apply to:** `promoteSuggestionAction` only (not new DAL functions)

```typescript
const { userId } = await verifySession();
```

DAL helpers receive `userId` as parameter — no session in DAL.

### File ownership (DAL + action)

**Source:** `lib/dal/files.ts` lines 56–67
**Apply to:** `getPlatformIdForUserFile`, action platform resolution

```typescript
.where(and(eq(file.id, input.fileId), eq(file.userId, input.userId)))
```

### Platform-scoped Set B filter

**Source:** `lib/dal/regex-discovery.ts` lines 49–55
**Apply to:** `getUncategorizedExpensesForPlatformApply` and apply service scan

```typescript
.where(
  and(
    eq(expense.userId, userId),
    eq(platform.id, platformId),
    isNull(expense.subCategoryId),
  ),
)
```

### Classification history on retroactive update

**Source:** `lib/services/pattern-application.ts` lines 84–97
**Apply to:** platform apply path

```typescript
await writeClassificationHistory(database, {
  userId,
  expenseId,
  toSubCategoryId: subCategoryId,
  toStatus: '3',
  source: 'user_pattern',
  patternId,
  confidence: confidence.toFixed(2),
})
```

### Non-fatal apply failure after pattern save

**Source:** `lib/actions/patterns.ts` lines 295–301
**Apply to:** `promoteSuggestionAction` — preserve log-and-continue; return counts reflecting actual updates

```typescript
} catch (err) {
  console.error(
    '[promoteSuggestionAction] applyNewPatternToExpenses failed (pattern saved, retroactive apply failed):',
    err instanceof Error ? err.message : err,
    errorCause(err),
  )
}
```

### Revalidation after mutation

**Source:** `lib/actions/patterns.ts` lines 303–304
**Apply to:** successful promote (unchanged)

```typescript
revalidateCategorizationSurfaces();
return { error: null, applyResult: { updatedCount, notUpdatedCount } };
```

### useActionState success payload

**Source:** `components/import/suggestion-promote-form.tsx` lines 24–34 + `lib/actions/import.ts` lines 47–50
**Apply to:** form + `ActionState`

```typescript
// Initial state must include optional applyResult: null or omit
const [state, formAction, isPending] = useActionState(promoteSuggestionAction, { error: null })

// Success: only after submit
if (submittedRef.current && state.error === null && state.applyResult) {
  onPromoted(state.applyResult)
}
```

### Italian product copy (developer tests in English)

**Source:** RESEARCH inline count example
**Apply to:** `suggestion-card.tsx` only

```tsx
{applyResult.updatedCount} categorizzate · {applyResult.notUpdatedCount} ancora senza match
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| — | — | — | All planned files have exact or strong analogs in the codebase |

## Metadata

**Analog search scope:** `lib/dal/`, `lib/services/`, `lib/actions/`, `lib/validations/`, `app/(app)/import/`, `components/import/`, `tests/`
**Files scanned:** ~25
**Pattern extraction date:** 2026-06-16
