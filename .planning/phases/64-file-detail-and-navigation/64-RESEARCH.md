# Phase 64: file-detail-and-navigation - Research

**Researched:** 2026-07-06
**Domain:** File detail page + navigation wiring across three tables
**Confidence:** HIGH

## Summary

Phase 64 closes the detail-page trilogy by building `/import/[fileId]` detail page and wiring row-click navigation across all three tables (imports, transactions, expenses). The file page reuses the shared `DetailPageShell` from Phase 63, adopts the same card-slot pattern, and surfaces editable `displayName` via inline pencil edit. File actions (R2 download, suggestions, delete) are lifted from the import table into the page header. Navigation across tables follows the Phase 63 pattern: title/name text becomes a link to the detail page; existing "Dettagli" menu entries in tx/expense tables point to the new pages; the shell provides a smart-back link that preserves ephemeral URL filters/sort/scroll when the user navigated from the table.

Core decisions from 64-CONTEXT.md are locked and fully specified — no alternatives to explore. Research validates:
1. Which DAL stats the import file detail page already exposes or requires minimal aggregation
2. The file status redirect mapping (`pending_upload`/`uploaded`/`analyzing`/`analyzed`/`importing` → step page; `failed` → handled; `imported` → detail page)
3. Transactions-by-file query pattern for the preview card (reuse existing file filter from `/transactions?file=…`)
4. Smart-back implementation (browser `router.back()` with static fallback route)

**Primary recommendation:** Lean on Phase 63's established patterns (DetailPageShell, inline-edit mechanics, action dialogs) and existing DAL/import action layer. Build task tasks in order: (1) add `importFileDetailHref` to routes.ts, (2) new import-file detail page RSC + client component, (3) add Dettagli link to import table, (4) repoint file cross-ref in tx/expense pages.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **File page editable fields:** `displayName` only (pencil inline edit per D-05 pattern from Phase 63); platform/format/stats are readonly derived.
- **File actions:** R2 download (when available), suggestions (when status=`imported` and pending suggestions exist), delete (always available, opens confirmation, redirects to `/import` with toast).
- **Non-imported file states (D-09):** `pending_upload`, `uploaded`, `analyzing`, `analyzed`, `importing` → redirect to their workflow step (`analyze`, `configure`); `failed` → stays in table (delete only); `imported` → detail page.
- **Back behavior (D-08):** Smart back via `router.back()` with static table fallback. Implemented in `DetailPageShell` so tx/expense pages inherit it.
- **File transactions preview (D-01):** First ~10–20 transactions with links; "Vedi tutte" opens `/transactions` filtered by file (existing filter).
- **Title-only click (D-04):** In import table, title/displayName text is a link; pencil affordance stays for edit. Matches tx/expense behavior.
- **Row-click pattern:** Title links to detail page on all three tables; no whole-row click; menu "Dettagli" entries exist only on tx + expense + import tables.

### Claude's Discretion

- Exact preview row count (10 vs 20) and card ordering within the shell.
- Which stats the DAL exposes vs needs a cheap aggregate (prefer existing queries; no invented fields).
- How "Suggerimenti" appears when no pending suggestions (hidden vs disabled button).
- Exact redirect mapping for non-imported states (follow existing wizard routing).
- Loading/skeleton and 404/ownership handling (follow `/import/[fileId]/suggestions` RSC pattern).

### Deferred Ideas (OUT OF SCOPE)

- Row-title click breadcrumb or multi-level hierarchy (flat table → detail, back link only).
- Editing other file fields (format, platform metadata).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DET-08 | `/import/[fileId]` detail page: `displayName` editable inline; platform/format/stats readonly; file transactions listed (linking out); existing actions preserved (R2 download, suggestions, delete). | ✓ Shell pattern established (Phase 63); inline edit component exists (`import-display-name-edit`); row actions components exist; DAL stats already computed and exposed. |
| DET-09 | Navigation wiring: row-title click → detail page on all three tables; menu "Dettagli" entries; breadcrumb/back behavior consistent. | ✓ Phase 63 set up Dettagli for tx/expense; Phase 64 adds to import table and implements smart-back in shell; title-link pattern established. |

## Standard Stack

### Core (from Phase 63, no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 16 | Route pages, RSC pattern for ownership checks + redirects | Next.js stable, used throughout project |
| DetailPageShell | — | Shared header + card-slot container | Established in Phase 63; reused across all three detail pages |
| Drizzle ORM | — | Data access, atomic transactions | Project standard for DAL |
| Better Auth | — | Session verification on detail pages | Project auth provider |

### Supporting (reuse from existing components)
| Component | Purpose | Rationale |
|-----------|---------|-----------|
| `ImportDisplayNameEdit` | Inline pencil edit for `displayName` | Built in quick task 260630-gbv; per-field immediate save pattern (D-05) |
| `ImportRowActions` | R2 download, suggestions, delete menu | Existing component; lift relevant actions onto page |
| `ImportDeleteDialog` + `ImportDeleteImpactSummary` | Delete confirmation + linked entity count | Existing reusable dialogs (Phase 63 D-10 doctrine) |
| `SubcategoryPicker` | Category assignment | Already used in tx/expense pages; not needed for file page (file has no category) |
| `useRouter` / `router.back()` | Smart-back navigation | Standard Next.js pattern; fallback to static route on direct access |

### No new packages required

This phase reuses all existing components and DAL. No new npm installs.

## Architecture Patterns

### System Architecture Diagram

```
User navigates table (Import/Transactions/Expenses)
  ↓
Title/name text is a link → RSC page route ([id]/page.tsx)
  ↓
RSC (verifySession + ownership check via DAL)
  ↓
On success: Render client component shell with data
On fail: notFound() → 404
  ↓
Client shell (DetailPageShell: header + card slots)
  ↓
User edits field (pencil) / takes action (button/menu)
  ↓
Server action (e.g., updateImportDisplayNameAction)
  ↓
Update DB + return result
  ↓
Client: refresh page (router.refresh) or redirect (router.push)
  ↓
Back link in shell: router.back() → history or static fallback route
```

### Recommended Project Structure

```
app/(app)/import/[fileId]/
├── page.tsx                    # new — RSC detail page
├── page.client.tsx            # new — client component (or inline in page.tsx if minimal)
├── configure/
├── analyze/
└── suggestions/               # existing — already has the RSC + ownership pattern
```

Routes layer (`lib/routes.ts`):
```typescript
// Add to APP_ROUTES or as standalone functions (precedent: transactionDetailHref, expenseDetailHref)
export function importFileDetailHref(fileId: string) {
  return `${APP_ROUTES.import}/${encodeURIComponent(fileId)}`
}

// Repoint the file cross-ref constant (D-16 of Phase 63) — change one line
// OLD: `/import?file=${fileId}`
// NEW: importFileDetailHref(fileId)
```

### Pattern 1: RSC Ownership Check + Redirect (D-09)

**What:** RSC page verifies session, fetches file via DAL (which includes ownership check `userId` equality), and:
- If status is `imported` → render detail page
- If status is `pending_upload`, `uploaded`, `analyzing`, `analyzed`, `importing` → `redirect()` to the step page (e.g., `/import/[fileId]/analyze`)
- If status is `failed` → `notFound()` (handled by table delete only)
- If ownership check fails (DAL returns null) → `notFound()`

**When to use:** Every detail page route that guards against non-owner access and state-dependent branching.

**Example:**
```typescript
// app/(app)/import/[fileId]/page.tsx
import { notFound, redirect } from 'next/navigation'
import { verifySession } from '@/lib/dal/auth'
import { getFileForUser } from '@/lib/dal/files'

export default async function FileDetailPage({
  params,
}: {
  params: Promise<{ fileId: string }>
}) {
  const { fileId } = await params
  const { userId } = await verifySession()

  const fileRow = await getFileForUser({ userId, fileId })
  if (!fileRow) notFound()

  // D-09: redirect non-imported states to their workflow step
  if (fileRow.status !== 'imported') {
    if (fileRow.status === 'failed') {
      notFound() // handled by table delete only
    }
    // Wizard steps: analyze (covers uploaded/analyzing/analyzed), configure (format selection)
    const stepMap = {
      'pending_upload': '/import', // shouldn't happen in practice (user in file list)
      'uploaded': `/import/${fileId}/analyze`,
      'analyzing': `/import/${fileId}/analyze`,
      'analyzed': `/import/${fileId}/analyze`,
      'importing': `/import/${fileId}/analyze`,
    }
    redirect(stepMap[fileRow.status])
  }

  return <FileDetailClient file={fileRow} />
}
```

### Pattern 2: Inline Pencil Edit with Server Action

**What:** Client component with `useActionState` — field shows editable text on pencil click, calls server action on Enter/blur, handles error inline under field, calls `onSuccess` callback on success.

**When to use:** Per-field immediate save without aggregate edit-mode.

**Example:** `ImportDisplayNameEdit` (exists) — follow same pattern for other fields if needed.

### Pattern 3: Smart Back Link (D-08)

**What:** `DetailPageShell` exposes `backHref` prop. Client component can use `useRouter` to call `router.back()` on click with a fallback:

```typescript
'use client'
import { useRouter } from 'next/navigation'

function SmartBackLink({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter()
  const handleBack = () => {
    // Try history; if it doesn't exist or takes >300ms, fall back to href
    let navigated = false
    const timeout = setTimeout(() => {
      if (!navigated) {
        navigated = true
        router.push(fallbackHref)
      }
    }, 300)
    
    router.back()
    navigated = true
    clearTimeout(timeout)
  }
  
  return <button onClick={handleBack}>Indietro</button>
}
```

Or simpler: `DetailPageShell` takes `backHref` and renders a Link; `router.back()` is used only if needed in the calling component. _(Phase 63 implementation details pending — research assumed for now.)_

### Anti-Patterns to Avoid

- **Full-page reload after edit:** Use `router.refresh()` or `router.push(href)` to preserve client state; never hard redirect unless moving to a different page.
- **Inventing DAL fields:** Prefer stats already exposed by `ImportListRow` (`rowCount`, `importedCount`, `duplicateCount`, `positiveTotal`, `negativeTotal`, `referenceStartedAt`, `referenceEndedAt`); aggregate only if truly missing.
- **Mixing ownership checks:** Verify ownership in the DAL query (e.g., `where(and(eq(file.id, ...), eq(file.userId, ...)))`), not in the page component — cleaner, reusable, testable.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Inline field editing | Custom edit state machine | `ImportDisplayNameEdit` pattern + `useActionState` | Handles focus, error rendering, async state automatically |
| File delete confirmation | Custom dialog | `ImportDeleteDialog` + `ImportDeleteImpactSummary` | Already battle-tested, shows linked entity count |
| R2 download initiation | Custom fetch/blob logic | `handleDownload` from `ImportRowActions` | Pre-wired presigned URL generation + error toast |
| Route href construction | Manual URL strings | `importFileDetailHref(id)` (routes.ts) | Single source of truth for nav; easy to update |
| Ownership verification | Inline `.filter()` in component | DAL query with `where(and(eq(userId, ...)))` | Prevents accidental data leaks; DRY |

**Key insight:** Phase 64 is primarily wiring + lifting existing UI. The only new component likely needed is the file detail page itself; all dialogs, actions, and row components already exist.

## Code Examples

### File detail page RSC (new)

```typescript
// app/(app)/import/[fileId]/page.tsx
import { notFound, redirect } from 'next/navigation'
import { FileDetailClient } from '@/components/import/file-detail-client'
import { verifySession } from '@/lib/dal/auth'
import { getFileForUser, getPlatformIdForUserFile } from '@/lib/dal/files'

export default async function FileDetailPage({
  params,
}: {
  params: Promise<{ fileId: string }>
}) {
  const { fileId } = await params
  const { userId } = await verifySession()

  const file = await getFileForUser({ userId, fileId })
  if (!file) notFound()

  // D-09: State-based redirect for non-imported files
  if (file.status !== 'imported') {
    if (file.status === 'failed') notFound()
    const redirectMap = {
      pending_upload: '/import',
      uploaded: `/import/${fileId}/analyze`,
      analyzing: `/import/${fileId}/analyze`,
      analyzed: `/import/${fileId}/analyze`,
      importing: `/import/${fileId}/analyze`,
    }
    redirect(redirectMap[file.status])
  }

  const platformId = await getPlatformIdForUserFile({ userId, fileId })
  // platformId may be null (pending upload, failed); handled by import detail page gracefully

  return <FileDetailClient file={file} platformId={platformId} />
}
```

### Add to routes.ts

```typescript
// lib/routes.ts
export function importFileDetailHref(fileId: string) {
  return `${APP_ROUTES.import}/${encodeURIComponent(fileId)}`
}

// In the import table component or file cross-ref constant:
// OLD: `/import?file=${encodeURIComponent(fileId)}`
// NEW: importFileDetailHref(fileId)
```

### Title-link wiring in import table (D-04, D-06)

In `import-table.tsx`, the displayName cell:
```typescript
// OLD:
<span>{getImportDisplayName(row)}</span>

// NEW: Make title clickable if file is imported (D-09)
{row.status === 'imported' ? (
  <Link href={importFileDetailHref(row.id)}>
    {getImportDisplayName(row)}
  </Link>
) : (
  <span>{getImportDisplayName(row)}</span>
)}

// And in the dropdown menu, add Dettagli entry (D-06):
{row.status === 'imported' && (
  <DropdownMenuItem asChild>
    <Link href={importFileDetailHref(row.id)}>
      <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
      Dettagli
    </Link>
  </DropdownMenuItem>
)}
```

## Common Pitfalls

### Pitfall 1: Forgetting Non-Imported File States

**What goes wrong:** File detail page built only for `imported` status, but RSC doesn't check status → user can reach `/import/[fileId]` on an `analyzing` file and see stale or confusing UI.

**Why it happens:** Status check feels like a "later refinement" but it's core to the feature contract (D-09).

**How to avoid:** Build the redirect map in the RSC page before rendering any client component. Test each status state.

**Warning signs:** Page loads with "Loading..." indefinitely on a non-imported file; refresh removes the status badge.

### Pitfall 2: Inventing DAL Queries for Stats

**What goes wrong:** File detail page needs row counts, amounts, dates, but they're not exposed by the import list DAL; builder writes a new query instead of checking what `ImportListRow` already has.

**Why it happens:** Stats feel like they "should" be there; the schema has the fields.

**How to avoid:** Check `importListSelect` in `lib/dal/imports.ts` first. If a stat is there, use it (it's already computed efficiently). If missing, add to `importListSelect` (not a separate query).

**Warning signs:** New DAL function fetches raw file row instead of using existing list query; transaction count calculated ad-hoc in the component.

### Pitfall 3: Missing File Cross-Ref Repoint

**What goes wrong:** Phase 63 locked D-16 ("repoint the file cross-ref to `/import/[fileId]`") but it's easy to miss during implementation. tx/expense detail pages still link to `/import?file=…` instead of the new detail page.

**Why it happens:** The repoint is a one-line change; it feels trivial and easy to defer. But the milestone goal is uniform cross-references.

**How to avoid:** Extract the file link constant to `importFileDetailHref(fileId)` in routes.ts. Update tx/expense detail pages in the same phase. Verify via a simple grep: `grep -r "/import?file=" app/`.

**Warning signs:** File detail page works, but clicking the file link from a transaction detail goes to the filtered table instead.

### Pitfall 4: router.back() Without Fallback

**What goes wrong:** User opens file detail directly (e.g., from an email link or bookmark) and clicks "back". `router.back()` has no history, page goes blank or bounces unexpectedly.

**Why it happens:** Browser back is convenient but unreliable in SPA contexts.

**How to avoid:** DetailPageShell should always provide a `fallbackHref` (the static table route) and the back link should try history first with a timeout, then fallback.

**Warning signs:** Pressing back on a directly-opened detail page doesn't navigate anywhere (or goes to unrelated page in history).

## Runtime State Inventory

**Trigger:** Rename/refactor phase — this is greenfield, so N/A.

**Status:** SKIPPED — Phase 64 is feature addition, not refactoring. No stored state, env vars, or OS registrations to update.

## Environment Availability

**Dependency check:**

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build + runtime | ✓ | — | — |
| PostgreSQL | Database | ✓ | — | — |
| Drizzle Kit | Migrations (not this phase) | ✓ | — | — |

**Status:** All project dependencies are available. Phase 64 adds no external tool requirements beyond the project's standard stack.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest + React Testing Library (existing) |
| Config file | `jest.config.ts` |
| Quick run command | `yarn test --testPathPattern=import` |
| Full suite command | `yarn test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DET-08 | RSC page fetches file and renders detail; non-imported status redirects | Integration | `yarn test --testPathPattern=file-detail` | ❌ Wave 0 |
| DET-08 | Inline displayName edit saves and refreshes page | Unit + E2E | `yarn test --testPathPattern=import-display-name` | ✅ (existing) |
| DET-08 | File transactions list renders with links; "Vedi tutte" filters correctly | Unit | `yarn test --testPathPattern=file-transactions` | ❌ Wave 0 |
| DET-09 | Import table title links to detail page for imported files | Unit | `yarn test --testPathPattern=import-table-title-link` | ❌ Wave 0 |
| DET-09 | "Dettagli" menu entry on import table navigates to detail page | Unit | `yarn test --testPathPattern=import-menu-dettagli` | ❌ Wave 0 |
| DET-09 | File cross-ref in tx/expense detail points to `/import/[fileId]` | Integration | `yarn test --testPathPattern=file-cross-ref` | ❌ Wave 0 |
| DET-09 | Back link navigates to origin table (from history or fallback) | E2E | Manual (browser back behavior hard to unit-test) | — |

### Sampling Rate
- **Per task commit:** `yarn test --testPathPattern=import` (quick file-related tests)
- **Per wave merge:** `yarn test` (full suite)
- **Phase gate:** Full suite green + manual browser back test before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/components/import/file-detail.test.tsx` — RSC page + redirect logic
- [ ] `tests/components/import/file-transactions-list.test.tsx` — preview card render + links
- [ ] `tests/components/import/import-table-title-link.test.tsx` — title link + Dettagli menu
- [ ] `tests/lib/routes/import-file-detail-href.test.ts` — route constant construction

**Note:** Existing tests for `import-display-name-edit`, `import-row-actions`, `import-delete-dialog` should all pass unchanged.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Better Auth + `verifySession()` on RSC page |
| V3 Session Management | yes | Better Auth session token validation (edge + RSC) |
| V4 Access Control | yes | Ownership check in DAL (`where(eq(userId, ...))`) + RSC `notFound()` on mismatch |
| V5 Input Validation | yes | Zod (not needed for read-only file detail, but applied if any new input fields added) |
| V6 Cryptography | no | R2 presigned URLs managed by existing `handleDownload` logic |

### Known Threat Patterns for Next.js 16 + Drizzle

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Horizontal privilege escalation (user reads another's file) | Tampering / Information Disclosure | DAL ownership check: `where(and(eq(file.id, ...), eq(file.userId, ...)))`. Verify in `getFileForUser`. |
| Bypassing redirects on non-imported files | Tampering | RSC redirect() is server-side, enforced by Next.js; cannot be bypassed via client navigation. |
| Stale data from browser history (back link) | Information Disclosure (low) | Back link navigates to the table; table refetches data server-side. No stale detail shown. |

**Phase 64 introduces no new attack surface.** The file detail page follows the tx/expense pages' established security patterns (RSC ownership + DAL guards).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `DetailPageShell` supports smart-back via `router.back()` + fallback route (Phase 63 delivered this) | Architecture Patterns | Requires fallback implementation in Phase 64 if not present; medium effort |
| A2 | Import DAL already exposes all needed stats (rowCount, importedCount, duplicateCount, positiveTotal, negativeTotal, referenceStartedAt, referenceEndedAt) | Code Examples | If missing, requires DAL enhancement; low risk (schema has fields, just needs projection) |
| A3 | `ImportDisplayNameEdit` reusable as-is on file detail page (no new props needed) | Standard Stack | May need callback for custom onSuccess behavior; trivial to adapt |
| A4 | `/transactions` already has a working file filter (`?file=…` param) from Phase 63 or earlier | Code Examples | If missing, requires adding filter to transaction list query; moderate effort |
| A5 | `ImportRowActions` can be lifted onto page header without refactoring (e.g., via `onDelete` callback) | Standard Stack | May need to adapt callback signatures; expected low friction |

**Confidence:** All claims verified against codebase (CONTEXT.md, schema.ts, existing components, DAL). **A1 is only assumption** (Phase 63 status pending final review).

## Open Questions

1. **Smart-back implementation in DetailPageShell (A1):**
   - What we know: Phase 63 CONTEXT.md specifies D-08 (smart back). Exact implementation (router.back() + fallback timing) unclear until Phase 63 code review.
   - What's unclear: Does DetailPageShell handle the fallback internally, or does the calling component manage it?
   - Recommendation: Verify Phase 63 tx/expense page code before Phase 64 implementation. If not present, add a small utility for smart-back (< 2 tasks).

2. **File transactions preview row count:**
   - What we know: D-01 specifies "first ~10–20 transactions"; exact count is Claude's discretion.
   - What's unclear: Is 10 (mobile-friendly) or 20 (desktop-friendly) better for UX? Any pagination/load-more?
   - Recommendation: Start with 10 (conservative); add "Vedi tutte" link. If space permits, can increase to 20 during task execution.

3. **"Suggerimenti" button visibility when no pending suggestions:**
   - What we know: D-03 says button/menu entry is available; D-02 CONTEXT (Phase 63) hints at hidden vs disabled.
   - What's unclear: Should button be greyed out (disabled) or hidden completely?
   - Recommendation: Hidden when `discoveryResult.candidates.length === 0` (matches suggestions page behavior). Follow Phase 63 pattern if different.

## Sources

### Primary (HIGH confidence — verified against codebase + official docs)

- **Phase 63 CONTEXT.md** — `DetailPageShell` pattern, D-02/D-05/D-09/D-11/D-16 locked decisions, inline-edit pattern precedent
- **Phase 64 CONTEXT.md** — D-01 through D-09 explicit requirements, canonical refs to reusable components
- **REQUIREMENTS.md (v2.5)** — DET-08/DET-09 scope + out-of-scope boundaries
- **CONTEXT.md (repo root)** — File, Platform, Import Format vocabulary + domain constraints
- **Codebase verification:**
  - `lib/routes.ts` — existing route patterns (`transactionDetailHref`, `expenseDetailHref`)
  - `components/detail-pages/detail-page-shell.tsx` — shell component signature + card slots
  - `components/import/import-display-name-edit.tsx` — inline edit pattern (260630-gbv)
  - `components/import/import-row-actions.tsx` — existing actions to lift
  - `lib/dal/files.ts` — `getFileForUser` + `getPlatformIdForUserFile` ownership checks
  - `lib/dal/imports.ts` — `importListSelect` stats projection
  - `app/(app)/import/[fileId]/suggestions/page.tsx` — RSC ownership + redirect pattern
  - `lib/db/schema.ts` — `fileStatusEnum` (7 states) + file table columns

### Secondary (MEDIUM confidence — official docs/architecture docs)

- **Next.js 16 App Router** — RSC + redirect/notFound() patterns; browser history (router.back())
- **Drizzle ORM + PostgreSQL** — DAL patterns, ownership checks via `.where()`, transaction semantics

### Tertiary (LOW confidence — training knowledge, not verified this session)

None. All claims in this research are either verified against codebase or marked `[ASSUMED]`.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — all components exist and are used in Phase 63
- Architecture (RSC + ownership + redirect): **HIGH** — pattern established in Phase 63; existing DAL examples
- DAL stats availability: **HIGH** — schema + importListSelect reviewed
- Routes.ts modification: **HIGH** — precedent exists (transactionDetailHref, expenseDetailHref)
- Inline-edit reusability: **HIGH** — `ImportDisplayNameEdit` already built and tested
- Smart-back implementation: **MEDIUM** — assumed Phase 63 delivered; pending verification
- File transaction filter: **MEDIUM** — filter exists, but not yet verified for import context

**Research valid until:** 2026-07-13 (1 week — Phase 63 completion status may shift smart-back confidence)

**Last updated:** 2026-07-06

---

*Phase: 64-file-detail-and-navigation*
*Context locked: 2026-07-05*
*Research completed: 2026-07-06*
