# Phase 35: import-review-promotion - Pattern Map

**Mapped:** 2026-05-23
**Files analyzed:** 9 (3 new components, 1 new Server Action export, 2 modified files, 3 test files)
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `components/import/suggestion-section.tsx` | component | request-response | `components/import/import-preview.tsx` | role-match |
| `components/import/suggestion-card.tsx` | component | event-driven | `components/import/import-preview.tsx` | role-match |
| `components/import/suggestion-promote-form.tsx` | component | request-response | `components/patterns/create-pattern-dialog.tsx` | exact |
| `lib/actions/patterns.ts` (add export) | action | request-response | `lib/actions/patterns.ts` (createPatternAction) | exact |
| `components/import/import-preview.tsx` (modify) | component | request-response | `components/import/import-preview.tsx` | self |
| `app/(app)/import/[fileId]/analyze/page.tsx` (modify) | route | request-response | `app/(app)/import/[fileId]/analyze/page.tsx` | self |
| `tests/pattern-actions.test.ts` (extend) | test | — | `tests/pattern-actions.test.ts` | exact |
| `tests/suggestion-card.test.tsx` (new) | test | — | `tests/import-preview-ui.test.tsx` | role-match |
| `tests/suggestion-promote-form.test.tsx` (new) | test | — | `tests/import-preview-ui.test.tsx` | role-match |

---

## Pattern Assignments

### `lib/actions/patterns.ts` — add `promoteSuggestionAction` (action, request-response)

**Analog:** `lib/actions/patterns.ts` — `createPatternAction`

**Imports pattern** (lines 1-18): already present in the file; new export requires no new imports. Same `verifySession`, `CreatePatternSchema`, `ActionState`, `createPattern`, `revalidateCategorizationSurfaces` are already imported.

**Directive** (line 1):
```typescript
"use server";
```

**Core pattern — createPatternAction** (lines 48-83):
```typescript
export async function createPatternAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { userId, subscriptionPlan } = await verifySession();

  const accessError = requireCustomPatternsAccess(subscriptionPlan);
  if (accessError) return accessError;

  const parsed = CreatePatternSchema.safeParse({
    pattern: formData.get("pattern"),
    subCategoryId: formData.get("subCategoryId")
      ? Number(formData.get("subCategoryId"))
      : undefined,
    amountSign: formData.get("amountSign"),
    confidence: formData.get("confidence")
      ? Number(formData.get("confidence"))
      : undefined,
    description: (formData.get("description") as string) || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await createPattern({ ...parsed.data, userId });
  } catch (err) {
    if (err instanceof Error && /invalid/i.test(err.message)) {
      return { error: "Pattern regex non valido." };
    }
    return { error: "Si è verificato un errore. Riprova tra qualche secondo." };
  }

  revalidateCategorizationSurfaces();
  return { error: null };
}
```

**Divergence for `promoteSuggestionAction`:**
- Remove `subscriptionPlan` from `verifySession()` destructure — only `userId` needed (D-03: no plan gate)
- Remove the `requireCustomPatternsAccess` call entirely
- Hardcode `confidence: 0.85` instead of reading from FormData — the form sends it as a hidden input but the action ignores it (security: prevents tampering)
- `pattern` and `amountSign` come from hidden inputs (pre-filled from suggestion); `description` is omitted (`undefined`)
- `subCategoryId` coercion is identical to `createPatternAction` lines 59-61 — copy exactly

---

### `components/import/suggestion-promote-form.tsx` (component, request-response)

**Analog:** `components/patterns/create-pattern-dialog.tsx`

**Directive** (line 1):
```typescript
'use client'
```

**Imports pattern** (lines 1-27 of analog — adapt, removing Dialog imports):
```typescript
'use client'
import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { promoteSuggestionAction } from '@/lib/actions/patterns'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import type { PatternSuggestion } from '@/lib/utils/pattern-suggestions'
```

**useActionState + submittedRef pattern** (lines 39-57 of analog):
```typescript
const [state, formAction, isPending] = useActionState(createPatternAction, { error: null })
const submittedRef = useRef(false)

// ...

useEffect(() => {
  if (submittedRef.current && state.error === null) {
    toast.success('Pattern creato con successo.')
    submittedRef.current = false
    setOpen(false)
    // reset selectors...
  }
}, [state])
```

For `SuggestionPromoteForm`, the effect calls `onPromoted()` callback (no toast, no dialog close) instead. Pattern is identical:
```typescript
const [state, formAction, isPending] = useActionState(promoteSuggestionAction, { error: null })
const submittedRef = useRef(false)

useEffect(() => {
  if (submittedRef.current && state.error === null) {
    submittedRef.current = false
    onPromoted()   // notify SuggestionCard to set promoted=true
  }
}, [state])
```

**Form action wrapper** (lines 83-86 of analog):
```typescript
action={(formData) => {
  submittedRef.current = true
  formAction(formData)
}}
```

**Category → Subcategory selector state** (lines 35-62 of analog):
```typescript
const [categoryId, setCategoryId] = useState('')
const [subCategoryId, setSubCategoryId] = useState('')

const selectedCategory = useMemo(
  () => categories.find((category) => String(category.id) === categoryId),
  [categories, categoryId],
)

function handleCategoryChange(value: string) {
  setCategoryId(value)
  setSubCategoryId('')    // reset subcategory when category changes
}
```

**Hidden inputs for pre-filled values** (lines 89-91 of analog):
```typescript
<input type="hidden" name="subCategoryId" value={subCategoryId} />
<input type="hidden" name="amountSign" value={amountSign} />
<input type="hidden" name="confidence" value={confidence} />
```

For `SuggestionPromoteForm`, pattern and amountSign come from the suggestion prop:
```typescript
<input type="hidden" name="pattern" value={suggestion.pattern} />
<input type="hidden" name="amountSign" value={suggestion.detectedAmountSign} />
<input type="hidden" name="subCategoryId" value={subCategoryId} />
{/* confidence is hardcoded 0.85 server-side; no hidden input needed */}
```

**Error display pattern** (lines 187-191 of analog):
```typescript
{state.error && (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertDescription>{state.error}</AlertDescription>
  </Alert>
)}
```

**Submit button with pending state** (lines 200-202 of analog):
```typescript
<Button type="submit" disabled={isPending || !subCategoryId || !confidence}>
  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  Crea pattern
</Button>
```

For `SuggestionPromoteForm`, condition is `disabled={isPending || !subCategoryId}` (no confidence needed — hardcoded server-side).

---

### `components/import/suggestion-card.tsx` (component, event-driven)

**Analog:** `components/import/import-preview.tsx`

**Directive** (line 1):
```typescript
'use client'
```

**Imports pattern** (lines 1-27 of analog — adapt):
```typescript
'use client'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SuggestionPromoteForm } from './suggestion-promote-form'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import type { PatternSuggestion } from '@/lib/utils/pattern-suggestions'
```

**Local state pattern** (lines 42-48 of analog — adapt for two boolean flags):
```typescript
const [promoted, setPromoted] = useState(false)
const [showSamples, setShowSamples] = useState(false)
```

**Badge usage** (lines 177-183 of analog — already used for Duplicato/Valida/Errore):
```typescript
// Analog shows three variants in use:
<Badge variant="secondary">Duplicato</Badge>
<Badge variant="default">Valida</Badge>
<Badge variant="destructive">Errore</Badge>
```

"Pattern creato" badge uses `variant="default"` (or a green custom class) per Claude's Discretion.

**Promoted overlay pattern** (from RESEARCH.md Pattern 5):
```typescript
<div className={promoted ? 'opacity-50 pointer-events-none' : undefined}>
  <SuggestionPromoteForm ... />
</div>
```

**Card structure** (lines 148-192 of analog — adapt for suggestion layout):
```typescript
<Card>
  <CardHeader>
    <CardTitle className="text-base">...</CardTitle>
  </CardHeader>
  <CardContent>...</CardContent>
</Card>
```

---

### `components/import/suggestion-section.tsx` (component, request-response)

**Analog:** `components/import/import-preview.tsx` (section-level pattern — the component renders a list of cards conditionally)

**Directive** (line 1):
```typescript
'use client'
```

**Imports pattern:**
```typescript
'use client'
import { SuggestionCard } from './suggestion-card'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import type { PatternSuggestion } from '@/lib/utils/pattern-suggestions'
```

**Conditional render pattern** — when `patternSuggestions` is empty the section is omitted entirely. Model from `ImportPreview` condition blocks (lines 99-117, 119-145, 147-192 of analog):
```typescript
// Pattern: conditional section — render nothing when array is empty
{result.sampleRows.length > 0 && (
  <Card>...</Card>
)}
```

Apply as:
```typescript
if (suggestions.length === 0) return null

return (
  <section>
    <h2 className="text-base font-semibold">Suggerimenti pattern ({suggestions.length})</h2>
    {suggestions.map((s, i) => (
      <SuggestionCard key={i} suggestion={s} categories={categories} />
    ))}
  </section>
)
```

---

### `components/import/import-preview.tsx` — modify (component, request-response)

**Analog:** self — read above in full (lines 1-233)

**Props type extension** (lines 34-38 of current file):
```typescript
// Current:
type Props = {
  result: ImportAnalysisResult
  candidates?: FormatCandidate[]
  confirmDisabledReason?: string
}

// After change — add categories:
type Props = {
  result: ImportAnalysisResult
  candidates?: FormatCandidate[]
  confirmDisabledReason?: string
  categories: CategoryWithSubCategories[]
}
```

**New import to add** (after line 26):
```typescript
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import { SuggestionSection } from './suggestion-section'
```

**Insertion point** — between the sample rows Card and the confirm button block. In current file, the confirm block starts at line 195 (`{!hasErrors && !confirmDisabledReason && (`). Insert `SuggestionSection` just before that block:
```typescript
{/* Pattern suggestions — inserted before confirm */}
<SuggestionSection suggestions={result.patternSuggestions} categories={categories} />

{/* Confirm button — hidden when analysis has fatal errors */}
{!hasErrors && !confirmDisabledReason && (
```

---

### `app/(app)/import/[fileId]/analyze/page.tsx` — modify (route, request-response)

**Analog:** self — read above in full (lines 1-123)

**New import to add** (after line 7):
```typescript
import { getCategories } from '@/lib/dal/categories'
```

**Parallel fetch pattern** (from RESEARCH.md Pattern 4 + existing line 44):
```typescript
// Current:
const result = await analyzeImportAction(fd)

// After change — parallel fetch:
const [result, categories] = await Promise.all([
  analyzeImportAction(fd),
  getCategories(),
])
```

**Pass prop** (line 120 of current file):
```typescript
// Current:
{!isUnknownFormat && <ImportPreview result={result.data} />}

// After change:
{!isUnknownFormat && <ImportPreview result={result.data} categories={categories} />}
```

---

### `tests/pattern-actions.test.ts` — extend (test)

**Analog:** self — read above in full (lines 1-319)

**Top-level mock hoisting** (lines 10-16): `promoteSuggestionAction` shares all existing mocks. No new mocks required. The existing `mocks.createPattern` and `mocks.verifySession` are sufficient.

**Dynamic import extension** (line 41):
```typescript
// Current:
const { createPatternAction, updatePatternAction, deletePatternAction } = await import('../lib/actions/patterns')

// After change — add promoteSuggestionAction:
const { createPatternAction, updatePatternAction, deletePatternAction, promoteSuggestionAction } = await import('../lib/actions/patterns')
```

**Fixture helper for new action** — add alongside `validCreateForm` (lines 67-76):
```typescript
function validPromoteForm(overrides: Record<string, string | null> = {}) {
  return makeFormData({
    pattern: 'netflix',          // pre-normalized suggestion.pattern (no delimiters)
    subCategoryId: '42',
    amountSign: 'negative',
    // confidence is NOT sent — action hardcodes 0.85
    ...overrides,
  })
}
```

**Describe block to add** — mirrors `createPatternAction` describe block (lines 107-184) but with:
- No plan-gate tests (D-03: free users allowed)
- Verify `confidence: 0.85` is hardcoded regardless of FormData
- Verify `createPattern` is called with session `userId` not any FormData value (IDOR)
- Verify `freeSession` succeeds (no gate)

```typescript
describe('promoteSuggestionAction', () => {
  it('calls createPattern with confidence 0.85 and session userId for any plan', async () => {
    mocks.verifySession.mockResolvedValueOnce(freeSession)   // free user allowed (D-03)

    const result = await promoteSuggestionAction({ error: null }, validPromoteForm())

    expect(result).toEqual({ error: null })
    expect(mocks.createPattern).toHaveBeenCalledWith({
      userId: 'user-abc',
      pattern: 'netflix',
      subCategoryId: 42,
      amountSign: 'negative',
      confidence: 0.85,           // hardcoded, not from FormData
      description: undefined,
    })
    expectExactCategoryRevalidationRoutes()
  })

  // ... validation and error tests mirror createPatternAction pattern
})
```

---

### `tests/import-analyze-page.test.tsx` — extend (test)

**Analog:** self — read above in full (lines 1-93)

**Known gap** (identified in RESEARCH.md Pitfall 1): `analysisResult()` fixture at lines 27-50 is missing `patternSuggestions`. Fix required in Wave 0:
```typescript
// Current analysisResult() (lines 27-50):
function analysisResult(overrides = {}) {
  return {
    fileId: FILE_ID,
    ...
    // patternSuggestions is ABSENT — TypeScript will error after ImportPreview gets categories prop
  }
}

// After change — add field + add getCategories mock:
function analysisResult(overrides = {}) {
  return {
    fileId: FILE_ID,
    ...
    patternSuggestions: [],      // add this
    ...overrides,
  }
}
```

**New mock to add** (after line 21 of current mocks block):
```typescript
const mocks = vi.hoisted(() => ({
  analyzeImport: vi.fn(),
  push: vi.fn(),
  notFound: vi.fn(() => { throw new Error('notFound') }),
  getCategories: vi.fn(),        // add this
}))

// ...

vi.mock('@/lib/dal/categories', () => ({
  getCategories: mocks.getCategories,
}))
```

**Test to add** covering categories prop is passed:
```typescript
it('passes categories to ImportPreview when analysis succeeds', async () => {
  const cats = [{ id: 1, name: 'Test', slug: 'test', type: 'out', userId: null, isOwned: false, subCategories: [] }]
  mocks.analyzeImport.mockResolvedValueOnce({ error: null, data: analysisResult() })
  mocks.getCategories.mockResolvedValueOnce(cats)

  const html = await renderPage()

  expect(html).toContain('Conferma importazione')
  // getCategories was called (parallel fetch)
  expect(mocks.getCategories).toHaveBeenCalledTimes(1)
})
```

---

### `tests/suggestion-card.test.tsx` — new (test)

**Analog:** `tests/import-preview-ui.test.tsx` (lines 1-64)

**Test file scaffold pattern** (lines 1-18 of analog):
```typescript
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  promoteSuggestionAction: vi.fn(),
}))

vi.mock('@/lib/actions/patterns', () => ({
  promoteSuggestionAction: mocks.promoteSuggestionAction,
}))

const { SuggestionCard } = await import('../components/import/suggestion-card')
```

**Test cases to cover:**
- Sample descriptions are hidden by default (REV-02): rendered HTML does not contain sample text
- `promoted=true` renders "Pattern creato" badge (REV-05 visual)
- Card always visible after promotion (D-02: card stays, form is disabled visually)

---

### `tests/suggestion-promote-form.test.tsx` — new (test)

**Analog:** `tests/import-preview-ui.test.tsx` (lines 1-64) + `tests/pattern-actions.test.ts` mock structure

**Test file scaffold pattern:**
```typescript
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  promoteSuggestionAction: vi.fn(),
}))

vi.mock('@/lib/actions/patterns', () => ({
  promoteSuggestionAction: mocks.promoteSuggestionAction,
}))

const { SuggestionPromoteForm } = await import('../components/import/suggestion-promote-form')
```

**Test cases to cover:**
- Renders category Select (visible) and hidden inputs for pattern/amountSign (REV-03)
- Submit button disabled when no subCategoryId selected (guard)
- Error Alert rendered when `state.error` is non-null (REV-05)

---

## Shared Patterns

### Authentication
**Source:** `lib/actions/patterns.ts` lines 1-2, 52
**Apply to:** `promoteSuggestionAction`
```typescript
"use server";
import { verifySession } from "@/lib/dal/auth";

// Inside action:
const { userId } = await verifySession();  // only userId; no subscriptionPlan needed
```

### Error Handling
**Source:** `lib/actions/patterns.ts` lines 72-79
**Apply to:** `promoteSuggestionAction`
```typescript
try {
  await createPattern({ ...parsed.data, userId });
} catch (err) {
  if (err instanceof Error && /invalid/i.test(err.message)) {
    return { error: "Pattern regex non valido." };
  }
  return { error: "Si è verificato un errore. Riprova tra qualche secondo." };
}
```

### Validation + FormData coercion
**Source:** `lib/actions/patterns.ts` lines 57-70
**Apply to:** `promoteSuggestionAction`
```typescript
const parsed = CreatePatternSchema.safeParse({
  pattern: formData.get("pattern"),
  subCategoryId: formData.get("subCategoryId")
    ? Number(formData.get("subCategoryId"))
    : undefined,
  amountSign: formData.get("amountSign"),
  confidence: 0.85,              // hardcoded — never read from FormData (D-01, security)
  description: undefined,        // not collected in inline form (D-01)
});
if (!parsed.success) {
  return { error: parsed.error.issues[0].message };
}
```

### Cache Revalidation
**Source:** `lib/actions/patterns.ts` line 81
**Apply to:** `promoteSuggestionAction`
```typescript
revalidateCategorizationSurfaces();
return { error: null };
```

### useActionState + submittedRef
**Source:** `components/patterns/create-pattern-dialog.tsx` lines 39-57
**Apply to:** `SuggestionPromoteForm`
```typescript
const [state, formAction, isPending] = useActionState(promoteSuggestionAction, { error: null })
const submittedRef = useRef(false)

useEffect(() => {
  if (submittedRef.current && state.error === null) {
    submittedRef.current = false
    onPromoted()   // callback variant — no toast/dialog for inline form
  }
}, [state])

// In form:
action={(formData) => {
  submittedRef.current = true
  formAction(formData)
}}
```

### Badge visual states
**Source:** `components/import/import-preview.tsx` lines 177-183
**Apply to:** `SuggestionCard` — use `<Badge variant="secondary">` for matchCount, `<Badge variant="default">` for "Pattern creato"

---

## No Analog Found

None. All files have close analogs in the codebase.

---

## Metadata

**Analog search scope:** `components/import/`, `components/patterns/`, `lib/actions/`, `lib/dal/`, `lib/validations/`, `lib/utils/`, `app/(app)/import/`, `tests/`
**Files scanned:** 10 source files read in full
**Pattern extraction date:** 2026-05-23
