# Requirements

This file is the explicit capability and coverage contract for the project.

## Active

### R029 — Untitled
- Status: active
- Validation: M005/S01 partial validation: existing expense, transaction, and pattern Server Actions now call the shared categorization revalidation helper on successful mutations only; focused Vitest passed 37/37 for exact route-set and no-revalidation failure-path coverage. Future category-management actions remain to be added in downstream slices before full validation.
- Notes: S01 added `revalidateCategorizationSurfaces()` for `/expenses`, `/transactions`, `/dashboard`, `/settings/patterns`, and `/settings/categories` and covered current categorization-related action entrypoints.

### R038 — Deploy the existing Sparter app as a zero-euro personal/demo production on Vercel Hobby/free.
- Class: launchability
- Status: active
- Description: Deploy the existing Sparter app as a zero-euro personal/demo production on Vercel Hobby/free.
- Why it matters: The user wants to use the app personally and show it around without recurring cost in the first version.
- Source: user
- Primary owning slice: M007/S01
- Supporting slices: M007/S05
- Validation: mapped
- Notes: This is not commercial production; free-tier limits and lack of SLA are accepted constraints.

### R039 — Configure Supabase Free Postgres as the production database target for the deployed app.
- Class: integration
- Status: active
- Description: Configure Supabase Free Postgres as the production database target for the deployed app.
- Why it matters: The deployed app needs persistent production data while staying inside the zero-euro constraint.
- Source: user
- Primary owning slice: M007/S01
- Supporting slices: M007/S02, M007/S05
- Validation: mapped
- Notes: Use one production Supabase project for the first version; staging is deferred.

### R041 — Configure Cloudflare R2 production storage so upload/import flows work in the deployed app.
- Class: integration
- Status: active
- Description: Configure Cloudflare R2 production storage so upload/import flows work in the deployed app.
- Why it matters: Imports depend on browser uploads to R2; a deployed demo without upload storage would not prove the product loop.
- Source: user
- Primary owning slice: M007/S03
- Supporting slices: M007/S05
- Validation: mapped
- Notes: Preserve existing no-secret/no-presigned-URL logging rules and verify with a real small-file smoke path.

## Validated

### ADV-01 — Untitled
- Status: validated
- Validation: S06 verification: paid-plan custom regex CRUD service/actions/UI implemented, user patterns ordered before system patterns, free users denied. `tests/import-service.test.ts` included user-pattern precedence and free-user authorization; full slice vitest suite passed 56/56 and build passed.

### ADV-02 — Untitled
- Status: validated
- Validation: S06 verification: manual bulk categorization writes classification history and Tier 2 history categorization is covered in import service tests. Full slice vitest suite passed 56/56 and build passed.

### ADV-03 — Untitled
- Status: validated
- Validation: S06 verification: delivery-app regex seed for Deliveroo/JustEat/Glovo/Wolt mapped to take-away in docs/init and drizzle seeds; import/pattern tests and build passed.

### ADV-04 — Untitled
- Status: validated
- Validation: S06 verification: categorization pipeline returns uncategorized for free and applies Tier 1/Tier 2 for basic/pro, with tests for free/basic behavior and history/source rows. Full slice vitest suite passed 56/56 and build passed.

### IMP-01 — Untitled
- Status: validated
- Validation: S06 verification: upload page and file lifecycle API smoke/unit coverage passed. `npx vitest run tests/import-service.test.ts tests/import-utils.test.ts tests/import-detector.test.ts tests/import-api.test.ts tests/dashboard-dal.test.ts --reporter=verbose` passed 56/56; `npx playwright test tests/import.spec.ts --reporter=list` passed 5 runnable upload tests with 3 DB-dependent analyze tests skipped/fixme; `npm run build` passed.

### IMP-02 — Untitled
- Status: validated
- Validation: S06 verification: detector/parser format-version contracts and import service integration passed. Vitest slice suite passed 56/56 and production build passed.

### IMP-03 — Untitled
- Status: validated
- Validation: S06 verification: analyzeFile detects compatible platform/format and ImportPreview exposes candidate override UI. Vitest slice suite passed 56/56; Playwright upload/analyze smoke had 5 runnable passes and 3 DB-dependent fixme skips; build passed.

### IMP-04 — Untitled
- Status: validated
- Validation: S06 verification: ImportPreview displays row count, duplicates, detected platform/version, confidence, warnings, sample rows, and confirm/error states. Playwright import spec passed 5 runnable checks; build passed.

### IMP-05 — Untitled
- Status: validated
- Validation: S06 verification: transactional import service covers deduplication, expense aggregation by descriptionHash, rollback, free/basic categorization and history rows. Vitest slice suite passed 56/56; build passed.

### R001 — Untitled
- Status: validated
- Validation: M002/S01 verification: `lib/logger.ts` exports server-only Pino singleton and config helpers; dev selects pino-pretty, no-token production/test uses JSON stdout, Better Stack token selects transport; `yarn vitest run tests/logger.test.ts` passed 13/13; lint/build passed; critical upload console scan passed.

### R005 — Untitled
- Status: validated
- Validation: M002/S01 verification: AsyncLocalStorage helpers `withLogContext`, `getLogContext`, and `withUserId` propagate userId/extra context without per-log auth lookups; tests cover session lookup, no-session fallback, session failure fallback, staging user bypass, nested merge/override, and cleanup; `yarn vitest run tests/logger.test.ts` passed 13/13.

### R006 — Untitled
- Status: validated
- Validation: M002/S01 verification: `.env.example` documents optional `BETTERSTACK_SOURCE_TOKEN` and `BETTERSTACK_INGESTING_URL`; logger config tests prove Better Stack transport activation, stdout preservation, endpoint override, and token redaction boundaries; fresh slice verification exited 0.

### R007 — Users can manage an import history table showing every import in every lifecycle state, not only completed imports.
- Class: primary-user-loop
- Status: validated
- Description: Users can manage an import history table showing every import in every lifecycle state, not only completed imports.
- Why it matters: The user needs to understand what happened to each upload/import and decide whether to retry, configure, confirm, rename, inspect, or delete it.
- Source: user
- Primary owning slice: M004/S01
- Supporting slices: M004/S02, M004/S05
- Validation: M004/S06 confirmed R007 satisfied: import-row-actions.tsx covers all 7 file_status values (pending_upload/uploaded/analyzing/analyzed/importing/imported/failed) with lifecycle-appropriate CTAs. 336 vitest tests pass, Playwright IMP-01/IMP-03/IMP-04 browser tests pass. Cross-audited in S06/T02 against delivered codebase.
- Notes: Includes pending_upload, uploaded, analyzing, analyzed, importing, imported, and failed states.

### R008 — Each import records and displays file/import statistics: positive total, negative total, rows or transactions read, transactions actually imported, duplicate/skipped count, platform name, and transaction date range.
- Class: core-capability
- Status: validated
- Description: Each import records and displays file/import statistics: positive total, negative total, rows or transactions read, transactions actually imported, duplicate/skipped count, platform name, and transaction date range.
- Why it matters: The import list must explain what each import contributed and whether duplicate detection skipped rows.
- Source: user
- Primary owning slice: M004/S01
- Supporting slices: M004/S02
- Validation: M004/S06 confirmed R008 satisfied: all stat fields (positiveTotal, negativeTotal, rowCount, importedCount, duplicateCount, platform name, referenceStartedAt/referenceEndedAt) present in schema (0007_import_management_stats.sql), DAL projections (lib/dal/imports.ts), and import-table UI. Cross-audited in S06/T02 against delivered codebase.
- Notes: Statistics must reflect deduplication: overlapping files can have fewer imported transactions than parsed rows.

### R009 — Users can rename imports and filter/search imports by imported-at date and file reference date range.
- Class: core-capability
- Status: validated
- Description: Users can rename imports and filter/search imports by imported-at date and file reference date range.
- Why it matters: Users need to find and organize import records after multiple uploaded bank files.
- Source: user
- Primary owning slice: M004/S02
- Supporting slices: M004/S01
- Validation: M004/S02 verified import rename and URL-backed search/imported-date/reference-date filtering through unit/integration tests (`yarn vitest lib/validations/__tests__/import.test.ts tests/imports-dal.test.ts tests/import-actions.test.ts`: 28 passed) and browser coverage (`yarn playwright test tests/import.spec.ts --grep "IMP-03"`: 3 passed).
- Notes: The file table remains the storage model; product-facing UI presents imports.

### R010 — Deleting an import removes its linked transactions and reconciles affected expenses in a single atomic operation.
- Class: core-capability
- Status: validated
- Description: Deleting an import removes its linked transactions and reconciles affected expenses in a single atomic operation.
- Why it matters: Import deletion is dangerous unless transaction removal, expense recalculation, and empty-expense cleanup succeed or fail together.
- Source: user
- Primary owning slice: M004/S03
- Supporting slices: M004/S06
- Validation: M004/S03 verified safe import deletion with `yarn vitest run tests/import-deletion-service.test.ts tests/import-actions.test.ts tests/import-delete-impact-summary.test.tsx` (30 tests passing) plus `yarn check:language`. Service tests cover user-scoped linked transaction removal, expense recalculation, empty non-manual expense deletion, and rollback on forced mid-transaction failure.
- Notes: The implementation must not rely only on FK cascade because expense aggregates require business reconciliation.

### R011 — Expenses with explicit user classification history (`manual` or `override`) are preserved even if import deletion leaves them with zero linked transactions.
- Class: continuity
- Status: validated
- Description: Expenses with explicit user classification history (`manual` or `override`) are preserved even if import deletion leaves them with zero linked transactions.
- Why it matters: The user considers manually categorized expenses valuable history that should not be lost as a side effect of deleting an imported file.
- Source: user
- Primary owning slice: M004/S03
- Supporting slices: M004/S06
- Validation: M004/S03 verified manual/override preservation with `tests/import-deletion-service.test.ts`, including expenses left with zero linked transactions but `expense_classification_history.source` of `manual` or `override`, plus UI summary copy explaining preservation.
- Notes: These expenses remain visible in the expense table and become categorization memory / future link targets for manually-created transactions.

### R012 — Unknown import formats lead to a recovery wizard instead of a dead-end failure.
- Class: failure-visibility
- Status: validated
- Description: Unknown import formats lead to a recovery wizard instead of a dead-end failure.
- Why it matters: When a bank file is not recognized, the user should be able to teach the app the format and continue with the same file.
- Source: user
- Primary owning slice: M004/S04
- Supporting slices: M004/S05, M004/S06
- Validation: S04 delivered and verified unknown-format recovery wizard: unknown analysis shows configure CTA, wizard loads bounded owner-only headers/sample context, creates private format, resets same file to uploaded with selected format, and retry analysis/import uses that format. Evidence: gsd_exec cefc75ad ran required S04 Vitest suites (92 tests), yarn lint, and yarn check:language with exit 0.
- Notes: The wizard must allow selecting or creating a platform and configuring the base import fields needed to retry analysis/import.

### R013 — User-created platforms and import format configurations are private to that user initially, while the schema leaves room for future admin review and global promotion.
- Class: compliance/security
- Status: validated
- Description: User-created platforms and import format configurations are private to that user initially, while the schema leaves room for future admin review and global promotion.
- Why it matters: Users must be able to unblock themselves without accidentally changing import detection behavior for everyone else.
- Source: user
- Primary owning slice: M004/S04
- Supporting slices: M004/S06
- Validation: S04 delivered and verified private/global import format ownership: platform and import_format_version have ownerUserId/visibility/reviewStatus, DAL returns global approved or current-user private formats only, selected private formats fail closed across users, and wizard-created rows are private draft rows. Evidence: gsd_exec cefc75ad ran tests/import-private-formats-dal.test.ts, tests/import-format-wizard-actions.test.ts, tests/import-service.test.ts, tests/import-detector.test.ts and related validation/UI suites with exit 0.
- Notes: No admin review UI is included in M004; avoid global publication of unreviewed user-created formats.

### R014 — Import rows expose state-aware actions and retry paths for recoverable states such as failed, uploaded, and analyzed.
- Class: failure-visibility
- Status: validated
- Description: Import rows expose state-aware actions and retry paths for recoverable states such as failed, uploaded, and analyzed.
- Why it matters: The import list should be an operational control surface, not just a passive history table.
- Source: user
- Primary owning slice: M004/S05
- Supporting slices: M004/S01, M004/S04
- Validation: S05 delivered: ImportRowActions renders lifecycle-appropriate CTAs for all 7 file_status values (pending_upload/uploaded/analyzing/analyzed/importing/imported/failed). analyzeFile() and importFile() reject duplicate in-progress and already-imported operations via constant-set guards checked before any side effects. 131 tests passing across import-service, import-actions, import-table-actions, transactions-dal, and transactions validation suites.
- Notes: States in progress must prevent duplicate actions; failed unknown-format imports should route to format configuration.

### R015 — The full import-management flow works end-to-end: upload, analyze, unknown-format recovery, retry, import, inspect statistics, rename/filter, and safe deletion.
- Class: integration
- Status: validated
- Description: The full import-management flow works end-to-end: upload, analyze, unknown-format recovery, retry, import, inspect statistics, rename/filter, and safe deletion.
- Why it matters: The milestone spans UI, DB, R2-backed file lifecycle, import detection, server actions, and expense reconciliation; contract tests alone do not prove the user-visible flow.
- Source: inferred
- Primary owning slice: M004/S06
- Supporting slices: M004/S01, M004/S02, M004/S03, M004/S04, M004/S05
- Validation: M004/S06 verified full import-management flow: 336 vitest tests pass, tsc/lint/check:language/build all exit 0, Playwright IMP-01/IMP-03/IMP-04/IMP-05/IMP-06 (12 tests) pass. All 8 key files confirmed wired end-to-end: /import page, analyze/configure pages, delete dialog, row-actions CTA matrix, transactions DAL importId filter, and import reconciliation service. IMP-02 fixme group (5 tests) is a planned gap requiring a real R2 file, documented as staging-only.
- Notes: Final integration slice must prove the assembled `/import` experience in a real app environment.

### R016 — Import-management errors are user-readable and safe: Italian UI errors, sanitized server logs, no presigned URLs, raw file contents, credentials, stack traces, or raw SDK objects exposed.
- Class: failure-visibility
- Status: validated
- Description: Import-management errors are user-readable and safe: Italian UI errors, sanitized server logs, no presigned URLs, raw file contents, credentials, stack traces, or raw SDK objects exposed.
- Why it matters: Import management touches destructive operations and uploaded financial files, so users and future agents need diagnostics without leaking sensitive data.
- Source: inferred
- Primary owning slice: M004/S05
- Supporting slices: M004/S03, M004/S04, M004/S06
- Validation: S05 delivered: mapAnalyzeError/mapConfirmError in action layer allowlist-only pass-through known Italian lifecycle messages; all other errors collapse to generic Italian fallback. Redaction tests assert objectKey, https://, and stack frame substrings are absent from action return values. No presigned URLs, raw file contents, credentials, or raw SDK objects in action payloads.
- Notes: Logs should include bounded metadata such as userId, fileId, phase/state, and short error message.

### R030 — Untitled
- Status: validated
- Validation: M005/S01 verification: desktop sidebar and mobile bottom nav no longer render `/categories`; `yarn playwright test tests/layout.spec.ts --grep "categories|/categories" --reporter=list` passed 2/2 and static href scan found no stale `/categories` href in `components/layout` or `lib/routes`.
- Notes: M006/S01 advanced this by adding `/dashboard/overview`, redirecting `/dashboard` to `/dashboard/overview`, adding dashboard route constants, and rendering shared tab nav from the dashboard layout. `/dashboard/categories` and drill-down remain for S02/S03 before full validation.

### R031 — Category settings route constant (`/settings/categories`) is canonicalized in `APP_ROUTES` and used consistently for navigation, revalidation, and links.
- Class: operability
- Status: validated
- Description: Category settings route constant (`/settings/categories`) is canonicalized in `APP_ROUTES` and used consistently for navigation, revalidation, and links.
- Why it matters: Without a single route constant, different slices would duplicate the string literal, risking drift between nav links, revalidation targets, and redirect paths.
- Source: M005 planning — categories management milestone
- Primary owning slice: M005/S01
- Supporting slices: M005/S02, M005/S03, M005/S04
- Validation: M005/S01: `APP_ROUTES.categorySettings` introduced in `lib/routes.ts`; consumed by S02/S03/S04 revalidation and navigation without string-literal duplication.

### R032 — Users can create, rename, and delete their own categories and subcategories; the schema supports user-owned rows alongside system taxonomy via nullable `userId` owner columns and scoped partial unique indexes.
- Class: core-capability
- Status: validated
- Description: Users can create, rename, and delete their own categories and subcategories; the schema supports user-owned rows alongside system taxonomy via nullable `userId` owner columns and scoped partial unique indexes.
- Why it matters: Users need a personal taxonomy layer on top of the system categories to organize expenses according to their own spending habits without altering shared system rows.
- Source: M005 planning — user-managed category taxonomy
- Primary owning slice: M005/S02
- Supporting slices: M005/S03
- Validation: M005/S02: nullable userId owner columns, scoped partial unique indexes, merged DAL returning isOwned metadata; migration 0010 applied. M005/S03: authenticated CRUD Server Actions and delete guards delivered and Playwright-acceptance-tested.

### R033 — Users can rename any system subcategory with a personal display-name override that is stored separately from the system taxonomy and exposed via the merged category tree.
- Class: core-capability
- Status: validated
- Description: Users can rename any system subcategory with a personal display-name override that is stored separately from the system taxonomy and exposed via the merged category tree.
- Why it matters: System subcategory names are fixed Italian taxonomy labels; users need the ability to personalize labels (e.g. rename "Ristoranti" to "Pranzi fuori") without affecting other users or the seeded system data.
- Source: M005 planning — per-user subcategory rename overrides
- Primary owning slice: M005/S02
- Supporting slices: M005/S03
- Validation: M006/S01 validation: `/dashboard/overview` renders the migrated KPI cards and extended MonthlyTrendChart with total IN, total OUT, and derived balance. Balance is computed with Decimal.js and rendered as a line with green/red per-point dots for positive/negative months; closeout verification passed `yarn tsc --noEmit`, `yarn build`, and `yarn check:language`.
- Notes: Validated by S01. Future slices may reuse the chart but are not required for the overview IN/OUT/balance capability.

### R034 — The expense categorize dialog uses a single searchable combobox filtered by expense type; typing in the combobox searches across display name, original name, category name, and slug.
- Class: primary-user-loop
- Status: validated
- Description: The expense categorize dialog uses a single searchable combobox filtered by expense type; typing in the combobox searches across display name, original name, category name, and slug.
- Why it matters: The previous two-step chained select (category → subcategory) was slow and non-searchable; a combobox with multi-field search lets users find the right subcategory in one keystroke.
- Source: M005 planning — searchable merged category combobox
- Primary owning slice: M005/S04
- Supporting slices: M005/S02
- Validation: M005/S04: `buildCategoryOptions()` with `allowedCategoryTypes` filter; `filterCategoryOptions()` searches label, originalName, categoryName, slug; 18 Vitest helper tests pass; `CategoryCombobox` wired into both expense dialogs.
- Notes: M006/S01 advanced this by making dashboard filters path-aware, adding an overview-only preset selector, and extending `parseDashboardFilters` with an optional per-route default preset. Cross-tab persistence remains to be proven once S02/S03 routes exist.

### R035 — Category and subcategory ownership is established in the schema and enforced at the Server Action layer; delete operations are blocked for system rows and for user-owned rows that still have linked expenses.
- Class: compliance/security
- Status: validated
- Description: Category and subcategory ownership is established in the schema and enforced at the Server Action layer; delete operations are blocked for system rows and for user-owned rows that still have linked expenses.
- Why it matters: Without ownership distinction and delete guards, users could inadvertently or maliciously delete system taxonomy rows or lose expense links by deleting a subcategory that expenses still reference.
- Source: M005 planning — ownership-based delete guards
- Primary owning slice: M005/S02
- Supporting slices: M005/S03
- Validation: M005/S02: ownership distinction established in schema/DAL. M005/S03: `isLinkedExpenseCount` and delete guards implemented; system rows rejected; linked-expense blocking with Italian error; Playwright acceptance passed.

### R036 — User-owned subcategories are visually distinguished by a 'Personale' badge in the category combobox; the dead `/categories` navigation link is removed from both desktop and mobile app shell.
- Class: operability
- Status: validated
- Description: User-owned subcategories are visually distinguished by a 'Personale' badge in the category combobox; the dead `/categories` navigation link is removed from both desktop and mobile app shell.
- Why it matters: The badge lets users instantly identify their custom subcategories among system ones; the stale nav link removal prevents confusion about a non-existent route.
- Source: M005 planning — personal-category badge and nav cleanup
- Primary owning slice: M005/S01
- Supporting slices: M005/S02, M005/S04
- Validation: M005/S01: Playwright passed both desktop sidebar and mobile bottom-nav absence checks; static rg scan found no stale `/categories` href. M005/S04: `isOwned` flag drives Personale badge in CategoryCombobox; 4 Playwright browser tests cover badge visibility.

### R037 — All categorization mutation entrypoints (expense, transaction, pattern, and category management actions) revalidate the full set of category-displaying routes via a shared `revalidateCategorizationSurfaces()` helper.
- Class: integration
- Status: validated
- Description: All categorization mutation entrypoints (expense, transaction, pattern, and category management actions) revalidate the full set of category-displaying routes via a shared `revalidateCategorizationSurfaces()` helper.
- Why it matters: Without a shared revalidation helper each action would maintain its own route list, leading to drift where some pages show stale data after a categorization change.
- Source: M005 planning — shared categorization revalidation across all mutation entrypoints
- Primary owning slice: M005/S01
- Supporting slices: M005/S03
- Validation: M005/S01: `revalidateCategorizationSurfaces()` wired into expense/transaction/pattern actions. M005/S03: category management actions use the helper via `successAfterRevalidation()` wrapper. 37 Vitest tests assert the exact route-set contract; S01-UAT confirms cross-route revalidation without page reload.

### R040 — Provide an explicit local manual Drizzle migration flow for applying generated SQL migrations to Supabase production.
- Class: operability
- Status: validated
- Description: Provide an explicit local manual Drizzle migration flow for applying generated SQL migrations to Supabase production.
- Why it matters: Schema changes must reach production predictably without adding risky automated migration-on-deploy behavior.
- Source: user
- Primary owning slice: M007/S02
- Supporting slices: M007/S05
- Validation: M007/S02 verified `yarn db:migrate:production` wiring, production-only env guardrails, missing-target/confirmation failure before DB access, sanitized diagnostics, bounded migration pool settings, and documentation via `yarn vitest tests/migration-config.test.ts`, negative redaction command, `yarn lint`, `yarn check:language`, and `yarn build`.
- Notes: Live application against the real Supabase target remains an operator/S05 smoke-runbook activity, but the explicit local manual Drizzle migration flow contract is implemented and locally validated.

### R042 — Public registration can be enabled for demos and disabled by an app-level server-enforced flag without breaking login for existing users.
- Class: compliance/security
- Status: validated
- Description: Public registration can be enabled for demos and disabled by an app-level server-enforced flag without breaking login for existing users.
- Why it matters: Anyone with the URL may register, so the owner needs a simple zero-cost guardrail against quota abuse or demo shutdown.
- Source: user
- Primary owning slice: M007/S04
- Supporting slices: M007/S05
- Validation: S04 verified a centralized server-only REGISTRATION_ENABLED parser, blocked signup in signUpAction without calling Better Auth, blocked direct POST /api/auth/sign-up/email with a sanitized 403 response, and preserved existing-user signin delegation. Fresh closeout verification passed: yarn vitest tests/registration-config.test.ts tests/auth-actions-registration.test.ts tests/auth-route-registration.test.ts && yarn lint && yarn check:language && yarn build (gsd_exec a173d09a-b2b1-401a-8eea-9f1a7f140373).
- Notes: Validated by M007/S04 registration control guardrail; S05 still owns deployed production smoke evidence.

### R043 — Production health and smoke diagnostics distinguish DB, R2, deploy, signup, and import readiness without exposing secrets.
- Class: failure-visibility
- Status: validated
- Description: Production health and smoke diagnostics distinguish DB, R2, deploy, signup, and import readiness without exposing secrets.
- Why it matters: The next agent and the user need clear signals when a free-tier dependency, env var, or deploy step fails.
- Source: inferred
- Primary owning slice: M007/S05
- Supporting slices: M007/S01, M007/S02, M007/S03, M007/S04
- Validation: S05 verified: production smoke CLI (scripts/production-smoke.mjs) emits bounded JSONL with safe-field whitelist covering health, signup-disabled, and unexpected-error events. Playwright spec (tests/production-smoke.spec.ts) skips by default and validates diagnostic assertions for forbidden secret patterns when live. All 84 Vitest tests + PLAYWRIGHT_PRODUCTION_SMOKE=0 playwright tests pass.
- Notes: M007/S02 advanced failure visibility for migration operations with sanitized JSON CLI diagnostics and stable safe error codes; broader production DB/R2/deploy/signup/import readiness diagnostics remain owned by M007/S05.

### R044 — Document a repeatable production runbook for local migration, Vercel deploy/redeploy, health check, signup/login check, and R2 import smoke test.
- Class: operability
- Status: validated
- Description: Document a repeatable production runbook for local migration, Vercel deploy/redeploy, health check, signup/login check, and R2 import smoke test.
- Why it matters: A zero-cost production setup is only useful if the user can repeat the deploy and diagnose failures without guessing.
- Source: inferred
- Primary owning slice: M007/S05
- Supporting slices: M007/S01, M007/S02, M007/S03, M007/S04
- Validation: S05 verified: docs/deploy/vercel-supabase-r2.md contains an ordered integrated production smoke sequence covering first deploy, migration, Vercel env/redeploy, /api/health, signup/login enabled, disabled signup/direct API 403, preserved login, R2 import, failure triage, evidence capture, free-tier constraints, and recovery. Runbook content smoke Python script confirmed all required terms present and no secret values embedded.
- Notes: M007/S02 advanced the production runbook by documenting the local migration-only env contract, guarded command, warnings, and free-tier migration constraints; integrated deploy/redeploy, health, signup/login, and R2 import runbook proof remains in M007/S05.

### R045 — Free-tier limitations for Vercel, Supabase, and Cloudflare R2 are explicit production constraints for this version.
- Class: constraint
- Status: validated
- Description: Free-tier limitations for Vercel, Supabase, and Cloudflare R2 are explicit production constraints for this version.
- Why it matters: The user explicitly wants to spend zero euros, so platform limits must shape scope and expectations.
- Source: user
- Primary owning slice: M007/S05
- Supporting slices: M007/S01
- Validation: S05 verified: docs/deploy/vercel-supabase-r2.md explicitly documents Vercel Hobby, Supabase Free, and Cloudflare R2 free-tier constraints as production scope boundaries. Runbook content smoke confirmed 'free-tier' term present.
- Notes: Document personal/demo scope, no SLA, Supabase Free pause/inactivity risk, DB/storage/egress limits, and when signup should be disabled or paid plans considered.

## Deferred

### R017 — API-backed imports are supported by the product model in the future but are not implemented in M004.
- Class: differentiator
- Status: deferred
- Description: API-backed imports are supported by the product model in the future but are not implemented in M004.
- Why it matters: The user explicitly wants importazioni as the product concept because files are only the first source type.
- Source: user
- Primary owning slice: none
- Supporting slices: none
- Validation: unmapped
- Notes: M004 keeps the UI/DAL terminology import-oriented while retaining the current file-backed table.

### R018 — Admins can review user-created import configurations and promote them to globally available formats.
- Class: admin/support
- Status: deferred
- Description: Admins can review user-created import configurations and promote them to globally available formats.
- Why it matters: Global formats should be reviewed before affecting all users.
- Source: user
- Primary owning slice: none
- Supporting slices: none
- Validation: unmapped
- Notes: M004 only prepares ownership/scope fields; review UI/workflow is future work.

### R019 — Advanced import-format transformations are configurable after the base wizard when a simple field mapping is not enough.
- Class: core-capability
- Status: deferred
- Description: Advanced import-format transformations are configurable after the base wizard when a simple field mapping is not enough.
- Why it matters: The user wants the first wizard limited to base fields and advanced transforms only later if imports do not produce useful results.
- Source: user
- Primary owning slice: none
- Supporting slices: none
- Validation: unmapped
- Notes: Examples include richer date transforms, numeric transforms, sign rules, and ignored columns; out of the initial M004 wizard.

### R020 — Manual transaction creation can optionally link the new transaction to an existing expense found through search instead of always creating a new one-to-one expense.
- Class: core-capability
- Status: deferred
- Description: Manual transaction creation can optionally link the new transaction to an existing expense found through search instead of always creating a new one-to-one expense.
- Why it matters: Preserved manually categorized expenses become valuable future targets for manually-created transactions.
- Source: user
- Primary owning slice: none
- Supporting slices: none
- Validation: unmapped
- Notes: Mentioned as future use for preserved empty manual expenses; not part of M004.

### R046 — A separate staging Supabase/Vercel environment may be introduced later, but is not part of the first zero-euro production version.
- Class: operability
- Status: deferred
- Description: A separate staging Supabase/Vercel environment may be introduced later, but is not part of the first zero-euro production version.
- Why it matters: Staging improves safety but adds setup overhead and consumes free-plan project capacity.
- Source: user
- Primary owning slice: none
- Supporting slices: none
- Validation: unmapped
- Notes: One production Supabase project is sufficient for M007; future stronger production can add staging.

### R047 — Automated migrations in CI/CD or deployment pipelines are deferred beyond the first production/demo version.
- Class: operability
- Status: deferred
- Description: Automated migrations in CI/CD or deployment pipelines are deferred beyond the first production/demo version.
- Why it matters: Migration automation is useful later, but risky and unnecessary for the initial personal/demo deployment.
- Source: user
- Primary owning slice: none
- Supporting slices: none
- Validation: unmapped
- Notes: M007 uses intentional local migration commands instead of deploy-time migration automation.

### R048 — Production-grade backup/restore automation and SLA-level operations are deferred beyond the zero-euro version.
- Class: operability
- Status: deferred
- Description: Production-grade backup/restore automation and SLA-level operations are deferred beyond the zero-euro version.
- Why it matters: The zero-euro constraint excludes paid-grade operational guarantees in this milestone.
- Source: inferred
- Primary owning slice: none
- Supporting slices: none
- Validation: unmapped
- Notes: M007 documents Supabase Free backup/SLA limitations instead of implementing a paid-grade operations model.

### R049 — Scaling beyond personal/demo traffic is deferred beyond this milestone.
- Class: quality-attribute
- Status: deferred
- Description: Scaling beyond personal/demo traffic is deferred beyond this milestone.
- Why it matters: The user only needs personal use and demos for the first version.
- Source: user
- Primary owning slice: none
- Supporting slices: none
- Validation: unmapped
- Notes: The app should fail visibly and be operable at low demo traffic, not prove commercial scale.

## Out of Scope

### R021 — M004 must not rename the existing DB `file` table as part of import management.
- Class: anti-feature
- Status: out-of-scope
- Description: M004 must not rename the existing DB `file` table as part of import management.
- Why it matters: A schema rename would add risk without delivering the user-visible import-management behavior.
- Source: user
- Primary owning slice: none
- Supporting slices: none
- Validation: n/a
- Notes: Use import-oriented naming in UI/DAL while preserving schema table identity.

### R022 — User-created import formats must not be automatically published globally for all users.
- Class: anti-feature
- Status: out-of-scope
- Description: User-created import formats must not be automatically published globally for all users.
- Why it matters: Unreviewed bank format configs could break detection or imports for other users.
- Source: user
- Primary owning slice: none
- Supporting slices: none
- Validation: n/a
- Notes: Global promotion requires a future admin review workflow.

### R050 — Paid Vercel or Supabase plans are out of scope for the first production/demo version.
- Class: anti-feature
- Status: out-of-scope
- Description: Paid Vercel or Supabase plans are out of scope for the first production/demo version.
- Why it matters: The user explicitly requires zero recurring spend for this version.
- Source: user
- Primary owning slice: none
- Supporting slices: none
- Validation: n/a
- Notes: Any future move to paid infrastructure belongs to a later milestone.

### R051 — Do not use `drizzle-kit push` against production.
- Class: anti-feature
- Status: out-of-scope
- Description: Do not use `drizzle-kit push` against production.
- Why it matters: Pushing schema directly to production is less auditable and contradicts the existing project migration convention.
- Source: project constraint
- Primary owning slice: none
- Supporting slices: none
- Validation: n/a
- Notes: Production schema changes must use generated SQL migrations and the controlled migration flow.

### R052 — Do not implement the registration guardrail as UI-only hiding; registration disabling must be server-enforced.
- Class: anti-feature
- Status: out-of-scope
- Description: Do not implement the registration guardrail as UI-only hiding; registration disabling must be server-enforced.
- Why it matters: A UI-only guard would not protect free-tier quota or access boundaries.
- Source: inferred
- Primary owning slice: none
- Supporting slices: none
- Validation: n/a
- Notes: The register page can reflect disabled state, but the server action/auth path must also reject new signups.

### R053 — Do not change ORM, database provider, or storage provider as part of M007.
- Class: anti-feature
- Status: out-of-scope
- Description: Do not change ORM, database provider, or storage provider as part of M007.
- Why it matters: Provider replacement would add migration risk without helping the zero-euro deploy objective.
- Source: inferred
- Primary owning slice: none
- Supporting slices: none
- Validation: n/a
- Notes: Keep Drizzle, Supabase Postgres, and Cloudflare R2 for this milestone.

## Traceability

| ID | Class | Status | Primary owner | Supporting | Proof |
|---|---|---|---|---|---|
| ADV-01 |  | validated | none | none | S06 verification: paid-plan custom regex CRUD service/actions/UI implemented, user patterns ordered before system patterns, free users denied. `tests/import-service.test.ts` included user-pattern precedence and free-user authorization; full slice vitest suite passed 56/56 and build passed. |
| ADV-02 |  | validated | none | none | S06 verification: manual bulk categorization writes classification history and Tier 2 history categorization is covered in import service tests. Full slice vitest suite passed 56/56 and build passed. |
| ADV-03 |  | validated | none | none | S06 verification: delivery-app regex seed for Deliveroo/JustEat/Glovo/Wolt mapped to take-away in docs/init and drizzle seeds; import/pattern tests and build passed. |
| ADV-04 |  | validated | none | none | S06 verification: categorization pipeline returns uncategorized for free and applies Tier 1/Tier 2 for basic/pro, with tests for free/basic behavior and history/source rows. Full slice vitest suite passed 56/56 and build passed. |
| IMP-01 |  | validated | none | none | S06 verification: upload page and file lifecycle API smoke/unit coverage passed. `npx vitest run tests/import-service.test.ts tests/import-utils.test.ts tests/import-detector.test.ts tests/import-api.test.ts tests/dashboard-dal.test.ts --reporter=verbose` passed 56/56; `npx playwright test tests/import.spec.ts --reporter=list` passed 5 runnable upload tests with 3 DB-dependent analyze tests skipped/fixme; `npm run build` passed. |
| IMP-02 |  | validated | none | none | S06 verification: detector/parser format-version contracts and import service integration passed. Vitest slice suite passed 56/56 and production build passed. |
| IMP-03 |  | validated | none | none | S06 verification: analyzeFile detects compatible platform/format and ImportPreview exposes candidate override UI. Vitest slice suite passed 56/56; Playwright upload/analyze smoke had 5 runnable passes and 3 DB-dependent fixme skips; build passed. |
| IMP-04 |  | validated | none | none | S06 verification: ImportPreview displays row count, duplicates, detected platform/version, confidence, warnings, sample rows, and confirm/error states. Playwright import spec passed 5 runnable checks; build passed. |
| IMP-05 |  | validated | none | none | S06 verification: transactional import service covers deduplication, expense aggregation by descriptionHash, rollback, free/basic categorization and history rows. Vitest slice suite passed 56/56; build passed. |
| R001 |  | validated | none | none | M002/S01 verification: `lib/logger.ts` exports server-only Pino singleton and config helpers; dev selects pino-pretty, no-token production/test uses JSON stdout, Better Stack token selects transport; `yarn vitest run tests/logger.test.ts` passed 13/13; lint/build passed; critical upload console scan passed. |
| R005 |  | validated | none | none | M002/S01 verification: AsyncLocalStorage helpers `withLogContext`, `getLogContext`, and `withUserId` propagate userId/extra context without per-log auth lookups; tests cover session lookup, no-session fallback, session failure fallback, staging user bypass, nested merge/override, and cleanup; `yarn vitest run tests/logger.test.ts` passed 13/13. |
| R006 |  | validated | none | none | M002/S01 verification: `.env.example` documents optional `BETTERSTACK_SOURCE_TOKEN` and `BETTERSTACK_INGESTING_URL`; logger config tests prove Better Stack transport activation, stdout preservation, endpoint override, and token redaction boundaries; fresh slice verification exited 0. |
| R007 | primary-user-loop | validated | M004/S01 | M004/S02, M004/S05 | M004/S06 confirmed R007 satisfied: import-row-actions.tsx covers all 7 file_status values (pending_upload/uploaded/analyzing/analyzed/importing/imported/failed) with lifecycle-appropriate CTAs. 336 vitest tests pass, Playwright IMP-01/IMP-03/IMP-04 browser tests pass. Cross-audited in S06/T02 against delivered codebase. |
| R008 | core-capability | validated | M004/S01 | M004/S02 | M004/S06 confirmed R008 satisfied: all stat fields (positiveTotal, negativeTotal, rowCount, importedCount, duplicateCount, platform name, referenceStartedAt/referenceEndedAt) present in schema (0007_import_management_stats.sql), DAL projections (lib/dal/imports.ts), and import-table UI. Cross-audited in S06/T02 against delivered codebase. |
| R009 | core-capability | validated | M004/S02 | M004/S01 | M004/S02 verified import rename and URL-backed search/imported-date/reference-date filtering through unit/integration tests (`yarn vitest lib/validations/__tests__/import.test.ts tests/imports-dal.test.ts tests/import-actions.test.ts`: 28 passed) and browser coverage (`yarn playwright test tests/import.spec.ts --grep "IMP-03"`: 3 passed). |
| R010 | core-capability | validated | M004/S03 | M004/S06 | M004/S03 verified safe import deletion with `yarn vitest run tests/import-deletion-service.test.ts tests/import-actions.test.ts tests/import-delete-impact-summary.test.tsx` (30 tests passing) plus `yarn check:language`. Service tests cover user-scoped linked transaction removal, expense recalculation, empty non-manual expense deletion, and rollback on forced mid-transaction failure. |
| R011 | continuity | validated | M004/S03 | M004/S06 | M004/S03 verified manual/override preservation with `tests/import-deletion-service.test.ts`, including expenses left with zero linked transactions but `expense_classification_history.source` of `manual` or `override`, plus UI summary copy explaining preservation. |
| R012 | failure-visibility | validated | M004/S04 | M004/S05, M004/S06 | S04 delivered and verified unknown-format recovery wizard: unknown analysis shows configure CTA, wizard loads bounded owner-only headers/sample context, creates private format, resets same file to uploaded with selected format, and retry analysis/import uses that format. Evidence: gsd_exec cefc75ad ran required S04 Vitest suites (92 tests), yarn lint, and yarn check:language with exit 0. |
| R013 | compliance/security | validated | M004/S04 | M004/S06 | S04 delivered and verified private/global import format ownership: platform and import_format_version have ownerUserId/visibility/reviewStatus, DAL returns global approved or current-user private formats only, selected private formats fail closed across users, and wizard-created rows are private draft rows. Evidence: gsd_exec cefc75ad ran tests/import-private-formats-dal.test.ts, tests/import-format-wizard-actions.test.ts, tests/import-service.test.ts, tests/import-detector.test.ts and related validation/UI suites with exit 0. |
| R014 | failure-visibility | validated | M004/S05 | M004/S01, M004/S04 | S05 delivered: ImportRowActions renders lifecycle-appropriate CTAs for all 7 file_status values (pending_upload/uploaded/analyzing/analyzed/importing/imported/failed). analyzeFile() and importFile() reject duplicate in-progress and already-imported operations via constant-set guards checked before any side effects. 131 tests passing across import-service, import-actions, import-table-actions, transactions-dal, and transactions validation suites. |
| R015 | integration | validated | M004/S06 | M004/S01, M004/S02, M004/S03, M004/S04, M004/S05 | M004/S06 verified full import-management flow: 336 vitest tests pass, tsc/lint/check:language/build all exit 0, Playwright IMP-01/IMP-03/IMP-04/IMP-05/IMP-06 (12 tests) pass. All 8 key files confirmed wired end-to-end: /import page, analyze/configure pages, delete dialog, row-actions CTA matrix, transactions DAL importId filter, and import reconciliation service. IMP-02 fixme group (5 tests) is a planned gap requiring a real R2 file, documented as staging-only. |
| R016 | failure-visibility | validated | M004/S05 | M004/S03, M004/S04, M004/S06 | S05 delivered: mapAnalyzeError/mapConfirmError in action layer allowlist-only pass-through known Italian lifecycle messages; all other errors collapse to generic Italian fallback. Redaction tests assert objectKey, https://, and stack frame substrings are absent from action return values. No presigned URLs, raw file contents, credentials, or raw SDK objects in action payloads. |
| R017 | differentiator | deferred | none | none | unmapped |
| R018 | admin/support | deferred | none | none | unmapped |
| R019 | core-capability | deferred | none | none | unmapped |
| R020 | core-capability | deferred | none | none | unmapped |
| R021 | anti-feature | out-of-scope | none | none | n/a |
| R022 | anti-feature | out-of-scope | none | none | n/a |
| R029 |  | active | none | none | M005/S01 partial validation: existing expense, transaction, and pattern Server Actions now call the shared categorization revalidation helper on successful mutations only; focused Vitest passed 37/37 for exact route-set and no-revalidation failure-path coverage. Future category-management actions remain to be added in downstream slices before full validation. |
| R030 |  | validated | none | none | M005/S01 verification: desktop sidebar and mobile bottom nav no longer render `/categories`; `yarn playwright test tests/layout.spec.ts --grep "categories|/categories" --reporter=list` passed 2/2 and static href scan found no stale `/categories` href in `components/layout` or `lib/routes`. |
| R031 | operability | validated | M005/S01 | M005/S02, M005/S03, M005/S04 | M005/S01: `APP_ROUTES.categorySettings` introduced in `lib/routes.ts`; consumed by S02/S03/S04 revalidation and navigation without string-literal duplication. |
| R032 | core-capability | validated | M005/S02 | M005/S03 | M005/S02: nullable userId owner columns, scoped partial unique indexes, merged DAL returning isOwned metadata; migration 0010 applied. M005/S03: authenticated CRUD Server Actions and delete guards delivered and Playwright-acceptance-tested. |
| R033 | core-capability | validated | M005/S02 | M005/S03 | M006/S01 validation: `/dashboard/overview` renders the migrated KPI cards and extended MonthlyTrendChart with total IN, total OUT, and derived balance. Balance is computed with Decimal.js and rendered as a line with green/red per-point dots for positive/negative months; closeout verification passed `yarn tsc --noEmit`, `yarn build`, and `yarn check:language`. |
| R034 | primary-user-loop | validated | M005/S04 | M005/S02 | M005/S04: `buildCategoryOptions()` with `allowedCategoryTypes` filter; `filterCategoryOptions()` searches label, originalName, categoryName, slug; 18 Vitest helper tests pass; `CategoryCombobox` wired into both expense dialogs. |
| R035 | compliance/security | validated | M005/S02 | M005/S03 | M005/S02: ownership distinction established in schema/DAL. M005/S03: `isLinkedExpenseCount` and delete guards implemented; system rows rejected; linked-expense blocking with Italian error; Playwright acceptance passed. |
| R036 | operability | validated | M005/S01 | M005/S02, M005/S04 | M005/S01: Playwright passed both desktop sidebar and mobile bottom-nav absence checks; static rg scan found no stale `/categories` href. M005/S04: `isOwned` flag drives Personale badge in CategoryCombobox; 4 Playwright browser tests cover badge visibility. |
| R037 | integration | validated | M005/S01 | M005/S03 | M005/S01: `revalidateCategorizationSurfaces()` wired into expense/transaction/pattern actions. M005/S03: category management actions use the helper via `successAfterRevalidation()` wrapper. 37 Vitest tests assert the exact route-set contract; S01-UAT confirms cross-route revalidation without page reload. |
| R038 | launchability | active | M007/S01 | M007/S05 | mapped |
| R039 | integration | active | M007/S01 | M007/S02, M007/S05 | mapped |
| R040 | operability | validated | M007/S02 | M007/S05 | M007/S02 verified `yarn db:migrate:production` wiring, production-only env guardrails, missing-target/confirmation failure before DB access, sanitized diagnostics, bounded migration pool settings, and documentation via `yarn vitest tests/migration-config.test.ts`, negative redaction command, `yarn lint`, `yarn check:language`, and `yarn build`. |
| R041 | integration | active | M007/S03 | M007/S05 | mapped |
| R042 | compliance/security | validated | M007/S04 | M007/S05 | S04 verified a centralized server-only REGISTRATION_ENABLED parser, blocked signup in signUpAction without calling Better Auth, blocked direct POST /api/auth/sign-up/email with a sanitized 403 response, and preserved existing-user signin delegation. Fresh closeout verification passed: yarn vitest tests/registration-config.test.ts tests/auth-actions-registration.test.ts tests/auth-route-registration.test.ts && yarn lint && yarn check:language && yarn build (gsd_exec a173d09a-b2b1-401a-8eea-9f1a7f140373). |
| R043 | failure-visibility | validated | M007/S05 | M007/S01, M007/S02, M007/S03, M007/S04 | S05 verified: production smoke CLI (scripts/production-smoke.mjs) emits bounded JSONL with safe-field whitelist covering health, signup-disabled, and unexpected-error events. Playwright spec (tests/production-smoke.spec.ts) skips by default and validates diagnostic assertions for forbidden secret patterns when live. All 84 Vitest tests + PLAYWRIGHT_PRODUCTION_SMOKE=0 playwright tests pass. |
| R044 | operability | validated | M007/S05 | M007/S01, M007/S02, M007/S03, M007/S04 | S05 verified: docs/deploy/vercel-supabase-r2.md contains an ordered integrated production smoke sequence covering first deploy, migration, Vercel env/redeploy, /api/health, signup/login enabled, disabled signup/direct API 403, preserved login, R2 import, failure triage, evidence capture, free-tier constraints, and recovery. Runbook content smoke Python script confirmed all required terms present and no secret values embedded. |
| R045 | constraint | validated | M007/S05 | M007/S01 | S05 verified: docs/deploy/vercel-supabase-r2.md explicitly documents Vercel Hobby, Supabase Free, and Cloudflare R2 free-tier constraints as production scope boundaries. Runbook content smoke confirmed 'free-tier' term present. |
| R046 | operability | deferred | none | none | unmapped |
| R047 | operability | deferred | none | none | unmapped |
| R048 | operability | deferred | none | none | unmapped |
| R049 | quality-attribute | deferred | none | none | unmapped |
| R050 | anti-feature | out-of-scope | none | none | n/a |
| R051 | anti-feature | out-of-scope | none | none | n/a |
| R052 | anti-feature | out-of-scope | none | none | n/a |
| R053 | anti-feature | out-of-scope | none | none | n/a |

## Coverage Summary

- Active requirements: 4
- Mapped to slices: 4
- Validated: 35 (ADV-01, ADV-02, ADV-03, ADV-04, IMP-01, IMP-02, IMP-03, IMP-04, IMP-05, R001, R005, R006, R007, R008, R009, R010, R011, R012, R013, R014, R015, R016, R030, R031, R032, R033, R034, R035, R036, R037, R040, R042, R043, R044, R045)
- Unmapped active requirements: 0
