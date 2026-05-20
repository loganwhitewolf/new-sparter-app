# M004/S06 — End-to-end Import Management Integration: Research

**Date:** 2026-05-08
**Lane:** research

## Summary

S06 is the integration and verification slice for M004. All prior slices (S01–S05) are complete and fully wired: the `/import` page renders the server-side import table with all 7 lifecycle states, filters, pagination/load-more, rename, delete with reconciliation, the private format wizard at `/import/[fileId]/configure`, the analyze/confirm page at `/import/[fileId]/analyze`, and the state-aware CTA matrix (`ImportRowActions`). The `/transactions?importId=<fileId>` filter is wired in the DAL, validation layer, and transactions page server params. TypeScript compiles clean, all 296 unit/integration tests pass.

The remaining gap is **browser-level Playwright coverage** for the flows that require DB state or R2: delete dialog, configure+retry, import confirmation redirect, and the `importId` transaction link. The existing `tests/import.spec.ts` marks these as `test.fixme` with a comment "Requires seeded DB + R2 file — run against staging." S06 must either run these fixme tests against staging/live state, or add targeted mock-based browser tests that prove the integration wiring without requiring real R2 files.

The requirement R015 ("The full import-management flow works end-to-end") is marked `validate: mapped` — meaning S06 owns its validation. S06's job is: (1) cross-read every M004 active requirement against delivered code, (2) extend the Playwright spec with integration scenarios for delete, wizard, and importId link flows, and (3) run the full verification suite.

## Recommendation

**Add targeted Playwright browser tests for the 4 fixme scenarios that can be partially proven without live R2** (using server-mocked route interception for the analyze/import actions), and leave genuine R2-dependent paths as properly documented fixme notes. Then do a full M004 requirements audit against the delivered codebase. The tests should follow the established pattern in `tests/import.spec.ts` — page route intercept for API calls, staging-key header injection, `expect(…).toBeVisible()` assertions.

The integration coverage gap is not in unit tests (those are solid at 296/296) but in the browser spec — the fixme tests exist but are not runnable without staging. S06 should add at least one runnable browser test per major flow using mock routes or local-only assertions.

## Implementation Landscape

### Key Files

- `tests/import.spec.ts` — existing Playwright spec, 334 lines; IMP-01/IMP-03 tests run locally; IMP-02 tests are all `fixme`. **S06 extends this file** with IMP-04 (delete dialog), IMP-05 (wizard/configure route), IMP-06 (importId transaction link), and reruns the M004 requirements audit.
- `app/(app)/import/page.tsx` — fully wired: upload card + `ImportFilters` + `ImportTable` + error/empty states; server-rendered with URL-parsed filters.
- `app/(app)/import/[fileId]/analyze/page.tsx` — server action `analyzeImportAction` called on load; handles unknown-format with configure CTA link; `UNKNOWN_FORMAT_ERROR` imported from `lib/utils/import-status`.
- `app/(app)/import/[fileId]/configure/page.tsx` — server action `loadImportFormatWizardContextAction` called on load; renders `ImportFormatWizard` client component.
- `components/import/import-table.tsx` — client component; infinite scroll via IntersectionObserver; `ImportRowActions`, `ImportRenameDialog`, `ImportDeleteDialog` all rendered here.
- `components/import/import-row-actions.tsx` — state machine mapping all 7 `file_status` values to CTAs; view-transactions link is `/transactions?importId=<fileId>`.
- `components/import/import-delete-dialog.tsx` — fetches delete preview on open, calls `deleteImportAction`, calls `onDeleted` callback to remove row from table state.
- `components/import/import-rename-dialog.tsx` — calls `updateImportDisplayNameAction`, calls `onSuccess` callback with new displayName.
- `components/import/import-format-wizard.tsx` — client component for private format creation; submits `createPrivateImportFormatAction` and redirects to analyze with `formatVersionId`.
- `lib/actions/import.ts` — all server actions: `analyzeImportAction`, `confirmImportAction`, `previewImportDeletionAction`, `deleteImportAction`, `updateImportDisplayNameAction`, `loadImportFormatWizardContextAction`, `createPrivateImportFormatAction`, `loadMoreImports`.
- `lib/dal/imports.ts` — `getImports` DAL with full filter/pagination support; `updateImportDisplayName`; `importListSelect` shape.
- `lib/dal/transactions.ts` — `importId` predicate wired (line 147–148): appended after unconditional `userId` ownership conditions.
- `lib/validations/transactions.ts` — `importId` UUID-regex validated at parse time (line 132–143).
- `app/(app)/transactions/page.tsx` — passes `searchParams` to `parseTransactionFilters`; `importId` flows through to `getTransactions`.
- `lib/utils/import-status.ts` — `UNKNOWN_FORMAT_ERROR`, `isUnknownFormatFailed()`, `isInProgress()` — client-safe, no `server-only`.

### What S06 Must Produce

**1. Playwright browser tests** (appended to `tests/import.spec.ts`):

- **IMP-04: Delete dialog** — mock `previewImportDeletionAction` response via `page.route`, open delete dialog from a seeded imported row, assert impact summary visible, assert confirm button triggers `deleteImportAction` call and row disappears.
- **IMP-05: Configure route** — navigate to `/import/[fileId]/configure`, assert wizard form fields visible (`Delimitatore`, `Colonna data`, platform selector), assert submit redirects to `/import/[fileId]/analyze?formatVersionId=<id>`.
- **IMP-06: importId transaction link** — navigate to `/transactions?importId=<uuid>`, assert page renders without 404, assert no visible secret diagnostics (same `expectNoSecretDiagnostics` helper pattern).
- **IMP-02 (partial)** — add one locally runnable analyze page test using `page.route` to mock the server action response for format detection.

**2. M004 requirements audit** — read R007–R016 against delivered code, confirm no gaps.

**3. Full verification commands**:
```
yarn vitest run
yarn tsc --noEmit
yarn lint
yarn check:language
yarn build
```

### Build Order

1. Extend `tests/import.spec.ts` with IMP-04/IMP-05/IMP-06 — these are new Playwright tests, no code changes needed to the app.
2. Run full verification suite to prove existing code and new tests both pass.
3. Cross-read each M004 active requirement against the codebase; note any gaps.
4. If gaps exist (e.g., a CTA is missing for a lifecycle state or a filter param is lost), fix the specific code location.

### Verification Approach

```bash
# Unit/integration
yarn vitest run   # must show 296+ tests, 0 failures

# Type safety
yarn tsc --noEmit  # must exit 0

# Lint and language check
yarn lint
yarn check:language

# Build (catches RSC/Next.js integration issues)
yarn build

# Browser smoke (locally runnable tests only)
npx playwright test tests/import.spec.ts
```

For Playwright tests that require DB+R2 (IMP-02 confirm redirect, IMP-02 analyze with real file), keep `test.fixme` with the staging note — do not invent fake fixtures that could mask real failures.

## Constraints

- The `/import/[fileId]/analyze/page.tsx` calls `analyzeImportAction` directly in the RSC body (not a client fetch), so Playwright cannot intercept it via `page.route` for a POST. To test the analyze page structure, either use a seeded real file or test with a route that returns an early error state (accessible without DB state).
- `ImportUploader` does a browser-side presigned PUT to R2 — this is tested in IMP-01 with mock routes already; do not duplicate.
- The `importId` filter in `/transactions` does not show a visible "filtered by import" UI label — it silently narrows results. The browser test for IMP-06 should assert page renders with proper heading and table structure, not that results are filtered (no seeded data).
- Delete reconciliation is tested at 96 unit tests (S03); browser test needs only to prove the dialog opens, shows safe copy, and calls the action — not re-prove service logic.

## Common Pitfalls

- **Playwright route interception for server actions** — Server actions go through POST to the current URL (RSC action protocol). To mock, use `page.route('**', ...)` filtering by method and x-action header rather than URL pattern; or use `page.route` for the specific API route if wired as a Route Handler. Most import server actions are pure RSCs, so mocking requires intercepting the Next.js action endpoint which is the same page URL with a specific fetch header.
- **`test.fixme` vs skip** — Keep IMP-02 tests as `fixme` (not `skip`) so they appear in the test report as known gaps rather than silently disappearing.
- **`expectNoSecretDiagnostics` helper** — Already defined in `import.spec.ts`; reuse it in all new test blocks for consistency.

## Open Risks

- The analyze page calls the server action unconditionally in the RSC body, making browser-level happy-path testing hard without a real session+file. S06 can only run locally with the upload/analyze flow against a real dev server.
- The configure page similarly calls `loadImportFormatWizardContextAction` at render time — same constraint applies.
- If `yarn build` fails due to an RSC import boundary violation introduced in S01–S05, S06 must identify and fix it before slice completion. (TypeScript compiles clean today; build hasn't been run against the S05 state yet.)
