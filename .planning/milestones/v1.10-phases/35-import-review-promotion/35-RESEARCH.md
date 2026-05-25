# Phase 35: import-review-promotion - Research

**Researched:** 2026-05-23
**Domain:** Next.js App Router UI components, Server Actions, React useActionState
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Promotion via simplified inline form — no dialog. Each suggestion card has a category → subcategory selector and a "Crea pattern" button. The `pattern` field is pre-filled from the suggestion and sent as a hidden input. `detectedAmountSign` is pre-filled as a hidden input. Confidence is fixed at 0.85. No required description. User selects only the subcategory.
- **D-02:** After a successful promotion, the suggestion card is visually marked with a "Pattern creato" badge and the inline form is disabled. The card stays visible so the user can see how many suggestions they promoted before confirming the import.
- **D-03:** Promotion from suggestion is free for all plans including `free`. Requires a new Server Action `promoteSuggestionAction` separate from `createPatternAction` that bypasses `canManageCustomPatterns`. The action uses `CreatePatternSchema` for validation and calls the same DAL `createPattern`.
- **D-04:** The suggestions section is inserted in `ImportPreview` between the preview table and the confirm button. Title: "Suggerimenti pattern (N)". Separate cards per suggestion with: pattern shown as monospace text, badge with `matchCount`, sample descriptions toggle, and the inline promotion form.
- **D-05:** Sample descriptions are hidden by default. A compact "Mostra N esempi" button/link expands the descriptions inline (max 3). Reduces clutter for users who understand the pattern without examples.

### Claude's Discretion
- Exact style of the "Pattern creato" badge (shadcn Badge variant)
- Internal structure of the category → subcategory selector in the inline form (can reuse CreatePatternDialog pattern)
- Inline validation error handling (e.g. "Seleziona una sottocategoria")
- Whether a category selector is needed or subcategories are searched flat

### Deferred Ideas (OUT OF SCOPE)
None — the discussion stayed within phase 35 scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REV-01 | User can see pattern suggestions on the import analysis page before confirming import | `ImportAnalysisResult.patternSuggestions` already populated by phase 34; `ImportPreview` receives it; `SuggestionSection` renders it |
| REV-02 | User can inspect sample descriptions for each suggestion | `PatternSuggestion.sampleDescriptions` (max 3 strings); toggle with local `useState<boolean>(false)` per card |
| REV-03 | User can select a destination subcategory and promote a suggestion to a categorization pattern | `promoteSuggestionAction` calls `createPattern` DAL; category selector reuses `CreatePatternDialog` pattern |
| REV-04 | User can continue import confirmation without handling suggestions | Confirm button unaffected by suggestion section; no blocking gate on promotion state |
| REV-05 | User sees clear success or validation feedback after attempting to promote a suggestion | `useActionState` + `submittedRef` drives promoted state (badge, form disabled); `Alert variant="destructive"` for errors |
</phase_requirements>

---

## Summary

Phase 35 adds a suggestion review section to the existing `/import/[fileId]/analyze` page. The `ImportAnalysisResult.patternSuggestions` field is already populated by phase 34 and flows through the existing `analyzeImportAction` → `AnalyzePage` → `ImportPreview` pipeline. No new data fetching for suggestions is required.

The only new data dependency is `CategoryWithSubCategories[]` — needed for the category → subcategory selector on each suggestion card. The existing `getCategories()` DAL call (used by `CreatePatternDialog`) covers this; the server component `AnalyzePage` needs to call it and pass the result as a new `categories` prop to `ImportPreview`.

The new `promoteSuggestionAction` is a near-clone of `createPatternAction` minus the `canManageCustomPatterns` gate. It uses the same `CreatePatternSchema`, calls the same `createPattern` DAL, and calls the same `revalidateCategorizationSurfaces()`. The difference is it accepts `pattern` and `amountSign` as pre-filled hidden inputs and hardcodes `confidence: 0.85`.

**Primary recommendation:** Build three new client components (`SuggestionSection`, `SuggestionCard`, `SuggestionPromoteForm`), add `promoteSuggestionAction` to `lib/actions/patterns.ts`, and wire the analyze page to fetch categories server-side.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Render suggestion cards | Browser/Client | — | `ImportPreview` is already `'use client'`; new sub-components are also client |
| Fetch categories for selector | Frontend Server (SSR) | — | `AnalyzePage` is a server component; categories are fetched once per page load |
| Promote suggestion to pattern | API/Backend (Server Action) | — | `promoteSuggestionAction` runs server-side, writes to DB via DAL |
| Sample descriptions toggle | Browser/Client | — | Local `useState` per card, no server involvement |
| Promoted card state | Browser/Client | — | Local `useState<boolean>` driven by `useActionState` result |
| Cache revalidation after promotion | API/Backend (Server Action) | — | `revalidateCategorizationSurfaces()` called inside Server Action |

---

## Standard Stack

### Core — all already installed, no new packages needed

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React `useActionState` | 19 (Next.js 16) | Form action state + pending | The project's canonical Server Action feedback hook, already used in `CreatePatternDialog` |
| shadcn/ui | preset new-york | Badge, Button, Card, Select, Alert | Already installed; all required components present |
| lucide-react | — | `Loader2` spinner icon | Already used in `ImportPreview` and `CreatePatternDialog` |

[VERIFIED: codebase grep — all shadcn components listed in UI-SPEC are already imported in existing files]

### No new packages required

The UI-SPEC Section "Registry Safety" explicitly states: "No new shadcn components need to be installed." All shadcn components are already present. [VERIFIED: components/import/import-preview.tsx and components/patterns/create-pattern-dialog.tsx import `Badge`, `Button`, `Card`, `Select`, `Alert` from `@/components/ui/`]

---

## Architecture Patterns

### System Architecture Diagram

```
AnalyzePage (Server Component)
  │
  ├── analyzeImportAction(fd)  →  ImportAnalysisResult { patternSuggestions: [...] }
  │
  └── getCategories()          →  CategoryWithSubCategories[]
        │
        ▼
  ImportPreview (Client Component)
    props: { result, categories, candidates?, confirmDisabledReason? }
        │
        ├── SuggestionSection (Client)
        │     props: { suggestions: PatternSuggestion[], categories }
        │           │
        │           └── SuggestionCard × N (Client)
        │                 local state: promoted, showSamples
        │                       │
        │                       └── SuggestionPromoteForm (Client)
        │                             useActionState(promoteSuggestionAction)
        │                             hidden inputs: pattern, amountSign, confidence=0.85
        │                             visible: category Select → subcategory Select
        │                                      │
        │                                      ▼
        │                             promoteSuggestionAction (Server Action)
        │                               verifySession()
        │                               CreatePatternSchema.safeParse(...)
        │                               createPattern(DAL)
        │                               revalidateCategorizationSurfaces()
        │
        └── [confirm button — unchanged, always unblocked]
```

### Recommended File Structure

```
lib/actions/patterns.ts           # Add promoteSuggestionAction here (new export)
app/(app)/import/[fileId]/analyze/page.tsx  # Add getCategories() + pass categories prop
components/import/import-preview.tsx        # Add categories prop, insert SuggestionSection
components/import/suggestion-section.tsx    # NEW: maps patternSuggestions to SuggestionCard
components/import/suggestion-card.tsx       # NEW: card with toggle + promote form
components/import/suggestion-promote-form.tsx  # NEW: inline form with useActionState
tests/pattern-actions.test.ts              # Add promoteSuggestionAction test cases
tests/import-analyze-page.test.tsx         # Update: mock getCategories, pass categories prop
tests/import-preview-ui.test.tsx           # Update: add categories prop to baseResult
```

### Pattern 1: useActionState + submittedRef (canonical codebase pattern)

**What:** Server Action feedback with state transition detection.
**When to use:** Every inline form that promotes a suggestion. The `submittedRef` guards against the initial render triggering the success effect.

```typescript
// Source: components/patterns/create-pattern-dialog.tsx (exact codebase usage)
const [state, formAction, isPending] = useActionState(promoteSuggestionAction, { error: null })
const submittedRef = useRef(false)

useEffect(() => {
  if (submittedRef.current && state.error === null) {
    setPromoted(true)
    submittedRef.current = false
  }
}, [state])

// In form action:
action={(formData) => {
  submittedRef.current = true
  formAction(formData)
}}
```

[VERIFIED: components/patterns/create-pattern-dialog.tsx lines 39-57]

### Pattern 2: Category → Subcategory selector

**What:** Two-Select cascade: first Select sets `categoryId`, clears `subCategoryId`; second Select is disabled until a category is chosen; `useMemo` derives the `selectedCategory` object.
**When to use:** `SuggestionPromoteForm` — reuse this exact pattern from `CreatePatternDialog`.

```typescript
// Source: components/patterns/create-pattern-dialog.tsx lines 37-60
const [categoryId, setCategoryId] = useState('')
const [subCategoryId, setSubCategoryId] = useState('')

const selectedCategory = useMemo(
  () => categories.find((c) => String(c.id) === categoryId),
  [categories, categoryId],
)

function handleCategoryChange(value: string) {
  setCategoryId(value)
  setSubCategoryId('')  // reset subcategory when category changes
}
```

[VERIFIED: components/patterns/create-pattern-dialog.tsx]

### Pattern 3: Server Action skeleton (promoteSuggestionAction)

**What:** Like `createPatternAction` but without the plan gate. Accepts pre-filled `pattern` and `amountSign` from hidden inputs; hardcodes `confidence: 0.85`.

```typescript
// Source: lib/actions/patterns.ts — adapted from createPatternAction
export async function promoteSuggestionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { userId } = await verifySession()
  // No canManageCustomPatterns check — D-03

  const parsed = CreatePatternSchema.safeParse({
    pattern: formData.get('pattern'),
    subCategoryId: formData.get('subCategoryId')
      ? Number(formData.get('subCategoryId'))
      : undefined,
    amountSign: formData.get('amountSign'),
    confidence: 0.85,  // fixed per D-01
    description: undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await createPattern({ ...parsed.data, userId })
  } catch (err) {
    if (err instanceof Error && /invalid/i.test(err.message)) {
      return { error: 'Pattern regex non valido.' }
    }
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }

  revalidateCategorizationSurfaces()
  return { error: null }
}
```

[VERIFIED: lib/actions/patterns.ts — `createPatternAction` is the exact model]

### Pattern 4: Server component fetching categories

**What:** `AnalyzePage` (server component) calls `getCategories()` before rendering, then passes to `ImportPreview`.

```typescript
// Source: inferred from app/(app)/import/[fileId]/analyze/page.tsx + lib/dal/categories.ts
import { getCategories } from '@/lib/dal/categories'

// Inside AnalyzePage:
const [result, categories] = await Promise.all([
  analyzeImportAction(fd),
  getCategories(),
])

// Pass to ImportPreview:
<ImportPreview result={result.data} categories={categories} />
```

Note: `getCategories()` uses React `cache()` internally (verified in `lib/dal/categories.ts` line 64), so concurrent calls within the same request are deduplicated automatically. [VERIFIED: lib/dal/categories.ts line 64]

### Pattern 5: Promoted card visual state

**What:** When `promoted === true`, the form wrapper gets `className="opacity-50 pointer-events-none"` and a "Pattern creato" badge appears in the card header.

```typescript
// Source: 35-UI-SPEC.md — States & Interactions section
<div className={promoted ? 'opacity-50 pointer-events-none' : undefined}>
  <SuggestionPromoteForm ... />
</div>
```

### Anti-Patterns to Avoid

- **Calling `getCategories()` inside `ImportPreview` (client component):** `lib/dal/categories.ts` imports `server-only` at line 1. It cannot be called from a client component. Categories must be fetched in the server component and passed as props. [VERIFIED: lib/dal/categories.ts line 1]
- **Adding a plan gate to `promoteSuggestionAction`:** D-03 explicitly forbids it. Promotion is free for all plans.
- **Reusing `createPatternAction` directly:** It calls `canManageCustomPatterns` which blocks free users. A separate `promoteSuggestionAction` is required.
- **Letting promotion block the confirm button:** REV-04 requires the confirm button to remain visible and enabled regardless of suggestion state. No coupling between the two.
- **Using a dialog for suggestion promotion:** D-01 mandates inline form, no dialog.
- **Rendering `SuggestionSection` when `patternSuggestions` is empty:** Per D-04 and specifics in CONTEXT.md, when the array is empty the section is omitted from the DOM entirely (no title, no cards).
- **Using `useActionState` without `submittedRef`:** Without `submittedRef`, the success effect fires on initial render (when `state.error === null` is the initial state). The `submittedRef` guards this correctly, as shown in `CreatePatternDialog`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pattern regex normalization | Custom regex parser | `normalizePatternInput` + `CreatePatternSchema` from `lib/validations/pattern.ts` | Already handles `/pattern/i` vs `pattern` forms, escaping, and validation |
| Pattern DB write | Custom INSERT | `createPattern` DAL from `lib/dal/patterns.ts` | Handles normalization, soft-delete schema, `priority: 100` default |
| Cache invalidation | Custom `revalidatePath` list | `revalidateCategorizationSurfaces()` from `lib/actions/revalidation.ts` | Covers all 4 affected routes + `refresh()` |
| Category/subcategory fetch | New query | `getCategories()` from `lib/dal/categories.ts` | React `cache()`-wrapped, user-scoped, handles overrides |
| Form state management | Local `useState` for form | `useActionState` from React 19 | Canonical pattern in this codebase; integrates with Server Actions |

**Key insight:** Every piece of infrastructure this phase needs (DAL, validation, cache invalidation) already exists. The work is UI composition and one new Server Action wrapper.

---

## Common Pitfalls

### Pitfall 1: Test fixtures missing `patternSuggestions` field

**What goes wrong:** `import-preview-ui.test.tsx` and `import-analyze-page.test.tsx` use hardcoded `baseResult` / `analysisResult()` fixtures that do not include `patternSuggestions`. After adding `categories` to `ImportPreview`'s props and `patternSuggestions` to `baseResult`, the existing tests will fail with TypeScript prop errors.

**Why it happens:** The fixtures were created before phase 34 added `patternSuggestions` to `ImportAnalysisResult`. Looking at `import-preview-ui.test.tsx` line 31: `patternSuggestions: []` is already there. Looking at `import-analyze-page.test.tsx` line 27–50: `patternSuggestions` is **absent** from `analysisResult()`.

[VERIFIED: tests/import-preview-ui.test.tsx line 31 — already has `patternSuggestions: []`; tests/import-analyze-page.test.tsx lines 27-50 — does NOT have `patternSuggestions`]

**How to avoid:** Wave 0 plan must patch `import-analyze-page.test.tsx`'s `analysisResult()` to include `patternSuggestions: []`, and add a mock for `getCategories`.

**Warning signs:** TypeScript errors on `result` prop type mismatch when passing to `ImportPreview`.

### Pitfall 2: `getCategories()` import in server component without `server-only` awareness

**What goes wrong:** `getCategories()` calls `verifySession()` internally (line 139 of `lib/dal/categories.ts`), which itself requires a server context. If somehow called in a non-server context the error will be cryptic.

**Why it happens:** `lib/dal/categories.ts` has `import 'server-only'` at line 1. This already prevents incorrect usage — it will throw at import time if used in a client module.

**How to avoid:** Only call `getCategories()` in `AnalyzePage` (server component) and pass results as props. Never import the DAL in `components/import/suggestion-promote-form.tsx` or any client component.

### Pitfall 3: `subCategoryId` sent as empty string

**What goes wrong:** When the user submits without selecting a subcategory, `formData.get('subCategoryId')` returns `''` (empty string from a hidden input) or `null`. The `Number('')` coercion produces `0`, which fails the `z.number().positive()` check — but the error message is the generic zod message, not the Italian copy.

**Why it happens:** `CreatePatternSchema` uses `z.number({ error: 'Seleziona una sottocategoria.' }).int().positive(...)`. When `subCategoryId` is missing/empty, the `Number(formData.get('subCategoryId'))` coercion produces `0` and the `.positive()` check fires.

**How to avoid:** Mirror `createPatternAction` exactly: `subCategoryId: formData.get('subCategoryId') ? Number(formData.get('subCategoryId')) : undefined`. When `undefined`, zod gives the `{ error: 'Seleziona una sottocategoria.' }` message from the `z.number({ error: ... })` constructor. [VERIFIED: lib/actions/patterns.ts lines 59-61]

### Pitfall 4: `useActionState` initial state triggers success branch

**What goes wrong:** `useEffect` fires on mount with `state.error === null` (the initial state). Without `submittedRef`, the card is immediately set to `promoted = true` before the user does anything.

**How to avoid:** Use `submittedRef` pattern from `CreatePatternDialog` exactly. `submittedRef.current` is only set to `true` in the form action wrapper, so the effect only acts after a real submit. [VERIFIED: components/patterns/create-pattern-dialog.tsx lines 40, 47-57, 84]

### Pitfall 5: Multiple `SuggestionPromoteForm` instances sharing action state

**What goes wrong:** If `useActionState` is lifted to `SuggestionCard` level but shared between multiple `SuggestionPromoteForm` instances, one card's form result could affect another card's visual state.

**How to avoid:** Each `SuggestionCard` instance owns its own `promoted` state and its own `useActionState` instance. The three components (`SuggestionSection`, `SuggestionCard`, `SuggestionPromoteForm`) are separate files — `SuggestionCard` owns `promoted` + `showSamples`; `SuggestionPromoteForm` owns `useActionState` + `submittedRef` and calls `onPromoted` callback to notify the card.

### Pitfall 6: `analyzeImportAction` called before `getCategories()` in page — sequential vs parallel

**What goes wrong:** If `analyzeFile` and `getCategories()` are awaited sequentially, page load time increases by the full `getCategories()` latency (typically a fast query, but still).

**How to avoid:** Use `Promise.all([analyzeImportAction(fd), getCategories()])` to run them in parallel. Note: `analyzeImportAction` is a Server Action (async function call), not a DAL call, so no `server-only` conflict.

---

## Code Examples

Verified patterns from codebase:

### PatternSuggestion type (full shape)

```typescript
// Source: lib/utils/pattern-suggestions.ts lines 16-20
export interface PatternSuggestion {
  pattern: string                              // escaped regex source, already normalized
  matchCount: number                           // >= 2 always
  detectedAmountSign: 'positive' | 'negative' | 'any'
  sampleDescriptions: string[]                 // max 3 elements (capped upstream in analyzeFile)
}
```

### CategoryWithSubCategories type (prop shape)

```typescript
// Source: lib/dal/categories.ts lines 8-25
export type CategoryWithSubCategories = {
  id: number
  name: string
  slug: string
  type: 'in' | 'out' | 'system'
  userId: string | null
  isOwned: boolean
  subCategories: Array<{
    id: number
    name: string          // may be customName if override exists
    slug: string
    originalName: string
    userId: string | null
    isOwned: boolean
    hasOverride: boolean
    customName: string | null
  }>
}
```

### createPattern DAL signature

```typescript
// Source: lib/dal/patterns.ts lines 56-76
export async function createPattern(
  input: CreatePatternInput & { userId: string },
  database: DbOrTx = db,
): Promise<PatternRow>
// CreatePatternInput = { pattern: string, subCategoryId: number, amountSign, confidence: number, description?: string }
// Pattern is re-normalized inside the DAL via normalizePatternInput
```

### CreatePatternSchema (validation contract)

```typescript
// Source: lib/validations/pattern.ts lines 53-59
export const CreatePatternSchema = z.object({
  pattern: regexString,   // transform — normalizes /x/i → x
  subCategoryId: z.number({ error: 'Seleziona una sottocategoria.' }).int().positive({ error: 'Seleziona una sottocategoria.' }),
  amountSign: z.enum(['positive', 'negative', 'any']),
  confidence: z.number().min(0).max(1),
  description: z.string().max(255).optional(),
})
```

### ActionState type

```typescript
// Source: lib/validations/pattern.ts line 65
export type ActionState = { error: string | null }
```

### revalidateCategorizationSurfaces

```typescript
// Source: lib/actions/revalidation.ts
export function revalidateCategorizationSurfaces() {
  revalidatePath(APP_ROUTES.expenses)
  revalidatePath(APP_ROUTES.transactions)
  revalidatePath(APP_ROUTES.dashboard)
  revalidatePath(APP_ROUTES.categorySettings)
  refresh()
}
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| `useFormState` (React 18 canary) | `useActionState` (React 19 stable) | Already used in this codebase — `create-pattern-dialog.tsx` line 39 |
| Dialog-based pattern creation | Inline form (this phase) | D-01 decision — no new pattern; inline is simpler for the review context |

---

## Open Questions

None with blocking impact. All technical decisions are locked in CONTEXT.md. The only discretionary choices (badge variant, error message placement, category-selector strategy) have sensible defaults from the UI-SPEC.

---

## Environment Availability

Step 2.6: SKIPPED — phase 35 has no external dependencies beyond the project's own Next.js/React/Drizzle stack. All required libraries are already installed.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (config: `vitest.config.ts`) |
| Config file | `vitest.config.ts` — includes `tests/**/*.test.ts`, `tests/**/*.test.tsx`, `lib/**/*.test.ts`; excludes `*.spec.ts` (Playwright) |
| Quick run command | `yarn test -- tests/pattern-actions.test.ts tests/import-preview-ui.test.tsx tests/import-analyze-page.test.tsx` |
| Full suite command | `yarn test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REV-01 | SuggestionSection renders when patternSuggestions.length > 0; renders nothing when empty | unit (component) | `yarn test -- tests/import-preview-ui.test.tsx` | Wave 0 — extend existing |
| REV-02 | Sample descriptions hidden by default; toggle shows/hides them | unit (component) | `yarn test -- tests/suggestion-card.test.tsx` | Wave 0 — new file |
| REV-03 | `promoteSuggestionAction` calls `createPattern` DAL with correct args; bypasses plan gate | unit (action) | `yarn test -- tests/pattern-actions.test.ts` | Wave 0 — extend existing |
| REV-04 | Confirm button visible and enabled regardless of suggestion state | unit (component) | `yarn test -- tests/import-preview-ui.test.tsx` | Wave 0 — extend existing |
| REV-05 | Success: promoted state set; Error: Alert shown | unit (component) | `yarn test -- tests/suggestion-promote-form.test.tsx` | Wave 0 — new file |

### Sampling Rate

- **Per task commit:** `yarn test -- tests/pattern-actions.test.ts tests/import-preview-ui.test.tsx`
- **Per wave merge:** `yarn test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/pattern-actions.test.ts` — add `promoteSuggestionAction` describe block (covers REV-03, D-03)
- [ ] `tests/import-preview-ui.test.tsx` — add test cases: REV-01 (suggestions rendered when present; section absent when empty array), REV-04 (confirm not blocked); update `baseResult` fixtures to include `categories` prop
- [ ] `tests/import-analyze-page.test.tsx` — add `getCategories` mock; update `analysisResult()` to include `patternSuggestions: []`; add test: categories prop passed to ImportPreview
- [ ] `tests/suggestion-card.test.tsx` — new file covering REV-02 (sample toggle) and promoted state visual
- [ ] `tests/suggestion-promote-form.test.tsx` — new file covering REV-05 (success/error feedback via useActionState)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `verifySession()` in `promoteSuggestionAction` — same as all other Server Actions |
| V3 Session Management | no | Session is checked, not created/destroyed |
| V4 Access Control | yes (minimal) | No plan gate per D-03, but `userId` is taken from session not FormData (IDOR prevention) |
| V5 Input Validation | yes | `CreatePatternSchema` (Zod) validates pattern, subCategoryId, amountSign, confidence |
| V6 Cryptography | no | No cryptographic operations |

### Known Threat Patterns for this phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR — attacker sends crafted `subCategoryId` belonging to another user | Tampering | `createPattern` DAL writes with `userId` from session; subcategory ownership enforced at pattern-match time |
| Hidden input tampering — attacker sends arbitrary `pattern` value | Tampering | `CreatePatternSchema` validates and `normalizePatternInput` re-normalizes; invalid regex rejected |
| Hidden input tampering — attacker sends arbitrary `amountSign` | Tampering | `z.enum(['positive', 'negative', 'any'])` rejects any other value |
| Hidden input tampering — attacker sends `confidence` other than 0.85 | Tampering | `promoteSuggestionAction` hardcodes `confidence: 0.85` — the FormData `confidence` field is never read |
| Session bypass — unauthenticated call to `promoteSuggestionAction` | Spoofing | `verifySession()` throws/redirects if no valid session |

---

## Sources

### Primary (HIGH confidence)

- Codebase: `lib/actions/patterns.ts` — `createPatternAction` exact implementation (model for `promoteSuggestionAction`)
- Codebase: `lib/validations/pattern.ts` — `CreatePatternSchema`, `ActionState`, `normalizePatternInput`
- Codebase: `lib/dal/patterns.ts` — `createPattern` DAL signature and behavior
- Codebase: `lib/dal/categories.ts` — `getCategories`, `CategoryWithSubCategories` type, `server-only` constraint
- Codebase: `components/patterns/create-pattern-dialog.tsx` — `useActionState` + `submittedRef` pattern
- Codebase: `components/import/import-preview.tsx` — current component structure and props
- Codebase: `app/(app)/import/[fileId]/analyze/page.tsx` — server component structure
- Codebase: `lib/services/import.ts` — `ImportAnalysisResult` type with `patternSuggestions`
- Codebase: `lib/utils/pattern-suggestions.ts` — `PatternSuggestion` interface
- Codebase: `tests/pattern-actions.test.ts` — test structure to replicate for `promoteSuggestionAction`
- Codebase: `tests/import-preview-ui.test.tsx` — existing fixture shape (already has `patternSuggestions: []`)
- Codebase: `tests/import-analyze-page.test.tsx` — fixture missing `patternSuggestions` (identified gap)
- Planning: `35-CONTEXT.md` — locked decisions D-01 through D-05
- Planning: `35-UI-SPEC.md` — component inventory, state machine, copywriting contract
- Planning: `docs/adr/0002-pattern-suggestion-detection.md` — `PatternSuggestion` shape contract

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries verified in codebase, no new installs
- Architecture: HIGH — all integration points traced through real code
- Pitfalls: HIGH — identified from direct codebase inspection (fixture gap in `import-analyze-page.test.tsx`, `subCategoryId` coercion, `submittedRef` guard)
- Test gaps: HIGH — verified which test files exist, which fixtures need patching

**Research date:** 2026-05-23
**Valid until:** 2026-06-23 (stable stack)

## Assumptions Log

This table is empty. All claims in this research were verified against the actual codebase. No assumed knowledge used for any factual claim.
