# State-aware recovery actions — Research

**Date:** 2026-05-08

## Summary

S05 is targeted integration work on top of already-delivered S02/S03/S04 contracts. The slice owns active requirements **R014** (state-aware actions/retry paths) and **R016** (safe localized import-management errors), and supports **R015** by producing the row-action matrix S06 will exercise end-to-end. The key code already exists: `/import` renders `ImportTable`, S02 supplies rename/filter/pagination, S03 supplies preview/delete actions and dialog, and S04 supplies configure/analyze retry routes and selected-format service behavior.

The main missing piece is not a new service, but a safe lifecycle boundary: import rows currently only show rename and delete-for-imported. Analyze/import service actions can still be called for inappropriate states because `analyzeFile()` immediately sets any owned file to `analyzing` and `importFile()` immediately sets any owned file to `importing`. S05 should add both UI-level state CTAs and server/service-level lifecycle guards so in-progress/imported rows cannot be duplicated or regressed by direct route/action calls.

## Recommendation

Implement S05 as a small state-action matrix plus lifecycle guard hardening. Add a pure helper that maps `ImportListRow` to visible actions (`analyze/retry`, `configure`, `review/confirm`, `view transactions`, `delete`, `rename`, and disabled in-progress text), use it from `components/import/import-table.tsx`, and cover it with fast tests. Then harden `lib/services/import.ts`/`lib/actions/import.ts` so direct calls return safe Italian messages and do not expose raw `Error.message` strings or mutate invalid lifecycle states.

For “view transactions”, the most exact implementation is to add an optional `importId`/file id transaction filter and link imported rows to `/transactions?importId=<fileId>`. Without that, a platform/date link is only approximate and does not truly inspect transactions for a specific import. This is a separable downstream seam touching `lib/validations/transactions.ts`, `lib/dal/transactions.ts`, `app/(app)/transactions/page.tsx` indirectly through existing filter parsing, and likely `components/transactions/transaction-filters.tsx` for reset/preserve behavior.

## Implementation Landscape

### Key Files

- `components/import/import-table.tsx` — Current `/import` client table. It defines status labels/classes, renders rename for every row, delete only for `status === 'imported'`, failure message text, load-more behavior, and rename/delete dialogs. This is the primary S05 UI integration point.
- `components/import/import-delete-dialog.tsx` — S03 destructive dialog already checks `importRow.status === 'imported'`, previews impact, disables while pending, and returns localized errors. S05 should reuse it rather than adding another delete path.
- `components/import/import-rename-dialog.tsx` — S02 rename dialog already works for rows and should remain available where sensible. No new rename action needed.
- `app/(app)/import/[fileId]/analyze/page.tsx` — Server page currently calls `analyzeImportAction()` on load, detects unknown-format analysis by `formatVersionId === null` plus `No supported import format matched`, and shows `Configura formato privato`. It also returns raw non-read/parse action errors via `displayAnalysisError()`. S05 should make direct navigation safe for invalid states.
- `components/import/import-preview.tsx` — Client preview/confirm component already has a submit lock and disabled pending/success button, but it relies on `confirmImportAction()` for final safety. It displays `confirmImportAction()` errors directly.
- `lib/actions/import.ts` — Server actions already include load-more, rename, delete preview/delete, wizard context/create, analyze, and confirm. Delete/wizard actions map errors safely; **analyze/confirm still expose `Error.message`** (`Analysis failed. Please retry.`, service/R2 messages, detector messages) and should be mapped to bounded Italian messages for R016.
- `lib/services/import.ts` — Core lifecycle risk. `analyzeFile()` sets `status: 'analyzing'` without checking current status; `importFile()` sets `status: 'importing'` without checking current status. Add lifecycle guard checks after `getFileForUser()` and before state mutation.
- `lib/dal/files.ts` — State mutation helpers update by `file.id` + `file.userId` only, not by expected current status. Either add expected-state helpers or keep guards in `lib/services/import.ts`; service-level guard is less invasive, but conditional update would be stronger against races.
- `lib/dal/imports.ts` — Import row read model. Currently selects `errorMessage` but not `importFormatVersionId`. UI can infer unknown-format configure from `errorMessage`, and retry can link to `/import/:id/analyze` relying on stored format fallback. Add fields only if the CTA matrix needs them.
- `lib/validations/import.ts` — Contains `AnalyzeImportSchema`, `ImportFileSchema`, rename/delete schemas, and wizard schemas. Add/adjust tests here only if lifecycle action schemas or safe retry inputs change.
- `lib/validations/transactions.ts` — Add `importId?: string` parsing if implementing exact “view transactions”. Use UUID validation and fail closed like other URL params.
- `lib/dal/transactions.ts` — Add `TransactionFilters.importId` and `eq(transaction.fileId, filters.importId)` while preserving existing ownership conditions (`transaction.userId` and `importFile.userId`).
- `components/transactions/transaction-filters.tsx` — If `importId` is added, make filter updates preserve it by default (current code copies existing `searchParams`, so it already preserves unknown params) and consider a visible Italian note/reset link only if planner wants UX polish.
- `tests/import-actions.test.ts` — Existing action tests mock DAL/delete but do not currently mock analyze/import services because those actions are not tested. Add mocks for `analyzeFile`/`importFile` and verify safe localized error mapping/redaction for direct action failures.
- `tests/import-service.test.ts` — Existing service tests already cover selected-format retry, failed unknown formats, parse/read failures, import stats, and rollback. Add lifecycle guard tests: analyzing/importing rows reject duplicate operations and do not call state mutation helpers; imported rows cannot be re-analyzed/re-imported.
- `tests/import.spec.ts` — Existing IMP-03 covers filter/rename/pagination and IMP-02 has fixme staging analyze tests. Add an IMP-04 or IMP-05 smoke for table action visibility when rows exist, but local DB dependence may force conditional assertions or component tests instead.

### Suggested CTA Matrix

- `pending_upload` — Rename only plus passive copy/disabled state; upload was not confirmed, so no analyze/import/delete action from history.
- `uploaded` — `Analizza` link to `/import/{id}/analyze`; rename. This is the normal post-upload retry/analyze state.
- `analyzing` — Disabled/pending `Analisi in corso`; rename optional; no analyze/configure/import/delete.
- `analyzed` — `Rivedi e importa` link to `/import/{id}/analyze`; rename. The page re-runs analysis today, so service guard must allow analyzed review only if that is intentional, or the page should load existing analysis instead (larger scope). For S05, allow review path but prevent duplicate importing while `importing`.
- `importing` — Disabled/pending `Importazione in corso`; rename optional; no retry/confirm/delete.
- `imported` — `Vedi transazioni`, `Elimina`, `Rinomina`. Delete uses S03 dialog. View should ideally target `/transactions?importId={id}`.
- `failed` unknown-format — `Configura formato` link to `/import/{id}/configure`, `Riprova analisi` link to `/import/{id}/analyze`, rename. Detect with the same known unsupported-format text used by the analyze page (`No supported import format matched`) or centralize the helper to avoid drift.
- `failed` non-unknown recoverable — `Riprova analisi` link to `/import/{id}/analyze`, rename. Do not show configure for read/parse/storage failures.

### Build Order

1. **Lifecycle guard proof first** — Add service/action tests that demonstrate direct analyze/import calls cannot mutate `analyzing`, `importing`, or already `imported` rows and return safe localized errors. This retires the data-regression risk before UI wiring.
2. **Safe error mapping** — Replace raw `Error.message` propagation in `analyzeImportAction()` and `confirmImportAction()` with bounded Italian messages. Preserve special not-found handling needed by `AnalyzePage`, but do not expose object keys, URLs, stack traces, raw parser rows, or SDK messages.
3. **Pure CTA helper + table UI** — Introduce a pure helper near `ImportTable` (or `components/import/import-row-actions.tsx` if it gets large) to centralize the matrix. Render links/buttons with accessible labels and disabled in-progress states. Keep delete/rename dialogs as-is.
4. **Exact view-transactions filter** — If accepted as in-scope, add `importId` parsing and DAL filtering, then link imported rows to `/transactions?importId=...`. This can be parallelized after the CTA helper shape is known.
5. **Browser/component coverage** — Add fast component/static markup tests for row action visibility across statuses, plus targeted action/service tests for safe errors and duplicate-operation guards.

### Verification Approach

Use targeted verification before full milestone checks:

- `yarn vitest run tests/import-service.test.ts tests/import-actions.test.ts` — lifecycle guards, safe action mapping, selected retry regression coverage.
- `yarn vitest run tests/imports-dal.test.ts tests/import-actions.test.ts lib/validations/__tests__/import.test.ts` — import row/filter/action regressions.
- If adding transaction `importId`: `yarn vitest run tests/transactions-dal.test.ts lib/validations/__tests__/transactions.test.ts` or create equivalent coverage if those files do not exist.
- Add/extend a component test for `ImportTable`/row actions using `react-dom/server` or the project’s existing Vitest component style; verify status-specific labels/links and absence of unsafe diagnostics.
- `yarn lint` and `yarn check:language` after touching route strings, tests, or docs.
- Browser proof remains limited locally because authenticated `/import` redirects without seeded credentials (known memory MEM107). S06 should own full authenticated flow; S05 can add conditional Playwright smoke that asserts no secret diagnostics and action affordances when rows exist.

## Don't Hand-Roll

| Problem | Existing Solution | Why Use It |
|---------|------------------|------------|
| Delete impact/confirmation | `ImportDeleteDialog`, `previewImportDeletionAction`, `deleteImportAction`, `lib/services/import-deletion.ts` | Already tested for transactional reconciliation, safe counts, localized errors, and redaction. |
| Unknown-format configure flow | `/import/[fileId]/configure`, `ImportFormatWizard`, `createPrivateImportFormatAction` | S04 already solved private ownership, bounded samples, and same-file retry-ready state. |
| Retry analysis/import | `analyzeImportAction`, `confirmImportAction`, `analyzeFile`, `importFile` selected/stored format behavior | Avoids a parallel importer and preserves S04 fail-closed selected-format semantics. |
| URL-backed list behavior | S02 `ImportFilters`, `ImportTable` load-more pattern, transaction filters | Keeps server-first list and client interaction conventions consistent. |

## Constraints

- Developer-facing names/routes/tests/comments must stay English; user-facing UI copy and action errors should be Italian. Run `yarn check:language` after changes.
- AGENTS.md warns this Next.js version has breaking changes; executors should read relevant `node_modules/next/dist/docs/` docs before changing Next route/action behavior.
- Server actions must derive `userId` from `verifySession()` and ignore any client-supplied user id.
- Sensitive import diagnostics must not reach UI/action payloads: presigned URLs, object keys, raw file contents, credentials, raw SDK objects, stack traces, raw rows.
- Current `file_status` enum is fixed to `pending_upload`, `uploaded`, `analyzing`, `analyzed`, `importing`, `imported`, `failed`; S05 should not add statuses unless a migration is explicitly planned.
- `analyze/page.tsx` currently performs analysis on page load. This makes direct links convenient but means service guards are mandatory to avoid accidental state regression.

## Common Pitfalls

- **UI-only duplicate prevention is insufficient** — `ImportPreview` has a submit lock and the table can hide links, but direct POST/server calls can still invoke actions. Guard in service/action before state mutation.
- **Raw service errors currently leak through analyze/confirm actions** — S03/S04 actions are safe, but `analyzeImportAction()` and `confirmImportAction()` return `Error.message`. Add redaction tests with objectKey/https/stack/rawRow strings.
- **Unknown-format detection is duplicated** — The analyze page has a local `UNKNOWN_FORMAT_ERROR` constant. If table configure CTA uses the same logic, centralize or export a helper to avoid drift.
- **Approximate transaction links may not satisfy “view transactions”** — Platform/date filters can include unrelated transactions. Prefer `importId` filtering if implementing the CTA as real inspection.
- **Conditional state transitions can race** — A service-level `if (fileRow.status === 'importing')` guard helps, but two concurrent requests can still read the same state. Stronger protection is conditional update helpers that include expected statuses in the `where` clause.

## Open Risks

- Deciding whether `analyzed` rows should re-run analysis on `/analyze` or load stored stats only affects guard design. Re-running is current behavior and likely acceptable for S05, but it is not a true “view existing analysis” model.
- Exact `pending_upload` recovery is unclear. Since a pending upload may not exist in R2, exposing retry upload from history would require upload-session recovery not present in S01-S04; keep it passive unless product scope changes.

## Skills Discovered

| Technology | Skill | Status |
|------------|-------|--------|
| React / Next.js | `react-best-practices` | Installed in available skills; useful for component/action changes. |
| Browser/UI verification | `agent-browser` | Installed in available skills; useful for S06, optional for S05 smoke. |
| Drizzle ORM | `bobmatnyc/claude-mpm-skills@drizzle-orm` (`npx skills add bobmatnyc/claude-mpm-skills@drizzle-orm`) | Available, not installed; 4.2K installs, relevant if planner wants extra Drizzle guard/filter guidance. |
| Drizzle ORM patterns | `giuseppe-trisciuoglio/developer-kit@drizzle-orm-patterns` (`npx skills add giuseppe-trisciuoglio/developer-kit@drizzle-orm-patterns`) | Available, not installed; 699 installs. |